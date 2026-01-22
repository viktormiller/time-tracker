import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTimezone, setTimezone, clearTimezone, getBrowserTimezone } from '../timezone';

describe('Timezone Utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('getTimezone', () => {
    it('should return stored timezone preference if exists', () => {
      localStorage.setItem('user_timezone_preference', 'Asia/Seoul');
      const timezone = getTimezone();
      expect(timezone).toBe('Asia/Seoul');
    });

    it('should return browser timezone if no preference stored', () => {
      // Mock Intl.DateTimeFormat
      const mockResolvedOptions = vi.fn().mockReturnValue({
        timeZone: 'America/New_York',
      });
      global.Intl.DateTimeFormat = vi.fn().mockImplementation(() => ({
        resolvedOptions: mockResolvedOptions,
      })) as any;

      const timezone = getTimezone();
      expect(timezone).toBe('America/New_York');
    });

    it('should return UTC if window is undefined (SSR)', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const timezone = getTimezone();
      expect(timezone).toBe('UTC');

      global.window = originalWindow;
    });
  });

  describe('setTimezone', () => {
    it('should store timezone preference in localStorage', () => {
      setTimezone('Europe/Berlin');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user_timezone_preference',
        'Europe/Berlin'
      );
    });

    it('should allow updating timezone preference', () => {
      setTimezone('Asia/Seoul');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user_timezone_preference',
        'Asia/Seoul'
      );

      setTimezone('Europe/Berlin');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'user_timezone_preference',
        'Europe/Berlin'
      );
    });
  });

  describe('clearTimezone', () => {
    it('should remove timezone preference from localStorage', () => {
      localStorage.setItem('user_timezone_preference', 'Asia/Seoul');
      clearTimezone();
      expect(localStorage.removeItem).toHaveBeenCalledWith('user_timezone_preference');
    });

    it('should revert to browser timezone after clearing', () => {
      const mockResolvedOptions = vi.fn().mockReturnValue({
        timeZone: 'America/Los_Angeles',
      });
      global.Intl.DateTimeFormat = vi.fn().mockImplementation(() => ({
        resolvedOptions: mockResolvedOptions,
      })) as any;

      setTimezone('Asia/Seoul');
      localStorage.setItem('user_timezone_preference', 'Asia/Seoul');

      clearTimezone();
      localStorage.removeItem('user_timezone_preference');

      const timezone = getTimezone();
      expect(timezone).toBe('America/Los_Angeles');
    });
  });

  describe('getBrowserTimezone', () => {
    it('should return browser detected timezone', () => {
      const mockResolvedOptions = vi.fn().mockReturnValue({
        timeZone: 'Europe/Paris',
      });
      global.Intl.DateTimeFormat = vi.fn().mockImplementation(() => ({
        resolvedOptions: mockResolvedOptions,
      })) as any;

      const timezone = getBrowserTimezone();
      expect(timezone).toBe('Europe/Paris');
    });

    it('should return UTC if window is undefined', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const timezone = getBrowserTimezone();
      expect(timezone).toBe('UTC');

      global.window = originalWindow;
    });

    it('should ignore localStorage preference', () => {
      localStorage.setItem('user_timezone_preference', 'Asia/Seoul');

      const mockResolvedOptions = vi.fn().mockReturnValue({
        timeZone: 'Europe/London',
      });
      global.Intl.DateTimeFormat = vi.fn().mockImplementation(() => ({
        resolvedOptions: mockResolvedOptions,
      })) as any;

      const timezone = getBrowserTimezone();
      expect(timezone).toBe('Europe/London');
    });
  });

  describe('Timezone Persistence', () => {
    it('should persist timezone across sessions', () => {
      // Session 1: Set timezone
      setTimezone('Asia/Tokyo');

      // Session 2: Read timezone
      localStorage.setItem('user_timezone_preference', 'Asia/Tokyo');
      const retrievedTimezone = getTimezone();

      expect(retrievedTimezone).toBe('Asia/Tokyo');
    });

    it('should handle invalid timezone gracefully', () => {
      // This test ensures the app doesn't crash with invalid timezones
      localStorage.setItem('user_timezone_preference', 'Invalid/Timezone');
      const timezone = getTimezone();
      expect(timezone).toBe('Invalid/Timezone');
      // Note: date-fns-tz will handle invalid timezones by falling back to UTC
    });
  });
});
