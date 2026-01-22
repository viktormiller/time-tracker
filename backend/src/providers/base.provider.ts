import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { TimeProvider, SyncOptions, SyncResult, RawTimeEntry } from './provider.interface';

const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export abstract class BaseTimeProvider implements TimeProvider {
  protected cacheFile: string;

  constructor(
    protected prisma: PrismaClient,
    protected providerName: string,
    cacheFileName: string
  ) {
    this.cacheFile = path.join(__dirname, '../../', cacheFileName);
  }

  abstract sync(options?: SyncOptions): Promise<SyncResult>;
  abstract validate(): Promise<boolean>;
  abstract fetchFromAPI(startDate: string, endDate: string): Promise<any[]>;
  abstract transformEntry(rawEntry: any): RawTimeEntry;

  getName(): string {
    return this.providerName;
  }

  getCachePath(): string {
    return this.cacheFile;
  }

  /**
   * Shared cache read logic
   */
  protected async readCache(): Promise<any[] | null> {
    const exists = await this.fileExists(this.cacheFile);
    if (!exists) return null;

    const stats = await fs.stat(this.cacheFile);
    const age = Date.now() - stats.mtimeMs;

    if (age < CACHE_DURATION_MS) {
      console.log(`[${this.providerName}] Using cached data`);
      const fileContent = await fs.readFile(this.cacheFile, 'utf-8');
      return JSON.parse(fileContent);
    }

    return null;
  }

  /**
   * Shared cache write logic
   */
  protected async writeCache(data: any[]): Promise<void> {
    console.log(`[${this.providerName}] Writing ${data.length} entries to cache: ${this.cacheFile}`);
    await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2));
  }

  /**
   * Shared upsert logic for time entries
   */
  protected async upsertEntries(entries: RawTimeEntry[]): Promise<number> {
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
  protected calculateDateRange(customStart?: string, customEnd?: string): { start: string; end: string } {
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

  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
