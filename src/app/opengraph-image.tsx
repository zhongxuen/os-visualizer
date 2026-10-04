import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '@/app/_og/card';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

/** The card for every route without its own: the home page, /learn and /about. */

export const dynamic = 'force-static';
export const alt = `${SITE_NAME}: ${SITE_DESCRIPTION}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return ogCard({
    eyebrow: 'Visualizer Series',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  });
}
