import type { Metadata } from 'next';

import { DemoClient } from './DemoClient';

/*
 * A workbench for the shared UI, driven by a fake run. Not for visitors: noindex, and
 * there is no sitemap entry for it.
 */
export const metadata: Metadata = {
  title: 'Component demo',
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoClient />;
}
