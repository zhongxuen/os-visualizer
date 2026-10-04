/**
 * The modelling conventions the translator follows, as data. The RulesPanel renders them;
 * `tests/fixtures/vm/rules.test.ts` has one test named after each id. Where textbooks or
 * real hardware differ, the rule says which convention was chosen.
 */

import type { CitationId } from '../citations/types';

export interface VmRule {
  id: string;
  text: string;
  detail?: string;
  citation: CitationId;
}

export const VM_RULES: readonly VmRule[] = [
  {
    id: 'vm.order.tlbFirst',
    text: 'The TLB is checked before the page table. A hit skips the page-table walk.',
    citation: 'ostep.19.1',
  },
  {
    id: 'vm.tlb.model',
    text: 'The TLB is fully associative and holds VPN → PFN plus the protection bits. There are no ASIDs: the TLB belongs to one process.',
    detail:
      'Real TLBs tag entries with an address-space ID so a context switch need not flush them (OSTEP §19.5).',
    citation: 'ostep.19.4',
  },
  {
    id: 'vm.tlb.fill',
    text: 'A miss fills the lowest empty TLB slot. When the TLB is full, LRU evicts the entry used least recently and FIFO the entry loaded first; a tie goes to the lowest slot.',
    citation: 'ostep.19.6',
  },
  {
    id: 'vm.tlb.none',
    text: 'A TLB of size 0 means no TLB: every access counts as a miss and walks the page table.',
    citation: 'ostep.19.1',
  },
  {
    id: 'vm.walk.hardware',
    text: 'The hardware walks the page table on a miss (a hardware-managed TLB, x86-style).',
    detail:
      'MIPS and other RISC machines trap to the OS instead (OSTEP §19.3); the memory references are the same.',
    citation: 'ostep.19.3',
  },
  {
    id: 'vm.pte.size',
    text: 'Page-table and page-directory entries are 4 bytes. Pages that are not listed in the page table are invalid.',
    citation: 'ostep.18.2',
  },
  {
    id: 'vm.pte.address',
    text: 'One level: PTE address = PTBR + VPN × 4. Two levels: PDE address = PDBR + directory index × 4, and PTE address = PDE.PFN × page size + table index × 4.',
    citation: 'ostep.18.4',
  },
  {
    id: 'vm.split.twoLevel',
    text: 'Two levels split the VPN: the low log2(page size / 4) bits index one page-table page, and the remaining high bits index the page directory.',
    citation: 'ostep.20.3',
  },
  {
    id: 'vm.fault.stop',
    text: 'An invalid PDE or PTE is an invalid-page fault, and a write to a read-only page is a protection fault. Either fault stops the access, and a fault never fills the TLB.',
    detail:
      'What the OS does next (swap the page in, or kill the process) is the page replacement module’s subject.',
    citation: 'ostep.19.1',
  },
  {
    id: 'vm.prot.hit',
    text: 'Protection is checked on a TLB hit too, against the protection bits cached in the entry.',
    citation: 'ostep.19.4',
  },
  {
    id: 'vm.bits.hardware',
    text: 'The hardware, not the OS, sets the accessed bit on every access that passes the checks, and the dirty bit on every such write, hits included. Setting them is not counted as a memory reference.',
    detail:
      'A real x86 TLB also caches the dirty bit and walks the table again on the first write to a clean page; the model leaves that walk out.',
    citation: 'ostep.18.3',
  },
  {
    id: 'vm.refs.count',
    text: 'Every memory reference is counted, page-table reads included: 1 on a TLB hit, levels + 1 on a miss, and on a fault only the reads made before it.',
    citation: 'ostep.18.5',
  },
];
