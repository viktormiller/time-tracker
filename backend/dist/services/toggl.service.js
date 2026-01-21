"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TogglService = void 0;
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
// FIX 1: Sicherstellen, dass hier TOGGL steht, nicht TEMPO
const CACHE_FILE = path_1.default.join(__dirname, '../../toggl_cache.json');
const CACHE_DURATION_MS = 10 * 60 * 1000;
class TogglService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async syncTogglEntries(forceRefresh = false, customStart, customEnd) {
        const token = process.env.TOGGL_API_TOKEN;
        if (!token)
            throw new Error('TOGGL_API_TOKEN is missing in .env');
        // FIX 2: Logging der Eingangsparameter
        console.log(`[Toggl Service] Request: Force=${forceRefresh}, Start=${customStart}, End=${customEnd}`);
        let entries = [];
        let usedCache = false;
        // Prüfen, ob wir Custom Dates haben (Strings müssen vorhanden und nicht leer sein)
        const isCustomSync = !!customStart && !!customEnd && customStart !== '' && customEnd !== '';
        // Cache Logik
        const cacheExists = await this.fileExists(CACHE_FILE);
        if (cacheExists && !forceRefresh && !isCustomSync) {
            const stats = await promises_1.default.stat(CACHE_FILE);
            const age = Date.now() - stats.mtimeMs;
            if (age < CACHE_DURATION_MS) {
                console.log('[Toggl] Using cached data');
                const fileContent = await promises_1.default.readFile(CACHE_FILE, 'utf-8');
                entries = JSON.parse(fileContent);
                usedCache = true;
            }
        }
        if (!usedCache) {
            console.log('[Toggl] Fetching fresh data from API...');
            let startDateStr = '';
            let endDateStr = '';
            if (isCustomSync) {
                startDateStr = customStart;
                endDateStr = customEnd;
            }
            else {
                // Standard: Letzte 3 Monate
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 1); // Morgen
                const startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 3);
                startDateStr = startDate.toISOString().split('T')[0];
                endDateStr = endDate.toISOString().split('T')[0];
            }
            console.log(`[Toggl API] Querying Range: ${startDateStr} to ${endDateStr}`);
            const params = {
                start_date: startDateStr,
                end_date: endDateStr
            };
            try {
                const response = await axios_1.default.get('https://api.track.toggl.com/api/v9/me/time_entries', {
                    params,
                    headers: {
                        Authorization: `Basic ${Buffer.from(`${token}:api_token`).toString('base64')}`,
                        'Content-Type': 'application/json'
                    }
                });
                entries = response.data;
                // Nur cachen, wenn es der Standard-Zeitraum war
                if (!isCustomSync) {
                    console.log(`[Toggl] Writing ${entries.length} entries to cache: ${CACHE_FILE}`);
                    await promises_1.default.writeFile(CACHE_FILE, JSON.stringify(entries, null, 2));
                }
                else {
                    console.log(`[Toggl] Custom sync - skipping cache write.`);
                }
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error)) {
                    // FIX 3: Echte Fehlermeldung von Toggl ausgeben
                    const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
                    console.error('[Toggl API Error]', errorMsg);
                    if (error.response?.status === 400) {
                        throw new Error(`Toggl API Fehler (400): ${error.response.data || 'Ungültige Anfrage (Zeitraum zu groß?)'}`);
                    }
                }
                throw error;
            }
        }
        // Speichern in DB
        let count = 0;
        console.log(`[Toggl DB] Processing ${entries.length} entries...`);
        for (const entry of entries) {
            if (entry.duration < 0)
                continue;
            const durationHours = entry.duration / 3600;
            const projectName = entry.project_id ? `Proj-${entry.project_id}` : 'No Project';
            await this.prisma.timeEntry.upsert({
                where: {
                    source_externalId: { source: 'TOGGL', externalId: entry.id.toString() }
                },
                update: {
                    duration: durationHours,
                    description: entry.description,
                    project: projectName,
                    date: new Date(entry.start)
                },
                create: {
                    source: 'TOGGL',
                    externalId: entry.id.toString(),
                    date: new Date(entry.start),
                    duration: durationHours,
                    project: projectName,
                    description: entry.description
                }
            });
            count++;
        }
        console.log(`[Toggl DB] Upserted ${count} entries.`);
        return {
            count,
            cached: usedCache,
            message: usedCache ? 'Geladen aus Cache' : 'Frisch von API geladen'
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
exports.TogglService = TogglService;
