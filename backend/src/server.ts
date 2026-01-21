import 'dotenv/config';
import { TogglService } from './services/toggl.service';
import { TempoService } from './services/tempo.service';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { TogglCsvAdapter } from './adapters/toggl-csv.adapter';
import { TempoCsvAdapter } from './adapters/tempo-csv.adapter';
import authPlugin from './plugins/auth';
import sessionPlugin from './plugins/session';
import securityPlugin from './plugins/security';
import authRoutes from './routes/auth.routes';

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// Register plugins
app.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true // Required for cookies
});
app.register(multipart);

// Security plugins
app.register(securityPlugin);
app.register(authPlugin);
app.register(sessionPlugin);

// --- Routes ---

// Health check endpoint (public, for Docker health checks)
app.get('/health', async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    reply.code(503).send({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// Auth routes (public - no authentication required)
app.register(authRoutes);

// Protected API routes (require authentication)
app.register(async (protectedRoutes) => {
  // Apply authentication to ALL routes in this plugin
  protectedRoutes.addHook('onRequest', app.authenticate);

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
      adapter = new TogglCsvAdapter();
    } else if (filename.includes('report') && fileContent.includes('01/Dec')) {
      // Basic heuristic for Tempo based on your file naming/content
      adapter = new TempoCsvAdapter();
    } else {
      // Fallback detection logic could go here
      // For now, default to Tempo if it looks like a matrix?
      // Let's assume explicit naming for safety first.
      if(fileContent.includes('Issue,Key')) {
          adapter = new TempoCsvAdapter();
      } else {
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
  protectedRoutes.post<{ Querystring: { force: string }, Body: { startDate?: string, endDate?: string } }>('/sync/toggl', async (req, reply) => {
      const force = req.query.force === 'true';
      // Body parsen für Custom Dates
      const { startDate, endDate } = req.body || {};

      console.log('[API Route] /sync/toggl called with body:', req.body);

      const togglService = new TogglService(prisma);

      try {
          const result = await togglService.syncTogglEntries(force, startDate, endDate);
          return result;
      } catch (error) {
          req.log.error(error);
          return reply.code(500).send({ error: (error as Error).message });
      }
  });

  // Tempo Sync Route
  protectedRoutes.post<{ Querystring: { force: string }, Body: { startDate?: string, endDate?: string } }>('/sync/tempo', async (req, reply) => {
      const force = req.query.force === 'true';
      const { startDate, endDate } = req.body || {};

      const tempoService = new TempoService(prisma);

      try {
          const result = await tempoService.syncTempoEntries(force, startDate, endDate);
          return result;
      } catch (error) {
          req.log.error(error);
          return reply.code(500).send({ error: (error as Error).message });
      }
  });

  // Eintrag löschen
  protectedRoutes.delete<{ Params: { id: string } }>('/entries/:id', async (req, reply) => {
    const { id } = req.params;
    try {
      await prisma.timeEntry.delete({
        where: { id },
      });
      return { success: true };
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({ error: 'Could not delete entry' });
    }
  });

  // Eintrag aktualisieren
  protectedRoutes.put<{ Params: { id: string }; Body: { date: string; duration: number; project: string; description: string; source: string } }>('/entries/:id', async (req, reply) => {
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
    } catch (error) {
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
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
