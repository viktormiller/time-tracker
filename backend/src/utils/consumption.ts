const MS_PER_DAY = 86_400_000;

/**
 * CO₂ emission estimates per consumed unit:
 * - STROM: German grid mix ≈ 0.363 kg CO₂/kWh (Umweltbundesamt, 2024)
 * - GAS:   ≈ 2.04 kg CO₂/m³ (≈ 10.15 kWh/m³ × 0.201 kg CO₂/kWh)
 * Warm water has no factor — its footprint depends on the heating system.
 */
export const CO2_FACTORS_KG_PER_UNIT: Record<string, number> = {
  STROM: 0.363,
  GAS: 2.04,
};

export interface PricePeriod {
  pricePerUnit: number;
  validFrom: Date;
}

const dayKey = (date: Date) => date.toISOString().split('T')[0];

/** Shifts a YYYY-MM-DD day key by a number of days (negative = back). */
export function shiftDayKey(key: string, days: number): string {
  return new Date(new Date(`${key}T00:00:00.000Z`).getTime() + days * MS_PER_DAY)
    .toISOString()
    .split('T')[0];
}

/**
 * Pro-rates the consumption of consecutive meter readings onto UTC calendar
 * days: each day in [prevDate, currDate) gets an equal share.
 *
 * Without pro-rating, the whole consumption between two readings would land
 * on the first reading's date — a Jan 28 → Mar 3 interval would credit
 * everything to January and show February as zero.
 *
 * Map keys are YYYY-MM-DD.
 */
export function proRateDaily(
  readings: { readingDate: Date; value: number }[],
  dailyMap: Map<string, number> = new Map()
): Map<string, number> {
  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const consumption = curr.value - prev.value;

    const start = Date.UTC(
      prev.readingDate.getUTCFullYear(),
      prev.readingDate.getUTCMonth(),
      prev.readingDate.getUTCDate()
    );
    const end = Date.UTC(
      curr.readingDate.getUTCFullYear(),
      curr.readingDate.getUTCMonth(),
      curr.readingDate.getUTCDate()
    );
    const totalDays = Math.round((end - start) / MS_PER_DAY);
    if (totalDays <= 0) continue;

    const perDay = consumption / totalDays;
    for (let t = start; t < end; t += MS_PER_DAY) {
      const key = dayKey(new Date(t));
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + perDay);
    }
  }

  return dailyMap;
}

/**
 * Pro-rated consumption summed per month. Map keys are `${year}-${month}`
 * with a 0-based month (matches the frontend's month index).
 */
export function proRateMonthly(
  readings: { readingDate: Date; value: number }[],
  monthlyMap: Map<string, number> = new Map()
): Map<string, number> {
  const daily = proRateDaily(readings);
  for (const [day, consumption] of daily) {
    const key = `${Number(day.slice(0, 4))}-${Number(day.slice(5, 7)) - 1}`;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + consumption);
  }
  return monthlyMap;
}

/**
 * The price applicable on a given day: the entry with the latest
 * validFrom <= day, or null if no price is valid yet on that day.
 */
export function priceAt(prices: PricePeriod[], day: string): number | null {
  let result: number | null = null;
  let resultFrom = '';
  for (const price of prices) {
    const from = dayKey(price.validFrom);
    if (from <= day && from >= resultFrom) {
      result = price.pricePerUnit;
      resultFrom = from;
    }
  }
  return result;
}
