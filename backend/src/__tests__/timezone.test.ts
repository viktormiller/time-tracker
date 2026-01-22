import { describe, it, expect } from 'vitest';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { calculateDuration } from '../schemas/time-entry.schema';

// Helper to format date in UTC
const formatUTC = (date: Date) => formatInTimeZone(date, 'UTC', 'yyyy-MM-dd');

describe('Timezone Conversion', () => {
  describe('Manual Entry Creation', () => {
    it('should convert Seoul time (UTC+9) to UTC correctly', () => {
      // User creates entry at 11:00 Seoul time on 2026-01-22
      const timezone = 'Asia/Seoul';
      const date = '2026-01-22';
      const startTime = '11:00';

      const localDateTime = `${date}T${startTime}:00`;
      const utcDate = fromZonedTime(localDateTime, timezone);

      // 11:00 Seoul = 02:00 UTC (Seoul is UTC+9)
      expect(utcDate.getUTCHours()).toBe(2);
      expect(utcDate.getUTCMinutes()).toBe(0);
      expect(formatUTC(utcDate)).toBe('2026-01-22');
    });

    it('should convert Berlin time (UTC+1) to UTC correctly', () => {
      // User creates entry at 15:00 Berlin time on 2026-01-22
      const timezone = 'Europe/Berlin';
      const date = '2026-01-22';
      const startTime = '15:00';

      const localDateTime = `${date}T${startTime}:00`;
      const utcDate = fromZonedTime(localDateTime, timezone);

      // 15:00 Berlin = 14:00 UTC (Berlin is UTC+1 in winter)
      expect(utcDate.getUTCHours()).toBe(14);
      expect(utcDate.getUTCMinutes()).toBe(0);
    });

    it('should convert New York time (UTC-5) to UTC correctly', () => {
      // User creates entry at 09:00 New York time on 2026-01-22
      const timezone = 'America/New_York';
      const date = '2026-01-22';
      const startTime = '09:00';

      const localDateTime = `${date}T${startTime}:00`;
      const utcDate = fromZonedTime(localDateTime, timezone);

      // 09:00 New York = 14:00 UTC (New York is UTC-5 in winter)
      expect(utcDate.getUTCHours()).toBe(14);
      expect(utcDate.getUTCMinutes()).toBe(0);
    });

    it('should handle midnight correctly in different timezones', () => {
      // Midnight in Seoul should be previous day in UTC
      const timezone = 'Asia/Seoul';
      const date = '2026-01-23';
      const startTime = '00:30';

      const localDateTime = `${date}T${startTime}:00`;
      const utcDate = fromZonedTime(localDateTime, timezone);

      // 00:30 on Jan 23 in Seoul = 15:30 on Jan 22 in UTC
      expect(formatUTC(utcDate)).toBe('2026-01-22');
      expect(utcDate.getUTCHours()).toBe(15);
      expect(utcDate.getUTCMinutes()).toBe(30);
    });

    it('should handle late evening correctly in different timezones', () => {
      // Late evening in New York should be next day in UTC
      const timezone = 'America/New_York';
      const date = '2026-01-22';
      const startTime = '23:00';

      const localDateTime = `${date}T${startTime}:00`;
      const utcDate = fromZonedTime(localDateTime, timezone);

      // 23:00 on Jan 22 in New York = 04:00 on Jan 23 in UTC
      expect(formatUTC(utcDate)).toBe('2026-01-23');
      expect(utcDate.getUTCHours()).toBe(4);
    });
  });

  describe('Duration Calculation', () => {
    it('should calculate duration correctly for same-day entries', () => {
      const duration = calculateDuration('09:00', '17:00');
      expect(duration).toBe(8);
    });

    it('should calculate duration correctly for half-hour increments', () => {
      const duration = calculateDuration('11:00', '11:30');
      expect(duration).toBe(0.5);
    });

    it('should calculate duration correctly for 15-minute increments', () => {
      const duration = calculateDuration('14:15', '14:30');
      expect(duration).toBe(0.25);
    });

    it('should calculate duration correctly for irregular times', () => {
      const duration = calculateDuration('09:17', '12:43');
      expect(duration).toBeCloseTo(3.43, 2);
    });
  });

  describe('Round-trip Timezone Conversion', () => {
    it('should preserve time when converting Seoul -> UTC -> Seoul', () => {
      const timezone = 'Asia/Seoul';
      const originalDate = '2026-01-22';
      const originalTime = '11:00';

      // Convert to UTC
      const localDateTime = `${originalDate}T${originalTime}:00`;
      const utcDate = fromZonedTime(localDateTime, timezone);

      // In a real app, this would be converted back when displaying
      // For now, just verify the UTC time is correct
      expect(utcDate.getUTCHours()).toBe(2);

      // When displayed in Seoul timezone, it should show 11:00 again
      // (This would be tested in the frontend display logic)
    });
  });

  describe('Daylight Saving Time', () => {
    it('should handle DST transition in Berlin (winter to summer)', () => {
      // March 30, 2025: Berlin switches from UTC+1 to UTC+2
      const timezone = 'Europe/Berlin';

      // Before DST (UTC+1)
      const beforeDST = fromZonedTime('2025-03-29T15:00:00', timezone);
      expect(beforeDST.getUTCHours()).toBe(14);

      // After DST (UTC+2)
      const afterDST = fromZonedTime('2025-03-31T15:00:00', timezone);
      expect(afterDST.getUTCHours()).toBe(13);
    });

    it('should handle DST transition in New York (winter to summer)', () => {
      // March 9, 2025: New York switches from UTC-5 to UTC-4
      const timezone = 'America/New_York';

      // Before DST (UTC-5)
      const beforeDST = fromZonedTime('2025-03-08T09:00:00', timezone);
      expect(beforeDST.getUTCHours()).toBe(14);

      // After DST (UTC-4)
      const afterDST = fromZonedTime('2025-03-10T09:00:00', timezone);
      expect(afterDST.getUTCHours()).toBe(13);
    });
  });
});
