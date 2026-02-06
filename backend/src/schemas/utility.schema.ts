import { z } from 'zod';

export const createMeterSchema = z.object({
  type: z.enum(['STROM', 'GAS', 'WASSER_WARM']),
  name: z.string().min(1, 'Meter name is required').max(100),
  unit: z.string().min(1, 'Unit is required'),
  location: z.string().max(200).optional(),
});

export const updateMeterSchema = z.object({
  type: z.enum(['STROM', 'GAS', 'WASSER_WARM']).optional(),
  name: z.string().min(1, 'Meter name is required').max(100).optional(),
  unit: z.string().min(1, 'Unit is required').optional(),
  location: z.string().max(200).optional(),
});

export const createReadingSchema = z.object({
  meterId: z.string().uuid('Invalid meter ID'),
  readingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  value: z.number().nonnegative('Reading value must be non-negative'),
  notes: z.string().max(500).optional(),
});

export const updateReadingSchema = z.object({
  readingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
  value: z.number().nonnegative('Reading value must be non-negative').optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type CreateMeterInput = z.infer<typeof createMeterSchema>;
export type UpdateMeterInput = z.infer<typeof updateMeterSchema>;
export type CreateReadingInput = z.infer<typeof createReadingSchema>;
export type UpdateReadingInput = z.infer<typeof updateReadingSchema>;
