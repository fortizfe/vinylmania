import { describe, expect, it } from 'vitest';

import {
  bandForRating,
  formatRatingValue,
  isRatingVisible,
  presentRating,
} from '../../src/lib/releaseRating';

describe('releaseRating', () => {
  describe('bandForRating (FR-005/FR-006/FR-007, inclusive thresholds)', () => {
    it('maps 0.00 to the low band', () => {
      expect(bandForRating(0)).toBe('low');
    });

    it('maps 2.50 (inclusive upper bound) to the low band', () => {
      expect(bandForRating(2.5)).toBe('low');
    });

    it('maps 2.51 (inclusive lower bound) to the medium band', () => {
      expect(bandForRating(2.51)).toBe('medium');
    });

    it('maps 4.09 (inclusive upper bound) to the medium band', () => {
      expect(bandForRating(4.09)).toBe('medium');
    });

    it('maps 4.10 (inclusive lower bound) to the high band', () => {
      expect(bandForRating(4.1)).toBe('high');
    });

    it('maps 5.00 to the high band', () => {
      expect(bandForRating(5)).toBe('high');
    });
  });

  describe('formatRatingValue (compact one-decimal display)', () => {
    it('formats a two-decimal Discogs average to one decimal', () => {
      expect(formatRatingValue(4.19)).toBe('4.2');
    });

    it('keeps a trailing .0 for whole numbers', () => {
      expect(formatRatingValue(4)).toBe('4.0');
    });
  });

  describe('isRatingVisible (FR-008, omission rules)', () => {
    it('is false when the rating is absent', () => {
      expect(isRatingVisible(undefined)).toBe(false);
      expect(isRatingVisible(null)).toBe(false);
    });

    it('is false when the vote count is zero (unvoted release)', () => {
      expect(isRatingVisible({ average: 4.5, count: 0 })).toBe(false);
    });

    it('is false when the vote count is negative', () => {
      expect(isRatingVisible({ average: 4.5, count: -1 })).toBe(false);
    });

    it('is false when the average is outside the 0-5 range', () => {
      expect(isRatingVisible({ average: 5.1, count: 10 })).toBe(false);
      expect(isRatingVisible({ average: -0.1, count: 10 })).toBe(false);
    });

    it('is false when the average is not a finite number', () => {
      expect(isRatingVisible({ average: Number.NaN, count: 10 })).toBe(false);
    });

    it('is true for a valid, votable rating', () => {
      expect(isRatingVisible({ average: 4.19, count: 47 })).toBe(true);
    });

    // A search-result rating lookup that fails or exceeds the backend's
    // 2-second timeout (spec SC-006) simply never reaches the frontend as a
    // communityRating field — from this helper's perspective that is
    // indistinguishable from "no rating available" and is covered by the
    // absent-rating case above.
  });

  describe('presentRating (feature 019: always returns a presentation, never null)', () => {
    it('returns the unrated placeholder when the rating is absent', () => {
      expect(presentRating(undefined)).toEqual({ displayValue: '-', band: 'unrated' });
      expect(presentRating(null)).toEqual({ displayValue: '-', band: 'unrated' });
    });

    it('returns the unrated placeholder when the vote count is zero', () => {
      expect(presentRating({ average: 4.5, count: 0 })).toEqual({
        displayValue: '-',
        band: 'unrated',
      });
    });

    it('returns the unrated placeholder when the average is outside the 0-5 range', () => {
      expect(presentRating({ average: 5.1, count: 10 })).toEqual({
        displayValue: '-',
        band: 'unrated',
      });
      expect(presentRating({ average: -0.1, count: 10 })).toEqual({
        displayValue: '-',
        band: 'unrated',
      });
    });

    it('returns the unrated placeholder when the average is not a finite number', () => {
      expect(presentRating({ average: Number.NaN, count: 10 })).toEqual({
        displayValue: '-',
        band: 'unrated',
      });
    });

    it('returns a display value and band for a visible rating', () => {
      expect(presentRating({ average: 4.19, count: 47 })).toEqual({
        displayValue: '4.2',
        band: 'high',
      });
    });
  });
});
