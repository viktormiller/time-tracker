/**
 * Calculate duration in hours from start and end times
 * @param startTime - Time in HH:mm format (e.g., "09:00")
 * @param endTime - Time in HH:mm format (e.g., "11:30")
 * @returns Duration in hours as a decimal number
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  const durationMinutes = endMinutes - startMinutes;
  return durationMinutes / 60; // Return hours as decimal
}

/**
 * Format duration for display
 * @param hours - Duration in hours
 * @returns Formatted string (e.g., "2.5h" or "45min")
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}min`;
  }
  return `${hours.toFixed(2)}h`;
}
