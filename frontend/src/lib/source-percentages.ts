export const TIME_ENTRY_SOURCES = ['TOGGL', 'TEMPO', 'CLOCKIFY', 'MANUAL'] as const;

export type TimeEntrySource = (typeof TIME_ENTRY_SOURCES)[number];

interface SourceDuration {
  source: string;
  duration: number;
}

const isTimeEntrySource = (source: string): source is TimeEntrySource =>
  TIME_ENTRY_SOURCES.some(candidate => candidate === source);

export function calculateSourcePercentages(
  entries: readonly SourceDuration[],
): Record<TimeEntrySource, number> {
  const totals: Record<TimeEntrySource, number> = {
    TOGGL: 0,
    TEMPO: 0,
    CLOCKIFY: 0,
    MANUAL: 0,
  };

  let totalDuration = 0;

  entries.forEach(entry => {
    totalDuration += entry.duration;
    if (isTimeEntrySource(entry.source)) {
      totals[entry.source] += entry.duration;
    }
  });

  if (totalDuration === 0) {
    return totals;
  }

  return {
    TOGGL: Math.round((totals.TOGGL / totalDuration) * 100),
    TEMPO: Math.round((totals.TEMPO / totalDuration) * 100),
    CLOCKIFY: Math.round((totals.CLOCKIFY / totalDuration) * 100),
    MANUAL: Math.round((totals.MANUAL / totalDuration) * 100),
  };
}
