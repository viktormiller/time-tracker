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
    let entriesWithKeys = 0;
    let entriesWithFallback = 0;

    for (const entry of entries) {
        const durationHours = entry.timeSpentSeconds / 3600;

        // Extract issue key from Tempo API response
        // The Tempo API v4 response includes issue.key when available
        // Format: "ABC-27 - Project Name" for display in project column
        let issueKey = 'Unknown Issue';
        let projectName = '';

        if (entry.issue?.key) {
            issueKey = entry.issue.key;
            entriesWithKeys++;
            console.log(`[Tempo] Entry ${entry.tempoWorklogId}: Using issue key ${entry.issue.key}`);

            // If we also have project info, combine them
            if (entry.issue.project?.name) {
                projectName = entry.issue.project.name;
            }
        } else if (entry.issue?.id) {
            issueKey = `Issue #${entry.issue.id}`;
            entriesWithFallback++;
            console.log(`[Tempo] Entry ${entry.tempoWorklogId}: No key found, using ID ${entry.issue.id}`);
        }

        // Format for project column: "ABC-27 - Project Name" or just "ABC-27"
        const projectDisplay = projectName
            ? `${issueKey} - ${projectName}`
            : issueKey;

        // Falls Description fehlt, nutzen wir den Kommentar (Tempo nennt das oft 'comment')
        const description = entry.description || entry.comment || '';

        try {
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
                    project: projectDisplay,
                    date: new Date(entry.startDate)
                },
                create: {
                    source: 'TEMPO',
                    externalId: entry.tempoWorklogId.toString(),
                    date: new Date(entry.startDate),
                    duration: durationHours,
                    project: projectDisplay,
                    description: description
                }
            });
            count++;
        } catch (error: any) {
            if (error.code === 'P2002') {
                // Unique constraint violation - fail the operation
                const errMsg = `Duplicate entry detected: TEMPO/${entry.tempoWorklogId}. ` +
                    `Issue: ${issueKey}, Date: ${entry.startDate}`;
                console.error('[Tempo Sync Error]', errMsg);
                throw new Error(errMsg);
            }
            throw error;
        }
    }

    return {
        count,
        cached: usedCache,
        message: usedCache ? 'Geladen aus Cache' : 'Frisch von Tempo API geladen',
        issueKeysResolved: entriesWithKeys,
        issueKeysFallback: entriesWithFallback,
        jiraBaseUrl: process.env.JIRA_BASE_URL || null
    };
  }

  private async fileExists(path: string): Promise<boolean> {
      try { await fs.access(path); return true; } catch { return false; }
  }
}
