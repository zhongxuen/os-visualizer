import type { Metadata } from 'next';

import { CompareView } from '@/modules/compare';

export const metadata: Metadata = {
  title: 'Compare schedulers',
  description:
    'Run one workload under two to four CPU scheduling policies at once, on a shared time axis, with the best metric in each row marked.',
};

export default function ComparePage() {
  return <CompareView />;
}
