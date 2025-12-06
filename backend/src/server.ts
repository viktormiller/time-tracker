import 'dotenv/config';
import { TogglService } from './services/toggl.service';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { TogglCsvAdapter } from './adapters/toggl-csv.adapter';
import { TempoCsvAdapter } from './adapters/tempo-csv.adapter';

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// Register plugins
app.register(cors, { origin: '*' }); // Allow frontend dev server
app.register(multipart);

// --- Routes ---

// 1. Get Aggregated Stats
app.get('/api/stats', async (request, reply) => {
  // Simple aggregation: Group by date
  // In a real app, you would add ?from=...&to=... query params here
  const entries = await prisma.timeEntry.findMany({
    orderBy: { date: 'desc' }
  });

  return entries;
});

// 2. Upload Endpoint
app.post('/api/upload', async (req, reply) => {
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
    // Avoid duplicates? 
    // Ideally we check if (source, externalId, date, duration) exists.
    // For MVP, we just insert. Cleaning duplicates is a future feature.
    await prisma.timeEntry.create({ data: entry });
    count++;
  }

  return { message: 'Import successful', imported: count, errors: result.errors };
});

// Toggl Sync Route
app.post<{ Querystring: { force: string }, Body: { startDate?: string, endDate?: string } }>('/api/sync/toggl', async (req, reply) => {
    const force = req.query.force === 'true';
    // Body parsen für Custom Dates
    const { startDate, endDate } = req.body || {};

    const togglService = new TogglService(prisma);

    try {
        const result = await togglService.syncTogglEntries(force, startDate, endDate);
        return result;
    } catch (error) {
        req.log.error(error);
        return reply.code(500).send({ error: (error as Error).message });
    }
});

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

// Eintrag löschen
app.delete<{ Params: { id: string } }>('/api/entries/:id', async (req, reply) => {
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
app.put<{ Params: { id: string }; Body: { date: string; duration: number; project: string; description: string; source: string } }>('/api/entries/:id', async (req, reply) => {
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

start();
