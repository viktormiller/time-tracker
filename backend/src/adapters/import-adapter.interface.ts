import { TimeEntry } from '@prisma/client';

export interface ImportResult {
  entries: Omit<TimeEntry, 'id' | 'createdAt'>[];
  errors: string[];
}

export interface ImportAdapter {
  parse(fileContent: string): Promise<ImportResult>;
}
