import { z } from 'zod';

export const createPropertySchema = z.object({
  name: z.string().min(1, 'Property name is required').max(100),
  address: z.string().max(200).optional().nullable(),
  movedIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional().nullable(),
  movedOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional().nullable(),
});

export const updatePropertySchema = z.object({
  name: z.string().min(1, 'Property name is required').max(100).optional(),
  address: z.string().max(200).optional().nullable(),
  movedIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional().nullable(),
  movedOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional().nullable(),
});

export const createMeterSchema = z.object({
  type: z.enum(['STROM', 'GAS', 'WASSER_WARM']),
  name: z.string().min(1, 'Meter name is required').max(100),
  unit: z.string().min(1, 'Unit is required'),
  location: z.string().max(200).optional().nullable(),
  propertyId: z.string().uuid('Invalid property ID'),
});

export const updateMeterSchema = z.object({
  name: z.string().min(1, 'Meter name is required').max(100).optional(),
  location: z.string().max(200).optional().nullable(),
});

export const createReadingSchema = z.object({
  meterId: z.string().uuid('Invalid meter ID'),
  readingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  value: z.number().nonnegative('Reading value must be non-negative'),
  notes: z.string().max(500).optional().nullable(),
});

export const updateReadingSchema = z.object({
  readingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
  value: z.number().nonnegative('Reading value must be non-negative').optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateMeterInput = z.infer<typeof createMeterSchema>;
export type UpdateMeterInput = z.infer<typeof updateMeterSchema>;
export type CreateReadingInput = z.infer<typeof createReadingSchema>;
export type UpdateReadingInput = z.infer<typeof updateReadingSchema>;
