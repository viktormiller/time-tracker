import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';
import { calculateDuration, generateManualExternalId } from '../schemas/time-entry.schema';

// Helper to format date in UTC
const formatUTC = (date: Date) => formatInTimeZone(date, 'UTC', 'yyyy-MM-dd');

describe('Manual Entry API - Timezone Integration', () => {
  describe('POST /api/entries - Create Manual Entry', () => {
    it('should store Seoul time (11:00) as UTC correctly', () => {
      // Simulate what the backend does
      const timezone = 'Asia/Seoul';
      const date = '2026-01-22';
      const startTime = '11:00';
      const endTime = '11:30';

      // Backend receives this data from frontend
      const requestBody = {
        date,
        startTime,
        endTime,
        timezone,
        project: 'Test Project',
        description: 'Test Entry'
      };

      // Backend converts to UTC
      const localDateTime = `${requestBody.date}T${requestBody.startTime}:00`;
      const dateTime = fromZonedTime(localDateTime, timezone);

      // Verify UTC storage
      expect(dateTime.getUTCHours()).toBe(2);
      expect(dateTime.getUTCMinutes()).toBe(0);
      expect(formatUTC(dateTime)).toBe('2026-01-22');

      // Verify duration calculation
      const duration = calculateDuration(startTime, endTime);
      expect(duration).toBe(0.5);
    });

    it('should store Berlin time (15:00) as UTC correctly', () => {
      const timezone = 'Europe/Berlin';
      const date = '2026-01-22';
      const startTime = '15:00';
      const endTime = '17:00';

      const localDateTime = `${date}T${startTime}:00`;
      const dateTime = fromZonedTime(localDateTime, timezone);

      // 15:00 Berlin = 14:00 UTC (winter time, UTC+1)
      expect(dateTime.getUTCHours()).toBe(14);
      expect(dateTime.getUTCMinutes()).toBe(0);

      const duration = calculateDuration(startTime, endTime);
      expect(duration).toBe(2);
    });

    it('should handle cross-day entries correctly', () => {
      const timezone = 'America/Los_Angeles';
      const date = '2026-01-22';
      const startTime = '23:00';
      const endTime = '23:30';

      const localDateTime = `${date}T${startTime}:00`;
      const dateTime = fromZonedTime(localDateTime, timezone);

      // 23:00 LA = 07:00 UTC next day (LA is UTC-8 in winter)
      expect(formatUTC(dateTime)).toBe('2026-01-23');
      expect(dateTime.getUTCHours()).toBe(7);
    });

    it('should generate unique external IDs', () => {
      const id1 = generateManualExternalId();
      const id2 = generateManualExternalId();

      expect(id1).toMatch(/^MANUAL_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^MANUAL_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('PUT /api/entries/:id - Update Manual Entry', () => {
    it('should update Seoul time correctly when editing', () => {
      // Simulate existing entry stored in UTC
      const storedUtcDate = '2026-01-22T02:00:00Z'; // 11:00 Seoul time
      const timezone = 'Asia/Seoul';

      // User edits to 14:00 Seoul time
      const newStartTime = '14:00';
      const newEndTime = '15:30';
      const date = '2026-01-22';

      // Backend converts updated time to UTC
      const localDateTime = `${date}T${newStartTime}:00`;
      const updatedDateTime = fromZonedTime(localDateTime, timezone);

      // 14:00 Seoul = 05:00 UTC
      expect(updatedDateTime.getUTCHours()).toBe(5);
      expect(updatedDateTime.getUTCMinutes()).toBe(0);

      // Verify new duration
      const duration = calculateDuration(newStartTime, newEndTime);
      expect(duration).toBe(1.5);
    });

    it('should preserve timezone context when editing date', () => {
      const timezone = 'Europe/Berlin';

      // Original: Jan 22, 15:00 Berlin
      const originalDate = '2026-01-22';
      const originalTime = '15:00';

      // User changes date to Jan 23, keeps time 15:00
      const newDate = '2026-01-23';
      const newTime = '15:00';

      const originalUtc = fromZonedTime(`${originalDate}T${originalTime}:00`, timezone);
      const newUtc = fromZonedTime(`${newDate}T${newTime}:00`, timezone);

      // Both should be at 14:00 UTC, but different days
      expect(originalUtc.getUTCHours()).toBe(14);
      expect(newUtc.getUTCHours()).toBe(14);
      expect(formatUTC(originalUtc)).toBe('2026-01-22');
      expect(formatUTC(newUtc)).toBe('2026-01-23');
    });
  });

  describe('Display Conversion - UTC to User Timezone', () => {
    it('should display UTC time in Seoul timezone correctly', () => {
      // Entry stored as UTC: 02:00 on Jan 22
      const storedUtcDate = '2026-01-22T02:00:00.000Z';
      const timezone = 'Asia/Seoul';

      const utcDate = parseISO(storedUtcDate);
      const zonedDate = toZonedTime(utcDate, timezone);

      // Should display as 11:00 Seoul time
      expect(zonedDate.getHours()).toBe(11);
      expect(zonedDate.getMinutes()).toBe(0);
      expect(format(zonedDate, 'yyyy-MM-dd')).toBe('2026-01-22');
    });

    it('should display UTC time in Berlin timezone correctly', () => {
      // Same entry: 02:00 UTC on Jan 22
      const storedUtcDate = '2026-01-22T02:00:00.000Z';
      const timezone = 'Europe/Berlin';

      const utcDate = parseISO(storedUtcDate);
      const zonedDate = toZonedTime(utcDate, timezone);

      // Should display as 03:00 Berlin time (UTC+1)
      expect(zonedDate.getHours()).toBe(3);
      expect(zonedDate.getMinutes()).toBe(0);
      expect(format(zonedDate, 'yyyy-MM-dd')).toBe('2026-01-22');
    });

    it('should handle cross-day display correctly', () => {
      // Entry stored as UTC: 23:00 on Jan 22
      const storedUtcDate = '2026-01-22T23:00:00.000Z';
      const timezone = 'Asia/Seoul';

      const utcDate = parseISO(storedUtcDate);
      const zonedDate = toZonedTime(utcDate, timezone);

      // Should display as 08:00 on Jan 23 in Seoul
      expect(format(zonedDate, 'yyyy-MM-dd')).toBe('2026-01-23');
      expect(zonedDate.getHours()).toBe(8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle UTC timezone (no conversion)', () => {
      const timezone = 'UTC';
      const date = '2026-01-22';
      const startTime = '15:00';

      const localDateTime = `${date}T${startTime}:00`;
      const dateTime = fromZonedTime(localDateTime, timezone);

      expect(dateTime.getUTCHours()).toBe(15);
      expect(formatUTC(dateTime)).toBe('2026-01-22');
    });

    it('should handle partial hour timezones correctly', () => {
      // India is UTC+5:30
      const timezone = 'Asia/Kolkata';
      const date = '2026-01-22';
      const startTime = '14:30';

      const localDateTime = `${date}T${startTime}:00`;
      const dateTime = fromZonedTime(localDateTime, timezone);

      // 14:30 India = 09:00 UTC
      expect(dateTime.getUTCHours()).toBe(9);
      expect(dateTime.getUTCMinutes()).toBe(0);
    });

    it('should handle minimal duration entries', () => {
      const duration = calculateDuration('10:00', '10:15');
      expect(duration).toBe(0.25);
    });

    it('should handle full-day entries', () => {
      const duration = calculateDuration('00:00', '23:59');
      expect(duration).toBeCloseTo(23.98, 2);
    });
  });
});
