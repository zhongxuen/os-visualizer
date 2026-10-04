import type { Metadata } from 'next';

import { SyncView } from '@/modules/sync';

export const metadata: Metadata = {
  title: 'Synchronisation',
  description:
    'Interleave two threads one micro-op at a time, watch an update get lost, fix it with a test-and-set mutex, and count every interleaving. Producer and consumer with semaphores.',
  alternates: { canonical: '/sync' },
};

export default function SyncPage() {
  return <SyncView />;
}
