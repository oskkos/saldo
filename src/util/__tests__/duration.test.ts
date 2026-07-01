import { describe, expect, test } from '@jest/globals';
import {
  durationToTimeRange,
  netMinutesFromTimes,
  timeToMinutes,
} from '../duration';
import { Date_Time } from '../dateFormatter';

const t = (s: string) => s as Date_Time;

describe('duration module', () => {
  describe('timeToMinutes', () => {
    test('converts a time to minutes past midnight', () => {
      expect(timeToMinutes(t('08:00'))).toBe(480);
      expect(timeToMinutes(t('00:00'))).toBe(0);
      expect(timeToMinutes(t('23:59'))).toBe(1439);
    });
  });

  describe('durationToTimeRange', () => {
    test('adds the duration to the default-start anchor', () => {
      expect(durationToTimeRange(t('08:00'), 450)).toEqual({
        from: '08:00',
        to: '15:30',
        overflow: false,
      });
    });

    test('adds the duration to an existing-from anchor', () => {
      expect(durationToTimeRange(t('09:15'), 480)).toEqual({
        from: '09:15',
        to: '17:15',
        overflow: false,
      });
    });

    test('flags overflow when the end crosses midnight', () => {
      expect(durationToTimeRange(t('20:00'), 450)).toEqual({
        from: '20:00',
        to: null,
        overflow: true,
      });
    });

    test('treats an end of exactly 24:00 as overflow', () => {
      expect(durationToTimeRange(t('08:00'), 16 * 60)).toEqual({
        from: '08:00',
        to: null,
        overflow: true,
      });
    });
  });

  describe('netMinutesFromTimes', () => {
    test('returns the raw span when no lunch break is subtracted', () => {
      expect(netMinutesFromTimes(t('08:00'), t('15:30'), false)).toBe(450);
    });

    test('subtracts the lunch break when flagged', () => {
      expect(netMinutesFromTimes(t('08:00'), t('16:00'), true)).toBe(450);
    });
  });
});
