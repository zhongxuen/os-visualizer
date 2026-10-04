import type { Metadata } from 'next';

import { ReplacementView } from '@/modules/replacement';

export const metadata: Metadata = {
  title: 'Page Replacement',
  description:
    "Step through FIFO, LRU, OPT and Clock over a reference string, plot faults against frames and watch Belady's anomaly happen.",
  alternates: { canonical: '/replacement' },
};

export default function ReplacementPage() {
  return <ReplacementView />;
}
