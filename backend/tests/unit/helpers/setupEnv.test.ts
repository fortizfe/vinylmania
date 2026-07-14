import { applyTestEnvDefaults } from '../../helpers/setupEnv';

describe('setupEnv: REDIS_URL neutralization', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('blanks a real REDIS_URL already present in the environment before dotenv.config() can apply backend/.env', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    applyTestEnvDefaults();

    expect(process.env.REDIS_URL).toBe('');
  });

  it('leaves REDIS_URL blank (not undefined) when it was not set at all beforehand', () => {
    delete process.env.REDIS_URL;

    applyTestEnvDefaults();

    expect(process.env.REDIS_URL).toBe('');
  });
});
