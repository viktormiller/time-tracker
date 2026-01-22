import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { BaseTimeProvider } from './base.provider';
import { SyncOptions, SyncResult, RawTimeEntry } from './provider.interface';

export class TempoProvider extends BaseTimeProvider {
  private issueKeysResolved = 0;
  private issueKeysFallback = 0;

  constructor(prisma: PrismaClient) {
    super(prisma, 'TEMPO', 'tempo_cache.json');
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

    // Debug: Log first entry structure
    if (rawEntries.length > 0) {
      console.log('[Tempo Debug] Erster Eintrag Rohdaten:', JSON.stringify(rawEntries[0], null, 2));
    }

    // Transform and upsert entries
    const transformedEntries = rawEntries.map(entry => this.transformEntry(entry));
    const count = await this.upsertEntries(transformedEntries);

    return {
      count,
      cached: usedCache,
      message: usedCache ? 'Geladen aus Cache' : 'Frisch von Tempo API geladen',
      issueKeysResolved: this.issueKeysResolved,
      issueKeysFallback: this.issueKeysFallback,
      jiraBaseUrl: process.env.JIRA_BASE_URL || null
    };
  }

  async fetchFromAPI(startDate: string, endDate: string): Promise<any[]> {
    const token = process.env.TEMPO_API_TOKEN;
    if (!token) throw new Error('TEMPO_API_TOKEN is missing in .env');

    try {
      // Tempo API v4
      const response = await axios.get('https://api.tempo.io/4/worklogs', {
        params: {
          from: startDate,
          to: endDate,
          limit: 1000
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Tempo delivers data in "results" array
      return response.data.results;
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

    // Extract issue key from Tempo API response
    let issueKey = 'Unknown Issue';
    let projectName = '';

    if (rawEntry.issue?.key) {
      issueKey = rawEntry.issue.key;
      this.issueKeysResolved++;
      console.log(`[Tempo] Entry ${rawEntry.tempoWorklogId}: Using issue key ${rawEntry.issue.key}`);

      if (rawEntry.issue.project?.name) {
        projectName = rawEntry.issue.project.name;
      }
    } else if (rawEntry.issue?.id) {
      issueKey = `Issue #${rawEntry.issue.id}`;
      this.issueKeysFallback++;
      console.log(`[Tempo] Entry ${rawEntry.tempoWorklogId}: No key found, using ID ${rawEntry.issue.id}`);
    }

    // Format for project column: "ABC-27 - Project Name" or just "ABC-27"
    const projectDisplay = projectName ? `${issueKey} - ${projectName}` : issueKey;

    // Description fallback to comment field
    const description = rawEntry.description || rawEntry.comment || '';

    return {
      externalId: rawEntry.tempoWorklogId.toString(),
      date: new Date(rawEntry.startDate),
      duration: durationHours,
      project: projectDisplay,
      description: description
    };
  }

  async validate(): Promise<boolean> {
    const token = process.env.TEMPO_API_TOKEN;
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
