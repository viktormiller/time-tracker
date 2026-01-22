import { PrismaClient } from '@prisma/client';

export interface SyncResult {
  count: number;
  cached: boolean;
  message: string;
  [key: string]: any; // Allow provider-specific metadata
}

export interface SyncOptions {
  forceRefresh?: boolean;
  customStart?: string;
  customEnd?: string;
}

export interface TimeProvider {
  /**
   * Sync entries from the provider's API to the database
   */
  sync(options?: SyncOptions): Promise<SyncResult>;

  /**
   * Validate provider configuration (e.g., API token)
   */
  validate(): Promise<boolean>;

  /**
   * Get the cache file path for this provider
   */
  getCachePath(): string;

  /**
   * Get provider name
   */
  getName(): string;
}

export interface RawTimeEntry {
  externalId: string;
  date: Date;
  duration: number; // in hours
  project?: string;
  description?: string;
}
