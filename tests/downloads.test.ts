import { describe, expect, it } from 'vitest';
import { fetchWeeklyDownloads } from '../src/registry';

describe('npm downloads lookup', () => {
  it('URL-encodes scoped package names as a single API path segment', async () => {
    let requestedUrl = '';
    const downloads = await fetchWeeklyDownloads('@babel/core', async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ downloads: 123_456 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    expect(requestedUrl).toBe('https://api.npmjs.org/downloads/point/last-week/%40babel%2Fcore');
    expect(downloads).toBe(123_456);
  });

  it('preserves ordinary unscoped package lookups', async () => {
    let requestedUrl = '';
    const downloads = await fetchWeeklyDownloads('vite', async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ downloads: 987_654 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    expect(requestedUrl).toBe('https://api.npmjs.org/downloads/point/last-week/vite');
    expect(downloads).toBe(987_654);
  });
});
