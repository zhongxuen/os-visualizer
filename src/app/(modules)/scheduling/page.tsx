import type { Metadata } from 'next';

import { SchedulingView } from '@/modules/scheduling';

export const metadata: Metadata = {
  title: 'CPU Scheduling',
  description:
    'FCFS, SJF, SRTF, Priority, Round Robin and MLFQ, one tick at a time, with the reason for every scheduling decision.',
};

export default function SchedulingPage() {
  return <SchedulingView />;
}
