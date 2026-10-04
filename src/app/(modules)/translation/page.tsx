import type { Metadata } from 'next';

import { TranslationView } from '@/modules/translation';

export const metadata: Metadata = {
  title: 'Address Translation',
  description:
    'Split a virtual address, look it up in the TLB, walk a one- or two-level page table and form the physical address, one step at a time.',
  alternates: { canonical: '/translation' },
};

export default function TranslationPage() {
  return <TranslationView />;
}
