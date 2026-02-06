import 'dotenv/config';
import { ProviderFactory } from './providers/provider.factory';
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
import exportRoutes from './routes/export.routes';
import summaryRoutes from './routes/summary.routes';
import { estimateRoutes } from './routes/estimate.routes';
import { utilityRoutes } from './routes/utility.routes';
import { createTimeEntrySchema, calculateDuration, generateManualExternalId } from './schemas/time-entry.schema';
import { fromZonedTime } from 'date-fns-tz';

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

  // Register export routes
  protectedRoutes.register(exportRoutes);

  // Register summary routes
  protectedRoutes.register(summaryRoutes);

  // Register estimate routes
  protectedRoutes.register(estimateRoutes);

  // Register utility routes
  protectedRoutes.register(utilityRoutes);

  // Get Jira configuration for frontend
  protectedRoutes.get('/config/jira', async (request, reply) => {
    return {
      baseUrl: process.env.JIRA_BASE_URL || null,
      configured: !!process.env.JIRA_BASE_URL
    };
  });

  // Get provider status
  protectedRoutes.get('/providers/status', async (request, reply) => {
    const providers = ProviderFactory.getAllProviders(prisma);

    const statuses = await Promise.all(
      providers.map(async (provider) => {
        const name = provider.getName();

        // Validate provider configuration
        const isValid = await provider.validate();

        // Get entry count from database
        const entryCount = await prisma.timeEntry.count({
          where: { source: name }
        });

        // Get last sync time (most recent entry's createdAt)
        const lastEntry = await prisma.timeEntry.findFirst({
          where: { source: name },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        });

        return {
          name,
          configured: isValid,
          entryCount,
          lastSync: lastEntry?.createdAt || null
        };
      })
    );

    // Add manual entry status
    const manualCount = await prisma.timeEntry.count({
      where: { source: 'MANUAL' }
    });

    const lastManualEntry = await prisma.timeEntry.findFirst({
      where: { source: 'MANUAL' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    statuses.push({
      name: 'MANUAL',
      configured: true,
      entryCount: manualCount,
      lastSync: lastManualEntry?.createdAt || null
    });

    return { providers: statuses };
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
      const { startDate, endDate } = req.body || {};

      console.log('[API Route] /sync/toggl called with body:', req.body);

      const provider = ProviderFactory.getProvider('TOGGL', prisma);

      try {
          const result = await provider.sync({
            forceRefresh: force,
            customStart: startDate,
            customEnd: endDate
          });
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

      const provider = ProviderFactory.getProvider('TEMPO', prisma);

      try {
          const result = await provider.sync({
            forceRefresh: force,
            customStart: startDate,
            customEnd: endDate
          });
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
  protectedRoutes.put<{ Params: { id: string }; Body: { date: string; duration: number; project: string; description: string; source: string; startTime?: string; endTime?: string; timezone?: string } }>('/entries/:id', async (req, reply) => {
    const { id } = req.params;
    const { date, duration, project, description, source, startTime, endTime, timezone } = req.body;

    try {
      // For manual entries, recalculate duration if start/end times are provided
      let finalDuration = parseFloat(duration.toString());
      let dateTime = new Date(date);

      if (source === 'MANUAL' && startTime && endTime) {
        // Recalculate duration from times
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        finalDuration = (endMinutes - startMinutes) / 60;

        // Convert local time to UTC using the provided timezone
        const tz = timezone || 'UTC';
        const localDateTime = `${date}T${startTime}:00`;
        dateTime = fromZonedTime(localDateTime, tz);
      }

      const updated = await prisma.timeEntry.update({
        where: { id },
        data: {
          date: dateTime,
          duration: finalDuration,
          project,
          description,
          source,
          startTime: startTime || null,
          endTime: endTime || null
        },
      });
      return updated;
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({ error: 'Could not update entry' });
    }
  });

  // Create manual entry
  protectedRoutes.post('/entries', async (req, reply) => {
    try {
      // Validate request body
      const validatedData = createTimeEntrySchema.parse(req.body);

      // Calculate duration from start and end times
      const duration = calculateDuration(validatedData.startTime, validatedData.endTime);

      // Generate unique external ID
      const externalId = generateManualExternalId();

      // Combine date and start time in the user's timezone, then convert to UTC
      const timezone = validatedData.timezone || 'UTC';
      const localDateTime = `${validatedData.date}T${validatedData.startTime}:00`;
      const dateTime = fromZonedTime(localDateTime, timezone);

      // Create entry in database
      const entry = await prisma.timeEntry.create({
        data: {
          source: 'MANUAL',
          externalId,
          date: dateTime,
          duration,
          project: validatedData.project || null,
          description: validatedData.description || null,
          startTime: validatedData.startTime,
          endTime: validatedData.endTime
        }
      });

      return reply.code(201).send(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          error: 'Validation failed',
          details: error.errors
        });
      }
      req.log.error(error);
      return reply.code(500).send({ error: 'Could not create entry' });
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
