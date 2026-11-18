import { describe, expect, it } from 'vitest';
import { fetchInfo } from '../src/registry';

const packument = {
  'dist-tags': { latest: '1.2.3' },
  time: { '1.2.3': '2026-11-01T00:00:00.000Z' },
};

describe('npm registry resilience', () => {
  it('retries rate limiting once the server permits it', async () => {
    let calls = 0;
    const result = await fetchInfo('example-package', async () => {
      calls++;
      if (calls === 1) return new Response('rate limited', { status: 429, headers: { 'retry-after': '0' } });
      return new Response(JSON.stringify(packument), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    expect(calls).toBe(2);
    expect(result).toMatchObject({ name: 'example-package', latest: '1.2.3' });
    expect(result.error).toBeUndefined();
  });

  it('retries transient gateway errors but stops after the bounded retry budget', async () => {
    let calls = 0;
    const result = await fetchInfo('example-package', async () => {
      calls++;
      return new Response('temporarily unavailable', { status: 503, headers: { 'retry-after': '0' } });
    });

    expect(calls).toBe(3);
    expect(result).toEqual({ name: 'example-package', error: 'network' });
  });

  it('does not retry a genuine missing package', async () => {
    let calls = 0;
    const result = await fetchInfo('missing-package', async () => {
      calls++;
      return new Response('not found', { status: 404 });
    });

    expect(calls).toBe(1);
    expect(result).toEqual({ name: 'missing-package', error: 'not-found' });
  });
});
