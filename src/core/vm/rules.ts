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
  /** The rule in plain words, for someone meeting it for the first time (G4). */
  plain?: string;
  /** What would change if a textbook or a real machine used the other convention (G4). */
  whyItMatters?: string;
  citation: CitationId;
}

export const VM_RULES: readonly VmRule[] = [
  {
    id: 'vm.order.tlbFirst',
    text: 'The TLB is checked before the page table. A hit skips the page-table walk.',
    plain:
      'The fast cache of recent translations (the TLB) is asked first; only if it doesn’t know does the hardware read the page table.',
    whyItMatters:
      'This is why a hit costs one memory reference and a miss two or three. Every textbook uses this order, so your counts should match.',
    citation: 'ostep.19.1',
  },
  {
    id: 'vm.tlb.model',
    text: 'The TLB is fully associative and holds VPN → PFN plus the protection bits. There are no ASIDs: the TLB belongs to one process.',
    detail:
      'Real TLBs tag entries with an address-space ID so a context switch need not flush them (OSTEP §19.5).',
    plain:
      'Any TLB entry can hold any page, and the TLB holds one program’s translations only.',
    whyItMatters:
      'With address-space IDs (ASIDs) a real TLB keeps its entries across a context switch; without them it is flushed. Within one program’s run, as here, the hits and misses are the same either way.',
    citation: 'ostep.19.4',
  },
  {
    id: 'vm.tlb.fill',
    text: 'A miss fills the lowest empty TLB slot. When the TLB is full, LRU evicts the entry used least recently and FIFO the entry loaded first; a tie goes to the lowest slot.',
    plain:
      'A new translation goes in the first free slot; when the TLB is full, the policy (LRU or FIFO) picks the entry to throw out.',
    whyItMatters:
      'Exercises sometimes number slots differently or replace at random. The slot a page lands in can then differ, but with the same policy the hits and misses do not.',
    citation: 'ostep.19.6',
  },
  {
    id: 'vm.tlb.none',
    text: 'A TLB of size 0 means no TLB: every access counts as a miss and walks the page table.',
    plain: 'With no TLB, every access reads the page table.',
    whyItMatters:
      'Some books call this case "TLB disabled" rather than size 0. The counts are the same: no hits at all.',
    citation: 'ostep.19.1',
  },
  {
    id: 'vm.walk.hardware',
    text: 'The hardware walks the page table on a miss (a hardware-managed TLB, x86-style).',
    detail:
      'MIPS and other RISC machines trap to the OS instead (OSTEP §19.3); the memory references are the same.',
    plain: 'On a miss the hardware itself reads the page table; the OS is not involved.',
    whyItMatters:
      'On MIPS-style machines the OS handles a miss in software instead. The memory references counted here stay the same, but a real software-managed TLB also pays for the trap.',
    citation: 'ostep.19.3',
  },
  {
    id: 'vm.pte.size',
    text: 'Page-table and page-directory entries are 4 bytes. Pages that are not listed in the page table are invalid.',
    plain:
      'Every page-table entry is 4 bytes, and a page missing from the table is not mapped.',
    whyItMatters:
      'If your book uses 8-byte entries (64-bit machines), every PTE address and every table size doubles, and a page of page table holds half as many entries.',
    citation: 'ostep.18.2',
  },
  {
    id: 'vm.pte.address',
    text: 'One level: PTE address = PTBR + VPN × 4. Two levels: PDE address = PDBR + directory index × 4, and PTE address = PDE.PFN × page size + table index × 4.',
    plain:
      'The entry for page n sits at the table’s start plus 4 bytes for each page before it.',
    whyItMatters:
      'This is the formula homework asks for. With a different entry size, swap the 4 for that size.',
    citation: 'ostep.18.4',
  },
  {
    id: 'vm.split.twoLevel',
    text: 'Two levels split the VPN: the low log2(page size / 4) bits index one page-table page, and the remaining high bits index the page directory.',
    plain:
      'With two levels, the page number is cut in two: the top part picks a directory entry, the bottom part picks an entry inside one page of the table.',
    whyItMatters:
      'The cut is placed so one page of page table fills exactly one page. A different entry size or page size moves the cut, so check the bit counts before comparing answers.',
    citation: 'ostep.20.3',
  },
  {
    id: 'vm.fault.stop',
    text: 'An invalid PDE or PTE is an invalid-page fault, and a write to a read-only page is a protection fault. Either fault stops the access, and a fault never fills the TLB.',
    detail:
      'What the OS does next (swap the page in, or kill the process) is the page replacement module’s subject.',
    plain:
      'If the page isn’t mapped, or a write hits a read-only page, the access stops with a fault and nothing is cached.',
    whyItMatters:
      'A real system usually retries the access once the OS has fixed the fault (by loading the page). This model stops at the fault, so a retry would be a separate access in your list.',
    citation: 'ostep.19.1',
  },
  {
    id: 'vm.prot.hit',
    text: 'Protection is checked on a TLB hit too, against the protection bits cached in the entry.',
    plain:
      'Even when the TLB knows the page, the read/write permission is still checked.',
    whyItMatters:
      'Without this check a write to read-only memory would slip through on a hit. A fault on a TLB hit is expected, not a bug.',
    citation: 'ostep.19.4',
  },
  {
    id: 'vm.bits.hardware',
    text: 'The hardware, not the OS, sets the accessed bit on every access that passes the checks, and the dirty bit on every such write, hits included. Setting them is not counted as a memory reference.',
    detail:
      'A real x86 TLB also caches the dirty bit and walks the table again on the first write to a clean page; the model leaves that walk out.',
    plain:
      'The hardware marks a page as used (and as changed, on a write) on every successful access, at no extra cost here.',
    whyItMatters:
      'A real x86 TLB walks the table again on the first write to a clean page; this model doesn’t, so its count can be one memory reference lower than a real machine’s.',
    citation: 'ostep.18.3',
  },
  {
    id: 'vm.refs.count',
    text: 'Every memory reference is counted, page-table reads included: 1 on a TLB hit, levels + 1 on a miss, and on a fault only the reads made before it.',
    plain:
      'Count every trip to memory: the page-table reads plus the data access itself.',
    whyItMatters:
      'Some books count only the data access, or only the page-table reads. Here a hit costs 1, a one-level miss 2 and a two-level miss 3.',
    citation: 'ostep.18.5',
  },
];
