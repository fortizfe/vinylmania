import {
  computePerDisc,
  computeValuation,
  type ReleaseSuggestions,
  type ValuationInstanceInput,
} from '../../../../src/domain/collectionStats/computeValuation';

/**
 * Feature 061, T036 (US2) — pure `computeValuation` / `computePerDisc` rules
 * (data-model §4). Table-driven; the module under test does not exist yet, so
 * this file MUST fail on first run (Constitution Principle I).
 */

let seq = 0;
function instance(
  overrides: Partial<ValuationInstanceInput> = {},
): ValuationInstanceInput {
  seq += 1;
  return {
    releaseId: overrides.releaseId ?? seq,
    instanceId: overrides.instanceId ?? seq * 100,
    title: overrides.title ?? `Release ${overrides.releaseId ?? seq}`,
    artist: overrides.artist ?? 'Some Artist',
    mediaCondition:
      overrides.mediaCondition === undefined ? 'Near Mint (NM or M-)' : overrides.mediaCondition,
  };
}

function suggestions(
  entries: Array<[number, ReleaseSuggestions]>,
): Map<number, ReleaseSuggestions> {
  return new Map(entries);
}

function attempted(...ids: number[]): Set<number> {
  return new Set(ids);
}

describe('computeValuation (feature 061, data-model §4)', () => {
  it('empty collection → all zeros, currency null, status complete', () => {
    const v = computeValuation([], new Map(), new Set());
    expect(v).toEqual({
      currency: null,
      estimatedTotal: 0,
      coveredCount: 0,
      totalCount: 0,
      uncovered: { noMarketData: 0, noCondition: 0 },
      topValuable: [],
      status: 'complete',
    });
  });

  it('picks the per-disc value at the instance media condition', () => {
    const instances = [instance({ releaseId: 1, mediaCondition: 'Very Good (VG)' })];
    const v = computeValuation(
      instances,
      suggestions([
        [
          1,
          {
            'Very Good (VG)': { currency: 'EUR', value: 4.95 },
            'Near Mint (NM or M-)': { currency: 'EUR', value: 12.4 },
          },
        ],
      ]),
      attempted(1),
    );
    expect(v.estimatedTotal).toBe(4.95);
    expect(v.coveredCount).toBe(1);
    expect(v.currency).toBe('EUR');
    expect(v.uncovered).toEqual({ noMarketData: 0, noCondition: 0 });
  });

  it('mediaCondition === null → no_condition, excluded, uncovered.noCondition++', () => {
    const instances = [instance({ releaseId: 1, mediaCondition: null })];
    const v = computeValuation(
      instances,
      suggestions([[1, { 'Near Mint (NM or M-)': { currency: 'EUR', value: 20 } }]]),
      attempted(1),
    );
    expect(v.coveredCount).toBe(0);
    expect(v.estimatedTotal).toBe(0);
    expect(v.uncovered).toEqual({ noMarketData: 0, noCondition: 1 });
    const perDisc = computePerDisc(instances, suggestions([[1, null]]), attempted(1));
    expect(perDisc[0]).toMatchObject({ value: null, reason: 'no_condition' });
  });

  it('release with no market data → no_market_data, excluded', () => {
    const instances = [instance({ releaseId: 1 })];
    const v = computeValuation(instances, suggestions([[1, null]]), attempted(1));
    expect(v.coveredCount).toBe(0);
    expect(v.uncovered).toEqual({ noMarketData: 1, noCondition: 0 });
  });

  it('release priced but the exact grade absent → no_market_data', () => {
    const instances = [instance({ releaseId: 1, mediaCondition: 'Mint (M)' })];
    const v = computeValuation(
      instances,
      suggestions([[1, { 'Very Good (VG)': { currency: 'EUR', value: 4 } }]]),
      attempted(1),
    );
    expect(v.coveredCount).toBe(0);
    expect(v.uncovered).toEqual({ noMarketData: 1, noCondition: 0 });
  });

  it('estimatedTotal is the 2-dp sum of covered values; coveredCount counts reason ok', () => {
    const instances = [
      instance({ releaseId: 1, mediaCondition: 'Near Mint (NM or M-)' }),
      instance({ releaseId: 2, mediaCondition: 'Very Good (VG)' }),
      instance({ releaseId: 3, mediaCondition: null }),
    ];
    const v = computeValuation(
      instances,
      suggestions([
        [1, { 'Near Mint (NM or M-)': { currency: 'EUR', value: 12.4 } }],
        [2, { 'Very Good (VG)': { currency: 'EUR', value: 4.95 } }],
        [3, null],
      ]),
      attempted(1, 2, 3),
    );
    expect(v.estimatedTotal).toBe(17.35);
    expect(v.coveredCount).toBe(2);
    expect(v.totalCount).toBe(3);
  });

  it('currency comes from the first suggestion seen; a later mismatch keeps the first', () => {
    const instances = [
      instance({ releaseId: 1, mediaCondition: 'Very Good (VG)' }),
      instance({ releaseId: 2, mediaCondition: 'Very Good (VG)' }),
    ];
    const v = computeValuation(
      instances,
      suggestions([
        [1, { 'Very Good (VG)': { currency: 'EUR', value: 10 } }],
        [2, { 'Very Good (VG)': { currency: 'USD', value: 10 } }],
      ]),
      attempted(1, 2),
    );
    expect(v.currency).toBe('EUR');
  });

  it('topValuable is desc by value and capped at 10', () => {
    const instances = Array.from({ length: 14 }, (_, i) =>
      instance({ releaseId: i + 1, mediaCondition: 'Very Good (VG)' }),
    );
    const v = computeValuation(
      instances,
      suggestions(
        instances.map((inst, i) => [
          inst.releaseId,
          { 'Very Good (VG)': { currency: 'EUR', value: (i + 1) * 5 } },
        ]),
      ),
      new Set(instances.map((i) => i.releaseId)),
    );
    expect(v.topValuable).toHaveLength(10);
    expect(v.topValuable[0].value).toBe(70);
    expect(v.topValuable[9].value).toBe(25);
    expect(v.topValuable.every((d) => d.reason === 'ok')).toBe(true);
  });

  it('values every instance of a repeated release independently', () => {
    const instances = [
      instance({ releaseId: 7, instanceId: 1, mediaCondition: 'Near Mint (NM or M-)' }),
      instance({ releaseId: 7, instanceId: 2, mediaCondition: 'Very Good (VG)' }),
    ];
    const v = computeValuation(
      instances,
      suggestions([
        [
          7,
          {
            'Near Mint (NM or M-)': { currency: 'EUR', value: 30 },
            'Very Good (VG)': { currency: 'EUR', value: 12 },
          },
        ],
      ]),
      attempted(7),
    );
    expect(v.coveredCount).toBe(2);
    expect(v.estimatedTotal).toBe(42);
    expect(v.totalCount).toBe(2);
  });

  describe('status transitions', () => {
    const instances = [
      instance({ releaseId: 1, mediaCondition: 'Very Good (VG)' }),
      instance({ releaseId: 2, mediaCondition: 'Very Good (VG)' }),
    ];
    const sugg = suggestions([
      [1, { 'Very Good (VG)': { currency: 'EUR', value: 10 } }],
      [2, { 'Very Good (VG)': { currency: 'EUR', value: 10 } }],
    ]);

    it("partial while not every instance has been attempted", () => {
      expect(computeValuation(instances, sugg, attempted(1)).status).toBe('partial');
    });

    it('complete once every instance has been attempted', () => {
      expect(computeValuation(instances, sugg, attempted(1, 2)).status).toBe('complete');
    });

    it('unavailable when an outage happened before any disc was priced', () => {
      expect(
        computeValuation(instances, new Map(), new Set(), { outage: true }).status,
      ).toBe('unavailable');
    });

    it('stays partial on an outage once some discs are already priced', () => {
      expect(
        computeValuation(instances, suggestions([[1, { 'Very Good (VG)': { currency: 'EUR', value: 10 } }]]), attempted(1), {
          outage: true,
        }).status,
      ).toBe('partial');
    });
  });

  it('computePerDisc returns one row per attempted instance with title/artist', () => {
    const instances = [
      instance({ releaseId: 1, title: 'Tago Mago', artist: 'Can', mediaCondition: 'Very Good (VG)' }),
      instance({ releaseId: 2, title: 'Future Days', artist: 'Can', mediaCondition: null }),
    ];
    const perDisc = computePerDisc(
      instances,
      suggestions([
        [1, { 'Very Good (VG)': { currency: 'EUR', value: 8 } }],
        [2, null],
      ]),
      attempted(1, 2),
    );
    expect(perDisc).toEqual([
      {
        releaseId: 1,
        instanceId: instances[0].instanceId,
        title: 'Tago Mago',
        artist: 'Can',
        mediaCondition: 'Very Good (VG)',
        value: 8,
        reason: 'ok',
      },
      {
        releaseId: 2,
        instanceId: instances[1].instanceId,
        title: 'Future Days',
        artist: 'Can',
        mediaCondition: null,
        value: null,
        reason: 'no_condition',
      },
    ]);
  });

  it('excludes not-yet-attempted instances from perDisc and the uncovered counts', () => {
    const instances = [
      instance({ releaseId: 1, mediaCondition: 'Very Good (VG)' }),
      instance({ releaseId: 2, mediaCondition: null }),
    ];
    const v = computeValuation(
      instances,
      suggestions([[1, { 'Very Good (VG)': { currency: 'EUR', value: 10 } }]]),
      attempted(1),
    );
    expect(v.uncovered).toEqual({ noMarketData: 0, noCondition: 0 });
    expect(v.totalCount).toBe(2);
    expect(computePerDisc(instances, new Map(), attempted(1))).toHaveLength(1);
  });
});
