import type { Metadata } from 'next';

import { DeadlockView } from '@/modules/deadlock';

export const metadata: Metadata = {
  title: 'Deadlock',
  description:
    "Build a resource-allocation graph, find the cycle, run the detection algorithm and Banker's algorithm step by step, then recover by terminating or preempting.",
  alternates: { canonical: '/deadlock' },
};

export default function DeadlockPage() {
  return <DeadlockView />;
}
