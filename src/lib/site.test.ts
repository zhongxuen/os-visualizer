import { describe, expect, it } from 'vitest';

import { LOCAL_SITE_URL, siteUrl } from './site';

describe('siteUrl', () => {
  it('prefers an explicit URL and adds a scheme', () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: 'osv.example.com/' })).toBe(
      'https://osv.example.com',
    );
  });

  it('falls back to the Vercel production host, then the deployment host', () => {
    expect(
      siteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: 'osv.vercel.app',
        VERCEL_URL: 'x.vercel.app',
      }),
    ).toBe('https://osv.vercel.app');
    expect(siteUrl({ VERCEL_URL: 'x.vercel.app' })).toBe('https://x.vercel.app');
  });

  it('defaults to localhost', () => {
    expect(siteUrl({})).toBe(LOCAL_SITE_URL);
  });
});
