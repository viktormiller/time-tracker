import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { BaseTimeProvider } from './base.provider';
import { SyncOptions, SyncResult, RawTimeEntry } from './provider.interface';
import { loadSecret } from '../utils/secrets';

const CLOCKIFY_API = 'https://api.clockify.me/api/v1';
const PAGE_SIZE = 5000;

export class ClockifyProvider extends BaseTimeProvider {
  private projectCache: Map<string, string> = new Map();
  private workspaceId: string | null = null;
  private userId: string | null = null;

  constructor(prisma: PrismaClient) {
    super(prisma, 'CLOCKIFY', 'clockify_cache.json');
  }

  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const { forceRefresh = false, customStart, customEnd } = options;

    console.log(`[Clockify Service] Request: Force=${forceRefresh}, Start=${customStart}, End=${customEnd}`);

    await this.bootstrap();

    let rawEntries: any[] = [];
    let usedCache = false;

    const isCustomSync = !!customStart && !!customEnd && customStart !== '' && customEnd !== '';

    if (!forceRefresh && !isCustomSync) {
      const cachedData = await this.readCache();
      if (cachedData) {
        rawEntries = cachedData;
        usedCache = true;
      }
    }

    if (!usedCache) {
      console.log('[Clockify] Fetching fresh data from API...');
      const dateRange = this.calculateDateRange(customStart, customEnd);
      console.log(`[Clockify API] Querying Range: ${dateRange.start} to ${dateRange.end}`);
      rawEntries = await this.fetchFromAPI(dateRange.start, dateRange.end);

      if (!isCustomSync) {
        await this.writeCache(rawEntries);
      } else {
        console.log(`[Clockify] Custom sync - skipping cache write.`);
      }
    }

    const transformedEntries = rawEntries
      .filter(entry => entry?.timeInterval?.end) // skip running timers
      .map(entry => this.transformEntry(entry));

    const count = await this.upsertEntries(transformedEntries);

    return {
      count,
      cached: usedCache,
      message: usedCache ? 'Geladen aus Cache' : 'Frisch von API geladen'
    };
  }

  private async bootstrap(): Promise<void> {
    const token = this.requireToken();

    if (!this.workspaceId || !this.userId) {
      const me = await axios.get(`${CLOCKIFY_API}/user`, {
        headers: { 'X-Api-Key': token }
      });
      this.userId = me.data.id;
      this.workspaceId = me.data.activeWorkspace;
      console.log(`[Clockify] User ${this.userId} in workspace ${this.workspaceId}`);
    }

    if (this.projectCache.size === 0) {
      try {
        const projects = await axios.get(
          `${CLOCKIFY_API}/workspaces/${this.workspaceId}/projects`,
          {
            params: { 'page-size': PAGE_SIZE, archived: false },
            headers: { 'X-Api-Key': token }
          }
        );
        for (const p of projects.data || []) {
          this.projectCache.set(p.id, p.name);
        }
        console.log(`[Clockify] Loaded ${this.projectCache.size} project names`);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('[Clockify] Error fetching projects:', {
            status: error.response?.status,
            data: error.response?.data
          });
        } else {
          console.error('[Clockify] Error fetching projects:', error);
        }
      }
    }
  }

  async fetchFromAPI(startDate: string, endDate: string): Promise<any[]> {
    const token = this.requireToken();
    if (!this.workspaceId || !this.userId) {
      // sync() always calls bootstrap first, but this method is also part of the abstract contract
      await this.bootstrap();
    }

    const start = `${startDate}T00:00:00Z`;
    const end = `${endDate}T23:59:59Z`;

    const all: any[] = [];
    let page = 1;
    while (true) {
      try {
        const response = await axios.get(
          `${CLOCKIFY_API}/workspaces/${this.workspaceId}/user/${this.userId}/time-entries`,
          {
            params: { start, end, 'page-size': PAGE_SIZE, page },
            headers: { 'X-Api-Key': token }
          }
        );
        const batch: any[] = response.data || [];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        page++;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
          console.error('[Clockify API Error]', errorMsg);
          if (error.response?.status === 400) {
            throw new Error(`Clockify API Fehler (400): ${errorMsg}`);
          }
        }
        throw error;
      }
    }

    return all;
  }

  transformEntry(rawEntry: any): RawTimeEntry {
    const start = new Date(rawEntry.timeInterval.start);
    const end = new Date(rawEntry.timeInterval.end);
    const durationHours = parseIsoDurationHours(rawEntry.timeInterval.duration)
      ?? Math.max(0, (end.getTime() - start.getTime()) / 3600000);

    const projectName = rawEntry.projectId
      ? (this.projectCache.get(rawEntry.projectId) || `Proj-${rawEntry.projectId}`)
      : 'No Project';

    return {
      externalId: rawEntry.id.toString(),
      date: start,
      duration: durationHours,
      project: projectName,
      description: rawEntry.description || ''
    };
  }

  async validate(): Promise<boolean> {
    const token = loadSecret('clockify_api_token', { required: false });
    if (!token) return false;

    try {
      await axios.get(`${CLOCKIFY_API}/user`, {
        headers: { 'X-Api-Key': token }
      });
      return true;
    } catch {
      return false;
    }
  }

  private requireToken(): string {
    const token = loadSecret('clockify_api_token', { required: false });
    if (!token) throw new Error('CLOCKIFY_API_TOKEN not configured (check environment or Docker secrets)');
    return token;
  }
}

// Parse ISO-8601 duration (e.g. "PT2H30M15S") to decimal hours.
function parseIsoDurationHours(input: unknown): number | null {
  if (typeof input !== 'string') return null;
  const match = input.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return (Number(h) || 0) + (Number(m) || 0) / 60 + (Number(s) || 0) / 3600;
}
