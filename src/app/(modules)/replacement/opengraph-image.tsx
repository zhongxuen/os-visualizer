import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '@/app/_og/card';
import { moduleBySlug } from '@/modules/registry';

const MODULE = moduleBySlug('replacement');

export const dynamic = 'force-static';
export const alt = `${MODULE.title}: ${MODULE.blurb}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return ogCard({
    eyebrow: `OS Visualizer · Module ${MODULE.number}`,
    title: MODULE.title,
    description: MODULE.blurb,
  });
}
