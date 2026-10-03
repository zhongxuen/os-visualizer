/**
 * Site identity and where this deployment thinks it lives.
 *
 * The absolute URL is resolved from the environment, in this order:
 *  1. NEXT_PUBLIC_SITE_URL -- an explicit custom domain.
 *  2. VERCEL_PROJECT_PRODUCTION_URL -- the production hostname, set on every Vercel
 *     deployment including previews, so a preview's canonical points at production.
 *  3. VERCEL_URL -- this specific deployment, before a production domain exists.
 *  4. http://localhost:3000 -- development and unit tests.
 */
export const SITE_NAME = 'OS Visualizer';

export const SITE_DESCRIPTION =
  'Operating system internals you can step through: CPU scheduling, address translation, page replacement and deadlock.';

export interface SiteEnv {
  readonly NEXT_PUBLIC_SITE_URL?: string | undefined;
  readonly VERCEL_PROJECT_PRODUCTION_URL?: string | undefined;
  readonly VERCEL_URL?: string | undefined;
  readonly [key: string]: string | undefined;
}

export const LOCAL_SITE_URL = 'http://localhost:3000';

function normalise(url: string): string {
  return url.replace(/\/+$/, '');
}

/** The origin this deployment should describe itself as, without a trailing slash. */
export function siteUrl(env: SiteEnv = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return normalise(/^https?:\/\//i.test(explicit) ? explicit : `https://${explicit}`);
  }

  const vercelHost =
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim() || '';
  if (vercelHost) return normalise(`https://${vercelHost}`);

  return LOCAL_SITE_URL;
}
