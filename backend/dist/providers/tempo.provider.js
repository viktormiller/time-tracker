"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TempoProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const base_provider_1 = require("./base.provider");
const secrets_1 = require("../utils/secrets");
const jira_service_1 = require("../services/jira.service");
class TempoProvider extends base_provider_1.BaseTimeProvider {
    constructor(prisma) {
        super(prisma, 'TEMPO', 'tempo_cache.json');
        this.issueKeysResolved = 0;
        this.issueKeysFallback = 0;
        this.resolvedIssues = new Map();
        this.jiraResolver = new jira_service_1.JiraIssueResolver(prisma);
    }
    async sync(options = {}) {
        const { forceRefresh = false, customStart, customEnd } = options;
        let rawEntries = [];
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
        }
        else if (backfilled > 0) {
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
    async fetchFromAPI(startDate, endDate) {
        const token = (0, secrets_1.loadSecret)('tempo_api_token', { required: false });
        if (!token)
            throw new Error('TEMPO_API_TOKEN not configured (check environment or Docker secrets)');
        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        try {
            // Tempo API v4 — follow metadata.next until all pages are fetched
            const results = [];
            let url = 'https://api.tempo.io/4/worklogs';
            let params = {
                from: startDate,
                to: endDate,
                limit: 1000
            };
            while (url) {
                const response = await axios_1.default.get(url, { params, headers });
                results.push(...(response.data.results ?? []));
                url = response.data.metadata?.next ?? null;
                params = undefined; // the next-URL already carries all query params
            }
            return results;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error('[Tempo API Error]', error.response?.data || error.message);
                throw new Error(`Tempo API Fehler: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
            }
            throw error;
        }
    }
    transformEntry(rawEntry) {
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
        }
        else if (rawEntry.issue?.id) {
            const resolved = this.resolvedIssues.get(String(rawEntry.issue.id));
            if (resolved) {
                issueKey = resolved.issueKey;
                projectName = resolved.projectName || '';
                issueSummary = resolved.summary || '';
                this.issueKeysResolved++;
            }
            else {
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
    async backfillLegacyProjects() {
        const legacy = await this.prisma.timeEntry.findMany({
            where: { source: 'TEMPO', project: { startsWith: 'Issue #' } },
            select: { project: true },
            distinct: ['project']
        });
        const ids = legacy
            .map((entry) => entry.project?.match(/^Issue #(\d+)$/)?.[1])
            .filter((id) => !!id);
        if (ids.length === 0)
            return 0;
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
    async validate() {
        const token = (0, secrets_1.loadSecret)('tempo_api_token', { required: false });
        if (!token)
            return false;
        try {
            await axios_1.default.get('https://api.tempo.io/4/worklogs', {
                params: { limit: 1 },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.TempoProvider = TempoProvider;
