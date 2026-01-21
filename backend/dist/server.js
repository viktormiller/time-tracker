"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const toggl_service_1 = require("./services/toggl.service");
const tempo_service_1 = require("./services/tempo.service");
const fastify_1 = __importDefault(require("fastify"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const cors_1 = __importDefault(require("@fastify/cors"));
const client_1 = require("@prisma/client");
const toggl_csv_adapter_1 = require("./adapters/toggl-csv.adapter");
const tempo_csv_adapter_1 = require("./adapters/tempo-csv.adapter");
const auth_1 = __importDefault(require("./plugins/auth"));
const session_1 = __importDefault(require("./plugins/session"));
const security_1 = __importDefault(require("./plugins/security"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const export_routes_1 = __importDefault(require("./routes/export.routes"));
const prisma = new client_1.PrismaClient();
const app = (0, fastify_1.default)({ logger: true });
// Register plugins
app.register(cors_1.default, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true // Required for cookies
});
app.register(multipart_1.default);
// Security plugins
app.register(security_1.default);
app.register(auth_1.default);
app.register(session_1.default);
// --- Routes ---
// Health check endpoint (public, for Docker health checks)
app.get('/health', async (request, reply) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        return { status: 'healthy', timestamp: new Date().toISOString() };
    }
    catch (error) {
        reply.code(503).send({ status: 'unhealthy', error: 'Database connection failed' });
    }
});
// Auth routes (public - no authentication required)
app.register(auth_routes_1.default);
// Protected API routes (require authentication)
app.register(async (protectedRoutes) => {
    // Apply authentication to ALL routes in this plugin
    protectedRoutes.addHook('onRequest', app.authenticate);
    // Register export routes
    protectedRoutes.register(export_routes_1.default);
    // Get Jira configuration for frontend
    protectedRoutes.get('/config/jira', async (request, reply) => {
        return {
            baseUrl: process.env.JIRA_BASE_URL || null,
            configured: !!process.env.JIRA_BASE_URL
        };
    });
    // 1. Get Aggregated Stats
    protectedRoutes.get('/stats', async (request, reply) => {
        // Simple aggregation: Group by date
        // In a real app, you would add ?from=...&to=... query params here
        const entries = await prisma.timeEntry.findMany({
            orderBy: { date: 'desc' }
        });
        return entries;
    });
    // 2. Upload Endpoint
    protectedRoutes.post('/upload', async (req, reply) => {
        const data = await req.file();
        if (!data) {
            return reply.code(400).send({ error: 'No file uploaded' });
        }
        const buffer = await data.toBuffer();
        const fileContent = buffer.toString('utf-8');
        const filename = data.filename.toLowerCase();
        let adapter;
        // Simple strategy selection based on filename or content detection
        if (filename.includes('toggl')) {
            adapter = new toggl_csv_adapter_1.TogglCsvAdapter();
        }
        else if (filename.includes('report') && fileContent.includes('01/Dec')) {
            // Basic heuristic for Tempo based on your file naming/content
            adapter = new tempo_csv_adapter_1.TempoCsvAdapter();
        }
        else {
            // Fallback detection logic could go here
            // For now, default to Tempo if it looks like a matrix?
            // Let's assume explicit naming for safety first.
            if (fileContent.includes('Issue,Key')) {
                adapter = new tempo_csv_adapter_1.TempoCsvAdapter();
            }
            else {
                return reply.code(400).send({ error: 'Unknown CSV format. Please rename file to include "toggl" or ensure Tempo format.' });
            }
        }
        const result = await adapter.parse(fileContent);
        if (result.errors.length > 0) {
            req.log.error(result.errors);
        }
        // Batch insert into Database
        let count = 0;
        for (const entry of result.entries) {
            const extId = entry.externalId || `FALLBACK_${entry.source}_${entry.date.getTime()}_${Math.random()}`;
            await prisma.timeEntry.upsert({
                where: {
                    source_externalId: {
                        source: entry.source,
                        externalId: extId
                    }
                },
                update: {
                    // Wenn es den Eintrag schon gibt: Update machen (z.B. Description geändert?)
                    duration: entry.duration,
                    description: entry.description,
                    project: entry.project
                },
                create: {
                    source: entry.source,
                    externalId: extId,
                    date: entry.date,
                    duration: entry.duration,
                    project: entry.project,
                    description: entry.description
                }
            });
            count++;
        }
        return { message: 'Import successful', imported: count, errors: result.errors };
    });
    // Toggl Sync Route
    protectedRoutes.post('/sync/toggl', async (req, reply) => {
        const force = req.query.force === 'true';
        // Body parsen für Custom Dates
        const { startDate, endDate } = req.body || {};
        console.log('[API Route] /sync/toggl called with body:', req.body);
        const togglService = new toggl_service_1.TogglService(prisma);
        try {
            const result = await togglService.syncTogglEntries(force, startDate, endDate);
            return result;
        }
        catch (error) {
            req.log.error(error);
            return reply.code(500).send({ error: error.message });
        }
    });
    // Tempo Sync Route
    protectedRoutes.post('/sync/tempo', async (req, reply) => {
        const force = req.query.force === 'true';
        const { startDate, endDate } = req.body || {};
        const tempoService = new tempo_service_1.TempoService(prisma);
        try {
            const result = await tempoService.syncTempoEntries(force, startDate, endDate);
            return result;
        }
        catch (error) {
            req.log.error(error);
            return reply.code(500).send({ error: error.message });
        }
    });
    // Eintrag löschen
    protectedRoutes.delete('/entries/:id', async (req, reply) => {
        const { id } = req.params;
        try {
            await prisma.timeEntry.delete({
                where: { id },
            });
            return { success: true };
        }
        catch (error) {
            req.log.error(error);
            return reply.code(500).send({ error: 'Could not delete entry' });
        }
    });
    // Eintrag aktualisieren
    protectedRoutes.put('/entries/:id', async (req, reply) => {
        const { id } = req.params;
        const { date, duration, project, description, source } = req.body;
        try {
            const updated = await prisma.timeEntry.update({
                where: { id },
                data: {
                    date: new Date(date), // String wieder in Date Objekt wandeln
                    duration: parseFloat(duration.toString()), // Sicherstellen, dass es eine Zahl ist
                    project,
                    description,
                    source
                },
            });
            return updated;
        }
        catch (error) {
            req.log.error(error);
            return reply.code(500).send({ error: 'Could not update entry' });
        }
    });
}, { prefix: '/api' });
// Start Server
const start = async () => {
    try {
        await app.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server running at http://localhost:3000');
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
