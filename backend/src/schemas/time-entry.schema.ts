import { z } from 'zod';

// Schema for creating a manual time entry
export const createTimeEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:mm format'),
  description: z.string().optional(),
  project: z.string().optional(),
  timezone: z.string().optional() // User's timezone (IANA format like 'Asia/Seoul')
}).refine(
  (data) => {
    // Validate that endTime is after startTime
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime']
  }
);

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;

// Helper function to calculate duration in hours
export function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const durationMinutes = endMinutes - startMinutes;
  return durationMinutes / 60; // Return hours as decimal
}

// Helper function to generate a unique external ID for manual entries
export function generateManualExternalId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `MANUAL_${timestamp}_${random}`;
}
