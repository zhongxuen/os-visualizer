import { describe, expect, it } from 'vitest';

import { absoluteUrl, isProductionDeployment, LOCAL_SITE_URL, siteUrl } from './site';

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

describe('absoluteUrl and isProductionDeployment', () => {
  it('joins the origin and a path', () => {
    expect(
      absoluteUrl('/sync', { VERCEL_PROJECT_PRODUCTION_URL: 'osv.vercel.app' }),
    ).toBe('https://osv.vercel.app/sync');
    expect(absoluteUrl('learn', {})).toBe(`${LOCAL_SITE_URL}/learn`);
  });

  it('is production only on the production deployment', () => {
    expect(isProductionDeployment({ VERCEL_ENV: 'production' })).toBe(true);
    expect(isProductionDeployment({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(isProductionDeployment({})).toBe(false);
  });
});
