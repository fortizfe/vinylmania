describe('discogsCircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays closed under 5 strikes within the 30s window', async () => {
    const breaker = await import('../../src/discogs/discogsCircuitBreaker');

    for (let i = 0; i < 4; i += 1) {
      breaker.recordExhaustedFailure();
    }

    expect(breaker.shouldShortCircuit()).toBe(false);
  });

  it('trips to open on the 5th recordExhaustedFailure() within the window', async () => {
    const breaker = await import('../../src/discogs/discogsCircuitBreaker');

    for (let i = 0; i < 5; i += 1) {
      breaker.recordExhaustedFailure();
    }

    expect(breaker.shouldShortCircuit()).toBe(true);
  });

  it('does not trip when failures are spread outside the 30s window', async () => {
    const breaker = await import('../../src/discogs/discogsCircuitBreaker');

    for (let i = 0; i < 4; i += 1) {
      breaker.recordExhaustedFailure();
    }
    jest.advanceTimersByTime(31_000);
    breaker.recordExhaustedFailure();

    expect(breaker.shouldShortCircuit()).toBe(false);
  });

  it('transitions to half-open only after the 20s cooldown elapses', async () => {
    const breaker = await import('../../src/discogs/discogsCircuitBreaker');

    for (let i = 0; i < 5; i += 1) {
      breaker.recordExhaustedFailure();
    }
    expect(breaker.shouldShortCircuit()).toBe(true);

    jest.advanceTimersByTime(19_000);
    expect(breaker.shouldShortCircuit()).toBe(true);

    jest.advanceTimersByTime(1_500);
    expect(breaker.shouldShortCircuit()).toBe(false);
  });

  it('closes (resets strikes) when the half-open trial succeeds', async () => {
    const breaker = await import('../../src/discogs/discogsCircuitBreaker');

    for (let i = 0; i < 5; i += 1) {
      breaker.recordExhaustedFailure();
    }
    jest.advanceTimersByTime(20_001);
    expect(breaker.shouldShortCircuit()).toBe(false); // half-open, trial let through

    breaker.recordSuccess();

    // Closed again: 4 more strikes alone shouldn't trip it.
    for (let i = 0; i < 4; i += 1) {
      breaker.recordExhaustedFailure();
    }
    expect(breaker.shouldShortCircuit()).toBe(false);
  });

  it('reopens with a fresh cooldown when the half-open trial fails', async () => {
    const breaker = await import('../../src/discogs/discogsCircuitBreaker');

    for (let i = 0; i < 5; i += 1) {
      breaker.recordExhaustedFailure();
    }
    jest.advanceTimersByTime(20_001);
    expect(breaker.shouldShortCircuit()).toBe(false); // half-open, trial let through

    breaker.recordExhaustedFailure(); // trial failed

    expect(breaker.shouldShortCircuit()).toBe(true);
    jest.advanceTimersByTime(19_000);
    expect(breaker.shouldShortCircuit()).toBe(true);
    jest.advanceTimersByTime(1_500);
    expect(breaker.shouldShortCircuit()).toBe(false);
  });
});
