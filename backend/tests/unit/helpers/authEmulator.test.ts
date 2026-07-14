describe('authEmulator helpers: bounded emulator fetch timeout', () => {
  const originalFetch = global.fetch;
  const originalTimeoutEnv = process.env.EMULATOR_FETCH_TIMEOUT_MS;

  beforeEach(() => {
    jest.resetModules();
    // Small value so a genuinely-hanging fetch aborts almost immediately in
    // this test, instead of waiting for the real production default.
    process.env.EMULATOR_FETCH_TIMEOUT_MS = '50';
    // Mimics real fetch's AbortSignal behavior: the request never resolves
    // on its own, but does reject once its signal fires — a mock that just
    // returns an eternally-pending promise would never prove the signal is
    // actually wired up.
    global.fetch = jest.fn((_url: unknown, options?: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EMULATOR_FETCH_TIMEOUT_MS = originalTimeoutEnv;
  });

  it('getTestIdToken rejects within a bounded time when the Auth emulator never responds', async () => {
    const { getTestIdToken } = await import('../../helpers/authEmulator');

    await expect(getTestIdToken('some-uid')).rejects.toBeTruthy();
  });

  it('clearEmulatorUsers rejects within a bounded time when the Auth emulator never responds', async () => {
    const { clearEmulatorUsers } = await import('../../helpers/authEmulator');

    await expect(clearEmulatorUsers()).rejects.toBeTruthy();
  });

  it('clearEmulatorFirestore rejects within a bounded time when the Firestore emulator never responds', async () => {
    const { clearEmulatorFirestore } = await import('../../helpers/authEmulator');

    await expect(clearEmulatorFirestore()).rejects.toBeTruthy();
  });

  it('passes an AbortSignal to fetch so the call can actually be aborted', async () => {
    const { clearEmulatorUsers } = await import('../../helpers/authEmulator');

    await expect(clearEmulatorUsers()).rejects.toBeTruthy();

    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
});
