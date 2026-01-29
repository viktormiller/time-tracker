import { z } from 'zod';

export const createEstimateSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  name: z.string().min(1, 'Estimate name is required'),
  estimatedHours: z.number().positive('Estimated hours must be positive'),
  notes: z.string().optional(),
  projects: z.array(z.string()).min(1, 'At least one project must be linked'),
});

export const updateEstimateSchema = z.object({
  clientName: z.string().min(1, 'Client name is required').optional(),
  name: z.string().min(1, 'Estimate name is required').optional(),
  estimatedHours: z.number().positive('Estimated hours must be positive').optional(),
  notes: z.string().nullable().optional(),
  projects: z.array(z.string()).min(1, 'At least one project must be linked').optional(),
});

export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;
