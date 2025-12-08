import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const CACHE_FILE = path.join(__dirname, '../../tempo_cache.json');
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 Minuten

export class TempoService {
  constructor(private prisma: PrismaClient) {}

  async syncTempoEntries(forceRefresh = false, customStart?: string, customEnd?: string) {
    const token = process.env.TEMPO_API_TOKEN;
    if (!token) throw new Error('TEMPO_API_TOKEN is missing in .env');

    let entries: any[] = [];
    let usedCache = false;

    // 1. Cache Prüfung (Analog zu Toggl)
    const isCustomSync = !!customStart && !!customEnd;
    const cacheExists = await this.fileExists(CACHE_FILE);

    if (cacheExists && !forceRefresh && !isCustomSync) {
        const stats = await fs.stat(CACHE_FILE);
        const age = Date.now() - stats.mtimeMs;
        if (age < CACHE_DURATION_MS) {
             console.log('[Tempo] Using cached data');
             const fileContent = await fs.readFile(CACHE_FILE, 'utf-8');
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
            startDateStr = customStart!;
            endDateStr = customEnd!;
        } else {
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
            const response = await axios.get('https://api.tempo.io/4/worklogs', {
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
                await fs.writeFile(CACHE_FILE, JSON.stringify(entries, null, 2));
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
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
    for (const entry of entries) {
        const durationHours = entry.timeSpentSeconds / 3600;

        // ROBUSTERE ABFRAGE:
        // Wir prüfen verschiedene Orte, wo der Key liegen könnte
        let issueKey = 'Unknown Issue';

        if (entry.issue && entry.issue.key) {
            issueKey = entry.issue.key;
        } else if (entry.issue && entry.issue.id) {
            // Fallback: Wenn Key fehlt, nehmen wir die ID (aus deinem Log: 24990)
            issueKey = `Issue #${entry.issue.id}`;
        }

        // Falls Description fehlt, nutzen wir den Kommentar (Tempo nennt das oft 'comment')
        const description = entry.description || entry.comment || ''; 

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
                project: issueKey,
                date: new Date(entry.startDate)
            },
            create: {
                source: 'TEMPO',
                externalId: entry.tempoWorklogId.toString(),
                date: new Date(entry.startDate),
                duration: durationHours,
                project: issueKey,
                description: description
            }
        });
        count++;
    }

    return { 
        count, 
        cached: usedCache, 
        message: usedCache ? 'Geladen aus Cache' : 'Frisch von Tempo API geladen' 
    };
  }

  private async fileExists(path: string): Promise<boolean> {
      try { await fs.access(path); return true; } catch { return false; }
  }
}
