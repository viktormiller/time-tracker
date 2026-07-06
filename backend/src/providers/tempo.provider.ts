import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { BaseTimeProvider } from './base.provider';
import { SyncOptions, SyncResult, RawTimeEntry } from './provider.interface';
import { loadSecret } from '../utils/secrets';
import { JiraIssueResolver, JiraIssueInfo } from '../services/jira.service';

export class TempoProvider extends BaseTimeProvider {
  private issueKeysResolved = 0;
  private issueKeysFallback = 0;
  private resolvedIssues = new Map<string, JiraIssueInfo>();
  private jiraResolver: JiraIssueResolver;

  constructor(prisma: PrismaClient) {
    super(prisma, 'TEMPO', 'tempo_cache.json');
    this.jiraResolver = new JiraIssueResolver(prisma);
  }

  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const { forceRefresh = false, customStart, customEnd } = options;

    let rawEntries: any[] = [];
    let usedCache = false;

    // Reset counters
    this.issueKeysResolved = 0;
    this.issueKeysFallback = 0;

    // Check if custom date range is provided
    const isCustomSync = !!customStart && !!customEnd;

    // Try to use cache for non-custom syncs
    if (!forceRefresh && !isCustomSync) {
      const cachedData = await this.readCache();
      if (cachedData) {
        rawEntries = cachedData;
        usedCache = true;
      }
    }

    // Fetch from API if not using cache
    if (!usedCache) {
      console.log('[Tempo] Fetching fresh data from API...');

      const dateRange = this.calculateDateRange(customStart, customEnd);
      rawEntries = await this.fetchFromAPI(dateRange.start, dateRange.end);

      // Only cache for standard time range
      if (!isCustomSync) {
        await this.writeCache(rawEntries);
      }
    }

    // Tempo v4 only returns numeric issue IDs — resolve them to keys,
    // summaries and project names via Jira before transforming
    const idsToResolve = rawEntries
      .filter((entry) => !entry.issue?.key && entry.issue?.id)
      .map((entry) => String(entry.issue.id));
    this.resolvedIssues = await this.jiraResolver.resolveIssueIds(idsToResolve);

    // Transform and upsert entries
    const transformedEntries = rawEntries.map(entry => this.transformEntry(entry));
    const count = await this.upsertEntries(transformedEntries);

    // Heal historic entries still stored as "Issue #<id>" (synced before
    // Jira resolution existed or before it was configured)
    const backfilled = await this.backfillLegacyProjects();

    let message = usedCache ? 'Geladen aus Cache' : 'Frisch von Tempo API geladen';
    if (this.issueKeysFallback > 0 && !this.jiraResolver.isConfigured()) {
      message += ` – ${this.issueKeysFallback} Issue-Keys nicht auflösbar (JIRA_EMAIL/JIRA_API_TOKEN konfigurieren)`;
    } else if (backfilled > 0) {
      message += ` – ${backfilled} ältere Einträge mit Issue-Keys aktualisiert`;
    }

    return {
      count,
      cached: usedCache,
      message,
      issueKeysResolved: this.issueKeysResolved,
      issueKeysFallback: this.issueKeysFallback,
      backfilled,
      jiraBaseUrl: process.env.JIRA_BASE_URL || null
    };
  }

  async fetchFromAPI(startDate: string, endDate: string): Promise<any[]> {
    const token = loadSecret('tempo_api_token', { required: false });
    if (!token) throw new Error('TEMPO_API_TOKEN not configured (check environment or Docker secrets)');

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      // Tempo API v4 — follow metadata.next until all pages are fetched
      const results: any[] = [];
      let url: string | null = 'https://api.tempo.io/4/worklogs';
      let params: Record<string, string | number> | undefined = {
        from: startDate,
        to: endDate,
        limit: 1000
      };

      while (url) {
        const response: { data: { results?: any[]; metadata?: { next?: string } } } =
          await axios.get(url, { params, headers });
        results.push(...(response.data.results ?? []));
        url = response.data.metadata?.next ?? null;
        params = undefined; // the next-URL already carries all query params
      }

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[Tempo API Error]', error.response?.data || error.message);
        throw new Error(`Tempo API Fehler: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  transformEntry(rawEntry: any): RawTimeEntry {
    const durationHours = rawEntry.timeSpentSeconds / 3600;

    let issueKey = 'Unknown Issue';
    let projectName = '';
    let issueSummary = '';

    if (rawEntry.issue?.key) {
      // Legacy path: some Tempo responses/caches still carry the key directly
      issueKey = rawEntry.issue.key;
      this.issueKeysResolved++;

      if (rawEntry.issue.project?.name) {
        projectName = rawEntry.issue.project.name;
      }
    } else if (rawEntry.issue?.id) {
      const resolved = this.resolvedIssues.get(String(rawEntry.issue.id));
      if (resolved) {
        issueKey = resolved.issueKey;
        projectName = resolved.projectName || '';
        issueSummary = resolved.summary || '';
        this.issueKeysResolved++;
      } else {
        issueKey = `Issue #${rawEntry.issue.id}`;
        this.issueKeysFallback++;
      }
    }

    // Format for project column: "ABC-27 - Project Name" or just "ABC-27"
    const projectDisplay = projectName ? `${issueKey} - ${projectName}` : issueKey;

    // Worklog comment first; Tempo's auto-generated "Working on issue …"
    // placeholder carries no information, so prefer the Jira issue summary
    let description = rawEntry.description || rawEntry.comment || '';
    if (issueSummary && (!description || /^Working on issue\b/i.test(description))) {
      description = issueSummary;
    }

    return {
      externalId: rawEntry.tempoWorklogId.toString(),
      date: new Date(rawEntry.startDate),
      duration: durationHours,
      project: projectDisplay,
      description: description
    };
  }

  /**
   * Rewrites TimeEntry rows whose project is still the "Issue #<id>"
   * fallback to the resolved "KEY - Project" display. Covers entries that
   * are older than the current sync window. Cheap after the first run:
   * once healed, no rows match the prefix anymore.
   */
  private async backfillLegacyProjects(): Promise<number> {
    const legacy = await this.prisma.timeEntry.findMany({
      where: { source: 'TEMPO', project: { startsWith: 'Issue #' } },
      select: { project: true },
      distinct: ['project']
    });

    const ids = legacy
      .map((entry) => entry.project?.match(/^Issue #(\d+)$/)?.[1])
      .filter((id): id is string => !!id);
    if (ids.length === 0) return 0;

    const resolved = await this.jiraResolver.resolveIssueIds(ids);

    let updated = 0;
    for (const [id, info] of resolved) {
      const display = info.projectName ? `${info.issueKey} - ${info.projectName}` : info.issueKey;
      const result = await this.prisma.timeEntry.updateMany({
        where: { source: 'TEMPO', project: `Issue #${id}` },
        data: { project: display }
      });
      updated += result.count;
    }

    if (updated > 0) {
      console.log(`[Tempo] Backfilled ${updated} legacy entries with resolved issue keys`);
    }
    return updated;
  }

  async validate(): Promise<boolean> {
    const token = loadSecret('tempo_api_token', { required: false });
    if (!token) return false;

    try {
      await axios.get('https://api.tempo.io/4/worklogs', {
        params: { limit: 1 },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}
