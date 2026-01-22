"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTimeProvider = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
class BaseTimeProvider {
    constructor(prisma, providerName, cacheFileName) {
        this.prisma = prisma;
        this.providerName = providerName;
        this.cacheFile = path_1.default.join(__dirname, '../../', cacheFileName);
    }
    getName() {
        return this.providerName;
    }
    getCachePath() {
        return this.cacheFile;
    }
    /**
     * Shared cache read logic
     */
    async readCache() {
        const exists = await this.fileExists(this.cacheFile);
        if (!exists)
            return null;
        const stats = await promises_1.default.stat(this.cacheFile);
        const age = Date.now() - stats.mtimeMs;
        if (age < CACHE_DURATION_MS) {
            console.log(`[${this.providerName}] Using cached data`);
            const fileContent = await promises_1.default.readFile(this.cacheFile, 'utf-8');
            return JSON.parse(fileContent);
        }
        return null;
    }
    /**
     * Shared cache write logic
     */
    async writeCache(data) {
        console.log(`[${this.providerName}] Writing ${data.length} entries to cache: ${this.cacheFile}`);
        await promises_1.default.writeFile(this.cacheFile, JSON.stringify(data, null, 2));
    }
    /**
     * Shared upsert logic for time entries
     */
    async upsertEntries(entries) {
        let count = 0;
        console.log(`[${this.providerName} DB] Processing ${entries.length} entries...`);
        for (const entry of entries) {
            await this.prisma.timeEntry.upsert({
                where: {
                    source_externalId: {
                        source: this.providerName,
                        externalId: entry.externalId
                    }
                },
                update: {
                    duration: entry.duration,
                    description: entry.description || null,
                    project: entry.project || null,
                    date: entry.date
                },
                create: {
                    source: this.providerName,
                    externalId: entry.externalId,
                    date: entry.date,
                    duration: entry.duration,
                    project: entry.project || null,
                    description: entry.description || null
                }
            });
            count++;
        }
        console.log(`[${this.providerName} DB] Upserted ${count} entries.`);
        return count;
    }
    /**
     * Calculate date range for sync
     */
    calculateDateRange(customStart, customEnd) {
        if (customStart && customEnd) {
            return { start: customStart, end: customEnd };
        }
        // Default: Last 3 months to tomorrow
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 1);
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        };
    }
    async fileExists(filePath) {
        try {
            await promises_1.default.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.BaseTimeProvider = BaseTimeProvider;
