"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TogglProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const base_provider_1 = require("./base.provider");
const secrets_1 = require("../utils/secrets");
class TogglProvider extends base_provider_1.BaseTimeProvider {
    constructor(prisma) {
        super(prisma, 'TOGGL', 'toggl_cache.json');
    }
    async sync(options = {}) {
        const { forceRefresh = false, customStart, customEnd } = options;
        console.log(`[Toggl Service] Request: Force=${forceRefresh}, Start=${customStart}, End=${customEnd}`);
        let rawEntries = [];
        let usedCache = false;
        // Check if custom date range is provided
        const isCustomSync = !!customStart && !!customEnd && customStart !== '' && customEnd !== '';
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
            console.log('[Toggl] Fetching fresh data from API...');
            const dateRange = this.calculateDateRange(customStart, customEnd);
            console.log(`[Toggl API] Querying Range: ${dateRange.start} to ${dateRange.end}`);
            rawEntries = await this.fetchFromAPI(dateRange.start, dateRange.end);
            // Only cache for standard time range (not custom)
            if (!isCustomSync) {
                await this.writeCache(rawEntries);
            }
            else {
                console.log(`[Toggl] Custom sync - skipping cache write.`);
            }
        }
        // Transform and upsert entries
        const transformedEntries = rawEntries
            .filter(entry => entry.duration >= 0) // Skip running timers
            .map(entry => this.transformEntry(entry));
        const count = await this.upsertEntries(transformedEntries);
        return {
            count,
            cached: usedCache,
            message: usedCache ? 'Geladen aus Cache' : 'Frisch von API geladen'
        };
    }
    async fetchFromAPI(startDate, endDate) {
        const token = (0, secrets_1.loadSecret)('toggl_api_token', { required: false });
        if (!token)
            throw new Error('TOGGL_API_TOKEN not configured (check environment or Docker secrets)');
        const params = {
            start_date: startDate,
            end_date: endDate
        };
        try {
            const response = await axios_1.default.get('https://api.track.toggl.com/api/v9/me/time_entries', {
                params,
                headers: {
                    Authorization: `Basic ${Buffer.from(`${token}:api_token`).toString('base64')}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
                console.error('[Toggl API Error]', errorMsg);
                if (error.response?.status === 400) {
                    throw new Error(`Toggl API Fehler (400): ${error.response.data || 'Ungültige Anfrage (Zeitraum zu groß?)'}`);
                }
            }
            throw error;
        }
    }
    transformEntry(rawEntry) {
        const durationHours = rawEntry.duration / 3600;
        const projectName = rawEntry.project_id ? `Proj-${rawEntry.project_id}` : 'No Project';
        return {
            externalId: rawEntry.id.toString(),
            date: new Date(rawEntry.start),
            duration: durationHours,
            project: projectName,
            description: rawEntry.description
        };
    }
    async validate() {
        const token = (0, secrets_1.loadSecret)('toggl_api_token', { required: false });
        if (!token)
            return false;
        try {
            await axios_1.default.get('https://api.track.toggl.com/api/v9/me', {
                headers: {
                    Authorization: `Basic ${Buffer.from(`${token}:api_token`).toString('base64')}`
                }
            });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.TogglProvider = TogglProvider;
