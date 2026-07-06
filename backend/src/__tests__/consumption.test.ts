import { describe, it, expect } from 'vitest';
import { proRateMonthly, proRateDaily, priceAt, shiftDayKey } from '../utils/consumption';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('proRateMonthly', () => {
  it('attributes an interval within one month to that month', () => {
    const map = proRateMonthly([
      { readingDate: d('2026-06-01'), value: 1000 },
      { readingDate: d('2026-06-30'), value: 1029 },
    ]);

    expect(map.size).toBe(1);
    expect(map.get('2026-5')).toBeCloseTo(29); // June = month index 5
  });

  it('splits a Jan 28 → Mar 3 interval across Jan/Feb/Mar by day share', () => {
    // 34 days total (2026 is not a leap year): 4 in Jan, 28 in Feb, 2 in Mar
    const map = proRateMonthly([
      { readingDate: d('2026-01-28'), value: 0 },
      { readingDate: d('2026-03-03'), value: 340 }, // 10 per day
    ]);

    expect(map.get('2026-0')).toBeCloseTo(40); // Jan 28–31
    expect(map.get('2026-1')).toBeCloseTo(280); // all of Feb
    expect(map.get('2026-2')).toBeCloseTo(20); // Mar 1–2
  });

  it('preserves the total consumption across months', () => {
    const map = proRateMonthly([
      { readingDate: d('2025-11-15'), value: 500 },
      { readingDate: d('2026-02-10'), value: 787.5 },
    ]);

    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(287.5);
    // spans years: Nov + Dec 2025, Jan + Feb 2026
    expect(Array.from(map.keys()).sort()).toEqual(['2025-10', '2025-11', '2026-0', '2026-1'].sort());
  });

  it('accumulates multiple reading pairs and multiple meters into the same map', () => {
    const map = new Map<string, number>();
    proRateMonthly(
      [
        { readingDate: d('2026-06-01'), value: 0 },
        { readingDate: d('2026-07-01'), value: 30 },
      ],
      map
    );
    proRateMonthly(
      [
        { readingDate: d('2026-06-11'), value: 100 },
        { readingDate: d('2026-06-21'), value: 150 },
      ],
      map
    );

    expect(map.get('2026-5')).toBeCloseTo(30 + 50);
  });

  it('ignores same-day duplicate dates and single readings', () => {
    expect(proRateMonthly([{ readingDate: d('2026-06-01'), value: 42 }]).size).toBe(0);
    expect(
      proRateMonthly([
        { readingDate: d('2026-06-01'), value: 42 },
        { readingDate: d('2026-06-01'), value: 42 },
      ]).size
    ).toBe(0);
  });
});

describe('proRateDaily', () => {
  it('spreads consumption evenly over the interval days', () => {
    const map = proRateDaily([
      { readingDate: d('2026-06-01'), value: 100 },
      { readingDate: d('2026-06-11'), value: 150 },
    ]);

    expect(map.size).toBe(10); // Jun 1–10, exclusive end
    expect(map.get('2026-06-01')).toBeCloseTo(5);
    expect(map.get('2026-06-10')).toBeCloseTo(5);
    expect(map.get('2026-06-11')).toBeUndefined();
  });
});

describe('priceAt', () => {
  const prices = [
    { pricePerUnit: 0.3, validFrom: d('2025-01-01') },
    { pricePerUnit: 0.35, validFrom: d('2026-04-01') },
  ];

  it('picks the latest price whose validFrom is on or before the day', () => {
    expect(priceAt(prices, '2025-06-15')).toBe(0.3);
    expect(priceAt(prices, '2026-04-01')).toBe(0.35);
    expect(priceAt(prices, '2026-12-31')).toBe(0.35);
  });

  it('returns null before any price is valid', () => {
    expect(priceAt(prices, '2024-12-31')).toBeNull();
    expect(priceAt([], '2026-01-01')).toBeNull();
  });
});

describe('shiftDayKey', () => {
  it('shifts across month and year boundaries', () => {
    expect(shiftDayKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28'); // 2026 is not a leap year
    expect(shiftDayKey('2026-07-06', -364)).toBe('2025-07-07');
  });
});
