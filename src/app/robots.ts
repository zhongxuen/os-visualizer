import type { MetadataRoute } from 'next';

import { absoluteUrl, isProductionDeployment } from '@/lib/site';

/**
 * In production: crawl everything but `/demo`, a development playground with no
 * explanation around it. Anywhere else (previews, local builds): crawl nothing, because a
 * preview's hostname stops existing when its branch merges.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProductionDeployment()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/demo'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
