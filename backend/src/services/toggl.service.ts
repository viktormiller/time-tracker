import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const CACHE_FILE = path.join(__dirname, '../../toggl_cache.json');
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 Minuten Cache

export class TogglService {
  constructor(private prisma: PrismaClient) {}

  // Neue Signatur: akzeptiert optionale Start/End-Strings (YYYY-MM-DD)
  async syncTogglEntries(forceRefresh = false, customStart?: string, customEnd?: string) {
    const token = process.env.TOGGL_API_TOKEN;
    if (!token) throw new Error('TOGGL_API_TOKEN is missing in .env');

    let entries = [];
    let usedCache = false;


    // Cache-Logik nur nutzen, wenn KEINE speziellen Daten angefordert wurden.
    // Wenn der User einen Zeitraum vorgibt, wollen wir immer frisch laden.
    const isCustomSync = !!customStart && !!customEnd;

    // 1. Prüfen ob Cache existiert und gültig ist
    const cacheExists = await this.fileExists(CACHE_FILE);

    if (cacheExists && !forceRefresh && !isCustomSync) {
        const stats = await fs.stat(CACHE_FILE);
        const age = Date.now() - stats.mtimeMs;

        if (age < CACHE_DURATION_MS) {
             console.log('[Toggl] Using cached data');
             const fileContent = await fs.readFile(CACHE_FILE, 'utf-8');
             entries = JSON.parse(fileContent);
             usedCache = true;
        }
    }

    // 2. Falls kein Cache, API abrufen
    if (!usedCache) {
        console.log('[Toggl] Fetching fresh data from API...');

        // Standard: Letzte 3 Monate bis Morgen
        let startDateStr = '';
        let endDateStr = '';

        if (isCustomSync) {
            startDateStr = customStart!;
            endDateStr = customEnd!;
        } else {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 1);
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 3);

            startDateStr = startDate.toISOString().split('T')[0];
            endDateStr = endDate.toISOString().split('T')[0];
        }

        const params = {
            start_date: startDateStr,
            end_date: endDateStr
        };

        const response = await axios.get('https://api.track.toggl.com/api/v9/me/time_entries', {
            params,
            headers: {
                Authorization: `Basic ${Buffer.from(`${token}:api_token`).toString('base64')}`,
                'Content-Type': 'application/json'
            }
        });

        entries = response.data;


        // Cache nur aktualisieren, wenn es der Standard-Sync war
        if (!isCustomSync) {
            await fs.writeFile(CACHE_FILE, JSON.stringify(entries, null, 2));
        }
    }

    // 3. Daten in DB speichern (Upsert)
    let count = 0;
    for (const entry of entries) {
        // Toggl liefert Duration in Sekunden (manchmal negativ für laufende Timer)
        if (entry.duration < 0) continue; // Laufende Timer ignorieren

        const durationHours = entry.duration / 3600;

        // Das Projekt müssen wir uns ggf. mühsam suchen, Toggl liefert hier nur project_id.
        // Fürs erste nehmen wir die project_id oder "No Project". 
        // (In einer V2 könnte man Projekte separat fetchen und mappen).
        const projectName = entry.project_id ? `Proj-${entry.project_id}` : 'No Project'; 
        // Tipp: Wenn du den Projektnamen willst, braucht man einen extra API Call "/me/projects". 
        // Um Calls zu sparen, lassen wir das erst mal so, oder nutzen Tags.

        await this.prisma.timeEntry.upsert({
            where: {
                source_externalId: {
                    source: 'TOGGL',
                    externalId: entry.id.toString()
                }
            },
            update: {
                duration: durationHours,
                description: entry.description,
                project: projectName, // Siehe Hinweis oben
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

    return { 
        count, 
        cached: usedCache, 
        message: usedCache ? 'Geladen aus Cache' : 'Frisch von API geladen' 
    };
  }

  private async fileExists(path: string): Promise<boolean> {
      try {
          await fs.access(path);
          return true;
      } catch {
          return false;
      }
  }
}
