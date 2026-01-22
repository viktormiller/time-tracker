"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const date_fns_1 = require("date-fns");
const provider_factory_1 = require("../providers/provider.factory");
const prisma = new client_1.PrismaClient();
/**
 * Summary routes for CLI consumption
 * Provides aggregated time data for today, week, and sync operations
 */
const summaryRoutes = async (fastify) => {
    /**
     * GET /api/entries/summary/today
     * Returns today's total hours and breakdown by source
     */
    fastify.get('/api/entries/summary/today', async (request, reply) => {
        const now = new Date();
        const dayStart = (0, date_fns_1.startOfDay)(now);
        const dayEnd = (0, date_fns_1.endOfDay)(now);
        // Get all entries for today
        const entries = await prisma.timeEntry.findMany({
            where: {
                date: {
                    gte: dayStart,
                    lte: dayEnd,
                },
            },
            select: {
                duration: true,
                source: true,
            },
        });
        // Calculate total hours
        const totalHours = entries.reduce((sum, entry) => sum + entry.duration, 0);
        // Calculate breakdown by source
        const bySource = {};
        entries.forEach((entry) => {
            bySource[entry.source] = (bySource[entry.source] || 0) + entry.duration;
        });
        return {
            date: (0, date_fns_1.format)(now, 'yyyy-MM-dd'),
            totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
            bySource,
            entryCount: entries.length,
        };
    });
    /**
     * GET /api/entries/summary/week
     * Returns weekly totals with daily and source breakdown
     */
    fastify.get('/api/entries/summary/week', async (request, reply) => {
        const now = new Date();
        const weekStart = (0, date_fns_1.startOfWeek)(now, { weekStartsOn: 1 }); // Monday
        const weekEnd = (0, date_fns_1.endOfWeek)(now, { weekStartsOn: 1 }); // Sunday
        // Get all entries for the week
        const entries = await prisma.timeEntry.findMany({
            where: {
                date: {
                    gte: weekStart,
                    lte: weekEnd,
                },
            },
            select: {
                date: true,
                duration: true,
                source: true,
            },
            orderBy: {
                date: 'asc',
            },
        });
        // Calculate total hours
        const totalHours = entries.reduce((sum, entry) => sum + entry.duration, 0);
        // Calculate breakdown by day
        const days = (0, date_fns_1.eachDayOfInterval)({ start: weekStart, end: weekEnd });
        const byDay = {};
        days.forEach((day) => {
            const dateKey = (0, date_fns_1.format)(day, 'yyyy-MM-dd');
            byDay[dateKey] = 0;
        });
        entries.forEach((entry) => {
            const dateKey = (0, date_fns_1.format)(entry.date, 'yyyy-MM-dd');
            byDay[dateKey] = (byDay[dateKey] || 0) + entry.duration;
        });
        // Calculate breakdown by source
        const bySource = {};
        entries.forEach((entry) => {
            bySource[entry.source] = (bySource[entry.source] || 0) + entry.duration;
        });
        // Format daily breakdown as array for easier CLI consumption
        const daily = days.map((day) => {
            const dateKey = (0, date_fns_1.format)(day, 'yyyy-MM-dd');
            return {
                date: dateKey,
                dayName: (0, date_fns_1.format)(day, 'EEE'), // Mon, Tue, Wed, etc.
                hours: Math.round((byDay[dateKey] || 0) * 100) / 100,
            };
        });
        return {
            weekStart: (0, date_fns_1.format)(weekStart, 'yyyy-MM-dd'),
            weekEnd: (0, date_fns_1.format)(weekEnd, 'yyyy-MM-dd'),
            totalHours: Math.round(totalHours * 100) / 100,
            daily,
            bySource,
            entryCount: entries.length,
        };
    });
    /**
     * POST /api/sync
     * Triggers sync from all configured providers
     */
    fastify.post('/api/sync', async (request, reply) => {
        const force = request.query.force === 'true';
        // Get all providers
        const providers = provider_factory_1.ProviderFactory.getAllProviders(prisma);
        // Sync from each provider
        const results = await Promise.allSettled(providers.map(async (provider) => {
            const name = provider.getName();
            // Check if provider is configured
            const isValid = await provider.validate();
            if (!isValid) {
                return {
                    provider: name,
                    success: false,
                    error: 'Provider not configured',
                };
            }
            try {
                const result = await provider.sync({ forceRefresh: force });
                return {
                    provider: name,
                    success: true,
                    imported: result.imported,
                    skipped: result.skipped,
                };
            }
            catch (error) {
                fastify.log.error({ provider: name, error }, 'Sync failed');
                return {
                    provider: name,
                    success: false,
                    error: error.message,
                };
            }
        }));
        // Format results
        const syncResults = results.map((result) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            else {
                return {
                    provider: 'unknown',
                    success: false,
                    error: result.reason?.message || 'Unknown error',
                };
            }
        });
        // Calculate summary
        const totalImported = syncResults.reduce((sum, r) => sum + (r.success && 'imported' in r ? r.imported || 0 : 0), 0);
        const totalSkipped = syncResults.reduce((sum, r) => sum + (r.success && 'skipped' in r ? r.skipped || 0 : 0), 0);
        const failedCount = syncResults.filter((r) => !r.success).length;
        return {
            success: failedCount === 0,
            totalImported,
            totalSkipped,
            results: syncResults,
        };
    });
};
exports.default = summaryRoutes;
