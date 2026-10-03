# 06 — Module 3: Address translation

Wave: **W2** (6.core), **W3** (6.ui) · Estimate: 4 days · Original plan: phase 2 (first half)

## Goal

Type a virtual address and follow it to a physical one: split into VPN and offset, look it
up in the TLB, walk a one- or two-level page table, check the valid and protection bits,
and form the physical address. Run a sequence of accesses to see the TLB hit rate and the
memory references each access costs. A size calculator shows why multi-level page tables
exist.

## Prerequisites

02 for the core prompt. 03 for the UI prompt.

---

## Deliverables

```
src/core/vm/
  config.ts          Zod schema: address bits, page size, levels, TLB size/policy, PTE size
  memory.ts          the page table(s) as data; build from a compact mapping list
  tlb.ts             fully associative TLB with LRU or FIFO replacement
  translate.ts       translate(config, tables, accesses[]) => SimResult<VmEvent>
  sizing.ts          linear vs two-level page-table size for a given address-space layout
  presets.ts  events.ts  citations.ts  scenarios.ts  state.ts  rules.ts  index.ts
tests/fixtures/vm/*.test.ts
tests/oracle/vm.test.ts
src/modules/translation/         ConfigPanel, PageTableView, TlbView, AccessList, SizingPanel
src/app/(modules)/translation/page.tsx
```

---

## Steps

### 1. Model

- Virtual address bits 6–16, physical bits 6–16, page size a power of two with at least
  one VPN bit. Levels 1 or 2 (two-level splits the VPN into page-directory index + page-
  table index, OSTEP §20.3). PTE size 4 bytes. PTBR (page-table base register) shown.
- PTE: `valid`, `pfn`, `prot: 'r' | 'rw'`, `accessed`, `dirty`. The page table itself sits
  in physical memory, so the PTE address is computed and shown
  (`PTBR + VPN × PTE size`, OSTEP §18.5).
- An access is `{ va: number, op: 'read' | 'write' }`, up to 40 per run.
- TLB: 0–8 entries (0 = no TLB), fully associative, `lru` or `fifo`, holds `{ vpn, pfn,
  prot }`. No ASIDs; the TLB belongs to one process (see disclaimers).

### 2. Steps per access (one phase per access)

1. Split the VA into fields (BitField highlights them).
2. TLB lookup: compare against each valid entry → **hit** or **miss**.
3. On a miss: read the PTE (memory reference, address shown). For two levels: read the
   PDE, then the PTE (two references). An invalid PDE or PTE → **fault: invalid page**,
   the access stops, and a link offers "What happens next? → Page Replacement".
4. Protection check: a write to an `r` page → **fault: protection**, access stops.
5. Insert into the TLB, evicting by the configured policy (tie: lowest slot index).
6. Set `accessed` (and `dirty` on write). Form PA = `pfn << offsetBits | offset`.
7. The data access itself: one more memory reference.

Rules (`rules.ts`): TLB is checked before the page table; faults don't fill the TLB;
accessed/dirty bits are set by the hardware walk (x86-style); every memory reference is
counted, including the page-table reads.

### 3. Page-table size calculator (`sizing.ts`)

Given the address bits, page size and which regions are in use (code, heap, stack, as
page ranges), compute the linear page-table size and the two-level size (page directory +
only the page-table pages that are needed). Show the saving and the extra memory reference
per TLB miss that pays for it (OSTEP §20.3).

### 4. Presets

- *OSTEP array walk* (§19.2): 8-bit VA, 16-byte pages, ten 4-byte ints from VA 100;
  expected miss, hit, hit, miss, hit, hit, hit, miss, hit, hit = **70% hit rate**.
- *Same array, second pass* (all hits: temporal locality).
- *TLB thrash*: loop over N+1 pages with an N-entry TLB and LRU → every access misses.
- *Invalid page* and *write to read-only page*.
- *Two-level walk* on a sparse address space, with the sizing panel preset to match.

### 5. Tests

- Worked examples: OSTEP §19.2 array walk (hit/miss pattern above); OSTEP §18
  translation example (VA → PA as stated in the chapter); OSTEP §20.3 two-level example
  (PDE/PTE indices and the resulting PA). Record each in `tests/fixtures/README.md`.
- Oracle (`tests/oracle/vm.test.ts`): for random configs and addresses, the PA equals the
  plain arithmetic reference `table[va >> off].pfn * pageSize + (va % pageSize)`, and the
  two-level result equals the one-level result for the same mapping.
- Properties: memory references per access = 1 on a TLB hit, levels + 1 on a miss;
  TLB occupancy ≤ size; with a TLB at least as large as the number of distinct pages, the
  number of misses equals the number of distinct valid pages touched; LRU TLB with 0
  entries = every access walks the table.
- `sizing.ts`: linear size = 2^VPNbits × PTE size; two-level ≤ linear + one directory page.

---

## Acceptance criteria

- [ ] The OSTEP array walk shows exactly the 70% pattern
- [ ] Oracle and property tests pass on 500 seeded configs
- [ ] Faults stop the access, explain why and link to Page Replacement
- [ ] `/translation`: edit the config, page table and access list by keyboard; BitField,
      TLB, page table and inspector stay in sync; sizing panel works
- [ ] URL round-trips; axe clean; `npm run verify` passes

---

## Prompts to execute

### Prompt 6.core — translation core (wave W2)

```
Read docs/implementation/00-overview.md and docs/implementation/06-module-3-address-translation.md.

In src/core/vm only: implement the config schema and limits, page tables as data (one or
two levels, PTBR, PTE addresses), the TLB (LRU/FIFO, lowest-slot tie-break), translate()
emitting one phase per access with the seven steps in step 2, rules.ts, and sizing.ts.
Replace the placeholder events.ts with VmEvent (snapshot: TLB, tables, bits, counters).
Add OSTEP ch. 18-20 citations, the presets, scenarios.ts and the state.ts branch.

Write the OSTEP worked-example tests (record them in tests/fixtures/README.md), the
arithmetic oracle and the property tests from step 5. Only touch the append-only shared
files. Done when `npm run verify` passes. Commit on feat/vm-core.
```

### Prompt 6.ui — translation module (wave W3, after 3.2)

```
Read docs/implementation/06-module-3-address-translation.md and 03-ui-shell-and-visual-blocks.md.

Build src/modules/translation and the /translation route from shared components: a config
panel, an editable page table (valid, PFN, protection) and access list, BitField for the
current address, TlbView, PageTableView highlighting the PTE being read and its address,
a running counter of TLB hits/misses and memory references, StepInspector, RulesPanel, and
the SizingPanel. Fault steps link to /replacement. Wire presets and useShareState.

Flip the registry entry to 'ready'. e2e: run the OSTEP array walk preset to the end and
check the hit rate reads 70%, plus axe. Done when `npm run verify` and
`npm run test:e2e` pass. Commit.
```
