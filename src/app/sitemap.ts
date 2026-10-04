import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/site';
import { MODULES } from '@/modules/registry';

/**
 * Every URL worth crawling, derived from the registry rather than listed: a module that
 * flips to `ready` is in the sitemap the same build. `/demo` (a development playground)
 * is left out here and disallowed in `robots.ts`. No `lastModified`: nothing tracks the
 * commit that last touched each page, and the build time would claim every page changed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl('/'), changeFrequency: 'monthly', priority: 1 },
    ...MODULES.filter((m) => m.status === 'ready').map((m) => ({
      url: absoluteUrl(m.route),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: absoluteUrl('/learn'), changeFrequency: 'monthly', priority: 0.7 },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.5 },
  ];
}
