"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TempoService = void 0;
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const CACHE_FILE = path_1.default.join(__dirname, '../../tempo_cache.json');
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 Minuten
class TempoService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async syncTempoEntries(forceRefresh = false, customStart, customEnd) {
        const token = process.env.TEMPO_API_TOKEN;
        if (!token)
            throw new Error('TEMPO_API_TOKEN is missing in .env');
        let entries = [];
        let usedCache = false;
        // 1. Cache Prüfung (Analog zu Toggl)
        const isCustomSync = !!customStart && !!customEnd;
        const cacheExists = await this.fileExists(CACHE_FILE);
        if (cacheExists && !forceRefresh && !isCustomSync) {
            const stats = await promises_1.default.stat(CACHE_FILE);
            const age = Date.now() - stats.mtimeMs;
            if (age < CACHE_DURATION_MS) {
                console.log('[Tempo] Using cached data');
                const fileContent = await promises_1.default.readFile(CACHE_FILE, 'utf-8');
                entries = JSON.parse(fileContent);
                usedCache = true;
            }
        }
        // 2. API Abruf
        if (!usedCache) {
            console.log('[Tempo] Fetching fresh data from API...');
            let startDateStr = '';
            let endDateStr = '';
            if (isCustomSync) {
                startDateStr = customStart;
                endDateStr = customEnd;
            }
            else {
                // Standard: Letzte 3 Monate bis Morgen
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 1);
                const startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 3);
                startDateStr = startDate.toISOString().split('T')[0];
                endDateStr = endDate.toISOString().split('T')[0];
            }
            try {
                // Tempo API v4
                // Limit auf 1000 setzen (Pagination für MVP ignoriert, reicht meist für 1 User/3 Monate)
                const response = await axios_1.default.get('https://api.tempo.io/4/worklogs', {
                    params: {
                        from: startDateStr,
                        to: endDateStr,
                        limit: 1000
                    },
                    headers: {
                        Authorization: `Bearer ${token}`, // Bearer Auth!
                        'Content-Type': 'application/json'
                    }
                });
                // Tempo liefert Daten im "results" Array
                entries = response.data.results;
                if (!isCustomSync) {
                    await promises_1.default.writeFile(CACHE_FILE, JSON.stringify(entries, null, 2));
                }
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error)) {
                    console.error('[Tempo API Error]', error.response?.data || error.message);
                    throw new Error(`Tempo API Fehler: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
                }
                throw error;
            }
        }
        // DEBUG: Den ersten Eintrag loggen, damit wir die Struktur sehen
        if (entries.length > 0) {
            console.log('[Tempo Debug] Erster Eintrag Rohdaten:', JSON.stringify(entries[0], null, 2));
        }
        // 3. Speichern in DB
        let count = 0;
        let entriesWithKeys = 0;
        let entriesWithFallback = 0;
        for (const entry of entries) {
            const durationHours = entry.timeSpentSeconds / 3600;
            // Extract issue key from Tempo API response
            // The Tempo API v4 response includes issue.key when available
            // Format: "ABC-27 - Project Name" for display in project column
            let issueKey = 'Unknown Issue';
            let projectName = '';
            if (entry.issue?.key) {
                issueKey = entry.issue.key;
                entriesWithKeys++;
                console.log(`[Tempo] Entry ${entry.tempoWorklogId}: Using issue key ${entry.issue.key}`);
                // If we also have project info, combine them
                if (entry.issue.project?.name) {
                    projectName = entry.issue.project.name;
                }
            }
            else if (entry.issue?.id) {
                issueKey = `Issue #${entry.issue.id}`;
                entriesWithFallback++;
                console.log(`[Tempo] Entry ${entry.tempoWorklogId}: No key found, using ID ${entry.issue.id}`);
            }
            // Format for project column: "ABC-27 - Project Name" or just "ABC-27"
            const projectDisplay = projectName
                ? `${issueKey} - ${projectName}`
                : issueKey;
            // Falls Description fehlt, nutzen wir den Kommentar (Tempo nennt das oft 'comment')
            const description = entry.description || entry.comment || '';
            try {
                await this.prisma.timeEntry.upsert({
                    where: {
                        source_externalId: {
                            source: 'TEMPO',
                            externalId: entry.tempoWorklogId.toString()
                        }
                    },
                    update: {
                        duration: durationHours,
                        description: description,
                        project: projectDisplay,
                        date: new Date(entry.startDate)
                    },
                    create: {
                        source: 'TEMPO',
                        externalId: entry.tempoWorklogId.toString(),
                        date: new Date(entry.startDate),
                        duration: durationHours,
                        project: projectDisplay,
                        description: description
                    }
                });
                count++;
            }
            catch (error) {
                if (error.code === 'P2002') {
                    // Unique constraint violation - fail the operation
                    const errMsg = `Duplicate entry detected: TEMPO/${entry.tempoWorklogId}. ` +
                        `Issue: ${issueKey}, Date: ${entry.startDate}`;
                    console.error('[Tempo Sync Error]', errMsg);
                    throw new Error(errMsg);
                }
                throw error;
            }
        }
        return {
            count,
            cached: usedCache,
            message: usedCache ? 'Geladen aus Cache' : 'Frisch von Tempo API geladen',
            issueKeysResolved: entriesWithKeys,
            issueKeysFallback: entriesWithFallback,
            jiraBaseUrl: process.env.JIRA_BASE_URL || null
        };
    }
    async fileExists(path) {
        try {
            await promises_1.default.access(path);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.TempoService = TempoService;
