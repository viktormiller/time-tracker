import { describe, it, expect } from 'vitest';
import { calculateDuration } from '../duration';

describe('Duration Calculation', () => {
  describe('Standard work hours', () => {
    it('should calculate full workday (9-5) correctly', () => {
      const duration = calculateDuration('09:00', '17:00');
      expect(duration).toBe(8);
    });

    it('should calculate half day correctly', () => {
      const duration = calculateDuration('09:00', '13:00');
      expect(duration).toBe(4);
    });

    it('should calculate 1 hour correctly', () => {
      const duration = calculateDuration('10:00', '11:00');
      expect(duration).toBe(1);
    });
  });

  describe('Fractional hours', () => {
    it('should calculate 30 minutes correctly', () => {
      const duration = calculateDuration('11:00', '11:30');
      expect(duration).toBe(0.5);
    });

    it('should calculate 15 minutes correctly', () => {
      const duration = calculateDuration('14:00', '14:15');
      expect(duration).toBe(0.25);
    });

    it('should calculate 45 minutes correctly', () => {
      const duration = calculateDuration('09:15', '10:00');
      expect(duration).toBe(0.75);
    });

    it('should calculate 1.5 hours correctly', () => {
      const duration = calculateDuration('10:00', '11:30');
      expect(duration).toBe(1.5);
    });
  });

  describe('Irregular times', () => {
    it('should calculate duration with odd start time', () => {
      const duration = calculateDuration('09:17', '10:00');
      expect(duration).toBeCloseTo(0.72, 2);
    });

    it('should calculate duration with odd end time', () => {
      const duration = calculateDuration('10:00', '12:43');
      expect(duration).toBeCloseTo(2.72, 2);
    });

    it('should calculate duration with both odd times', () => {
      const duration = calculateDuration('09:17', '12:43');
      expect(duration).toBeCloseTo(3.43, 2);
    });
  });

  describe('Edge cases', () => {
    it('should calculate minimal duration (1 minute)', () => {
      const duration = calculateDuration('10:00', '10:01');
      expect(duration).toBeCloseTo(0.02, 2);
    });

    it('should calculate nearly full day', () => {
      const duration = calculateDuration('00:00', '23:59');
      expect(duration).toBeCloseTo(23.98, 2);
    });

    it('should handle midnight start', () => {
      const duration = calculateDuration('00:00', '08:00');
      expect(duration).toBe(8);
    });

    it('should handle late night end', () => {
      const duration = calculateDuration('20:00', '23:59');
      expect(duration).toBeCloseTo(3.98, 2);
    });
  });

  describe('Precision', () => {
    it('should maintain precision for small durations', () => {
      const duration = calculateDuration('10:00', '10:05');
      expect(duration).toBeCloseTo(0.08, 2);
    });

    it('should maintain precision for long durations', () => {
      const duration = calculateDuration('08:30', '18:45');
      expect(duration).toBe(10.25);
    });
  });
});
