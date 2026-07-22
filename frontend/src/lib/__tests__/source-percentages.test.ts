import { describe, expect, it } from 'vitest';
import { calculateSourcePercentages } from '../source-percentages';

describe('calculateSourcePercentages', () => {
  it('calculates rounded source shares for the current entries', () => {
    expect(calculateSourcePercentages([
      { source: 'CLOCKIFY', duration: 5 },
      { source: 'TEMPO', duration: 80 },
      { source: 'TOGGL', duration: 15 },
    ])).toEqual({
      TOGGL: 15,
      TEMPO: 80,
      CLOCKIFY: 5,
      MANUAL: 0,
    });
  });

  it('recalculates percentages from a filtered set of entries', () => {
    expect(calculateSourcePercentages([
      { source: 'TEMPO', duration: 80 },
      { source: 'TOGGL', duration: 20 },
    ])).toEqual({
      TOGGL: 20,
      TEMPO: 80,
      CLOCKIFY: 0,
      MANUAL: 0,
    });

    expect(calculateSourcePercentages([
      { source: 'TOGGL', duration: 20 },
    ])).toEqual({
      TOGGL: 100,
      TEMPO: 0,
      CLOCKIFY: 0,
      MANUAL: 0,
    });
  });

  it('returns zero percentages when the total duration is zero', () => {
    expect(calculateSourcePercentages([])).toEqual({
      TOGGL: 0,
      TEMPO: 0,
      CLOCKIFY: 0,
      MANUAL: 0,
    });
  });

  it('rounds each percentage to a whole number', () => {
    expect(calculateSourcePercentages([
      { source: 'TOGGL', duration: 1 },
      { source: 'TEMPO', duration: 2 },
    ])).toEqual({
      TOGGL: 33,
      TEMPO: 67,
      CLOCKIFY: 0,
      MANUAL: 0,
    });
  });
});
