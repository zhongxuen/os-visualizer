/**
 * The glossary: every term a page wraps in `<Term id>` (docs/UIUX.md §2.2 G2).
 *
 * Plain data, no React, so the tests, a future `/learn/glossary` page and `<Term>` all
 * read the same list. `short` is what a popover and a screen reader's description say
 * (25 words at most); `long` adds the why and, where textbooks disagree, which
 * convention this site uses. `modules` are registry slugs (`src/modules/registry.ts`).
 *
 * `tests/glossary.test.ts` checks that ids and terms are unique, that `short` stays
 * short, that every slug exists, and that every `<Term id>` in the source is listed here.
 */

export type GlossaryModule =
  'scheduling' | 'compare' | 'translation' | 'replacement' | 'deadlock' | 'sync';

export interface GlossaryEntry {
  /** Kebab-case, stable: it is what `<Term id>` and `#anchors` use. */
  readonly id: string;
  /** The term as a heading shows it. Abbreviations spell themselves out in `short`. */
  readonly term: string;
  readonly short: string;
  readonly long: string;
  readonly modules: readonly GlossaryModule[];
}

export const GLOSSARY = [
  // ── Processes and scheduling ───────────────────────────────────────────────────────
  {
    id: 'process',
    term: 'Process',
    short:
      'A running program: its code, its memory, and the CPU state the OS saves and restores when it switches away and back.',
    long: 'The OS gives each process the illusion of its own CPU and its own memory. In the scheduling module a process is just a name, an arrival time and a list of bursts; everything else a real process has is left out.',
    modules: ['scheduling', 'compare', 'translation'],
  },
  {
    id: 'thread',
    term: 'Thread',
    short:
      'One sequence of execution inside a process. Threads of the same process share its memory but each has its own registers and stack.',
    long: 'Because threads share memory, two of them can read and write the same variable, which is where race conditions come from. In the deadlock and synchronisation modules the actors are called threads; in scheduling they are called processes, as the textbooks do.',
    modules: ['deadlock', 'sync'],
  },
  {
    id: 'tick',
    term: 'Tick',
    short:
      'One unit of simulated time. Every step of the scheduling timeline is one tick, and every burst length is a whole number of ticks.',
    long: 'Real schedulers are driven by a timer interrupt every few milliseconds. Here time is discrete and has no unit: "3 ticks" means three steps, so a run is exactly reproducible.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'burst',
    term: 'Burst',
    short:
      'A stretch of time a process spends doing one thing: computing on the CPU, or waiting for I/O.',
    long: 'A process alternates CPU bursts and I/O bursts, always starting and ending with a CPU burst. Schedulers only ever schedule the CPU bursts; while a process is in an I/O burst it is not in the ready queue.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'cpu-burst',
    term: 'CPU burst',
    short:
      'A stretch of time a process needs the CPU for, before it next waits for I/O or finishes.',
    long: 'SJF and SRTF choose by burst length. A real OS cannot know the next burst in advance and has to predict it, usually by exponential averaging; this simulator is given the true lengths, as the textbook examples are.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'io-burst',
    term: 'I/O burst',
    short:
      'A stretch of time a process waits for a device, such as a disk. It does not need the CPU, so another process can run.',
    long: 'I/O devices are modelled as always available, so an I/O burst simply takes its length in ticks and then puts the process back in the ready queue. Overlapping I/O with computation is why utilisation rises with more processes.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'arrival',
    term: 'Arrival',
    short:
      'The tick at which a process enters the system and joins the ready queue for the first time.',
    long: 'Turnaround and response time are both measured from arrival. When an arrival and a preemption or an I/O completion happen on the same tick, the order in which they join the ready queue is a tie-break, stated in the Rules used panel.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'quantum',
    term: 'Quantum',
    short:
      'The longest a process may run before Round Robin or MLFQ takes the CPU back. Also called a time slice.',
    long: 'A short quantum gives good response time but more context switches; a quantum longer than every burst turns Round Robin into FCFS. Textbooks often suggest that most CPU bursts should fit inside one quantum.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'preempt',
    term: 'Preempt',
    short:
      'To take the CPU away from a running process before its burst ends, because its quantum expired or a better candidate arrived.',
    long: 'Preemptive schedulers (SRTF, preemptive Priority, Round Robin, MLFQ) can preempt; FCFS, SJF and non-preemptive Priority only switch when the running process blocks or finishes. A preempted process goes back to the ready queue with its remaining time.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'context-switch',
    term: 'Context switch',
    short:
      'Saving the running process’s CPU state and loading another’s, so the second can run. It costs time but does no useful work.',
    long: 'Here a switch costs a set number of ticks (0 to 3) whenever the CPU starts a different process from the one that ran last; the first dispatch is free. Those ticks count as neither busy nor idle, so the cost of a short quantum shows up in the metrics.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'ready-queue',
    term: 'Ready queue',
    short:
      'The processes that could run right now and are waiting only for the CPU. The scheduler picks the next one from here.',
    long: 'A process waiting for I/O is not in the ready queue. Whether the queue is ordered by arrival, burst length or priority is what distinguishes one scheduler from another; ties are broken by the rules in the Rules used panel.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'waiting-time',
    term: 'Waiting time',
    short:
      'Total time a process spends ready to run but not running. Equals turnaround time minus its CPU time and I/O time.',
    long: 'With no I/O this is the OSC definition, turnaround − burst. Time in I/O bursts does not count as waiting; time lost to other processes’ context switches does.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'turnaround-time',
    term: 'Turnaround time',
    short:
      'How long a process takes from arrival to completion: completion tick minus arrival tick.',
    long: 'It includes every kind of time: running, waiting in the ready queue, and doing I/O. SJF minimises average turnaround among non-preemptive schedulers when all processes arrive together.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'response-time',
    term: 'Response time',
    short:
      'How long a process waits before it first runs: first-run tick minus arrival tick.',
    long: 'Round Robin is good at response time and poor at turnaround. OSC and OSTEP both measure to the first time on the CPU, which is the convention here, not to the first output.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'throughput',
    term: 'Throughput',
    short:
      'How many processes finish per unit of time: processes completed divided by the length of the run in ticks.',
    long: 'Total ticks run from tick 0 to the last completion. Throughput rewards finishing short jobs first, which is part of why SJF looks good on it.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'utilisation',
    term: 'Utilisation',
    short:
      'The fraction of time the CPU is busy running processes, rather than idle or switching context.',
    long: 'Computed as busy ticks divided by total ticks. Context-switch ticks are not busy. Utilisation is about the hardware and says nothing about whether individual processes were treated fairly.',
    modules: ['scheduling', 'compare'],
  },
  {
    id: 'starvation',
    term: 'Starvation',
    short:
      'A ready process waits indefinitely because the scheduler keeps choosing others ahead of it.',
    long: 'Priority scheduling and SJF can both starve: a steady stream of high-priority or short jobs keeps a low-priority or long one waiting for ever. Starvation is not deadlock; the starved process could run, it just never gets chosen.',
    modules: ['scheduling', 'compare', 'sync'],
  },
  {
    id: 'aging',
    term: 'Aging',
    short:
      'Gradually raising a waiting process’s priority, so that one that has waited long enough eventually runs. The standard cure for starvation.',
    long: 'MLFQ’s periodic priority boost, which moves every job back to the top queue, is a form of aging.',
    modules: ['scheduling'],
  },
  {
    id: 'mlfq',
    term: 'MLFQ',
    short:
      'Multi-Level Feedback Queue: several Round Robin queues of falling priority. A job that uses its whole quantum moves down a level.',
    long: 'MLFQ learns from behaviour instead of needing burst lengths in advance: interactive jobs that give up the CPU early stay high, CPU-bound jobs sink. A periodic boost back to the top prevents starvation. This simulator follows OSTEP ch. 8’s rules, with a quantum and an allotment per level.',
    modules: ['scheduling', 'compare'],
  },

  // ── Address translation ────────────────────────────────────────────────────────────
  {
    id: 'virtual-address',
    term: 'Virtual address',
    short:
      'An address as the program sees it. The hardware translates it to a physical address on every memory access.',
    long: 'Each process has its own virtual address space starting at 0, so two processes can use the same virtual address for different data. A virtual address is split into a VPN and an offset.',
    modules: ['translation', 'replacement'],
  },
  {
    id: 'physical-address',
    term: 'Physical address',
    short:
      'An address in real memory (RAM): where the data actually is, after translation.',
    long: 'A physical address is the PFN from the page table followed by the unchanged offset from the virtual address.',
    modules: ['translation'],
  },
  {
    id: 'page',
    term: 'Page',
    short:
      'A fixed-size block of virtual memory. A process’s address space is divided into pages, which the OS maps to frames.',
    long: 'Pages and frames are the same size, a power of two, so translation never touches the offset bits. Real systems use 4 KiB pages; the examples here use tiny pages so every bit fits on screen.',
    modules: ['translation', 'replacement'],
  },
  {
    id: 'frame',
    term: 'Frame',
    short:
      'A fixed-size block of physical memory, the same size as a page. Each frame holds at most one page at a time.',
    long: 'Also called a page frame. In page replacement there are fewer frames than pages, so when every frame is full, bringing a page in means choosing a victim to evict.',
    modules: ['translation', 'replacement'],
  },
  {
    id: 'offset',
    term: 'Offset',
    short:
      'The low bits of an address: how far into the page (or frame) the byte is. Copied unchanged from virtual to physical address.',
    long: 'A page of 2ⁿ bytes needs n offset bits. For example, 16-byte pages need 4 offset bits.',
    modules: ['translation'],
  },
  {
    id: 'vpn',
    term: 'VPN',
    short:
      'Virtual Page Number: the high bits of a virtual address, saying which page it is in. The page table is indexed by it.',
    long: 'With a two-level page table the VPN is split again: the top bits index the page directory, the rest index one page of the page table.',
    modules: ['translation'],
  },
  {
    id: 'pfn',
    term: 'PFN',
    short:
      'Physical Frame Number: which frame of physical memory a page is in. Read from the page table entry, then joined to the offset.',
    long: 'Also called a physical page number (PPN). The physical address is the PFN shifted left by the number of offset bits, plus the offset.',
    modules: ['translation'],
  },
  {
    id: 'pte',
    term: 'PTE',
    short:
      'Page Table Entry: one page table row. It holds the page’s PFN and its bits: valid, protection, and others.',
    long: 'If the valid bit is clear, the page is not mapped (or not in memory) and the access faults. If the access breaks the protection bits, it faults too, for a different reason.',
    modules: ['translation'],
  },
  {
    id: 'pde',
    term: 'PDE',
    short:
      'Page Directory Entry: one row of the top level of a two-level page table, pointing to one page of the page table.',
    long: 'If a whole page of the page table would be empty, its PDE is marked invalid and that page is never allocated. That saving is the reason for two levels.',
    modules: ['translation'],
  },
  {
    id: 'ptbr',
    term: 'PTBR',
    short:
      'Page Table Base Register: holds the physical address of the current process’s page table (or page directory). Changed on every context switch.',
    long: 'The hardware page walk starts here. On x86 the same register is called CR3.',
    modules: ['translation'],
  },
  {
    id: 'tlb',
    term: 'TLB',
    short:
      'Translation Lookaside Buffer: a small, fast hardware cache of recent VPN-to-PFN translations, checked before the page table.',
    long: 'A hit skips the page walk entirely, which is why translation is fast in practice. The TLB holds only a few entries, so programs that touch nearby addresses (good locality) hit far more often.',
    modules: ['translation'],
  },
  {
    id: 'tlb-hit-miss',
    term: 'TLB hit / miss',
    short:
      'A hit finds the translation in the TLB and skips the page walk. A miss walks the page table, then caches the result.',
    long: 'A miss is not a page fault: the page may be in memory and only missing from the TLB. When the TLB is full, a miss also evicts an entry, by the policy stated in the Rules used panel.',
    modules: ['translation'],
  },
  {
    id: 'valid-bit',
    term: 'Valid bit',
    short:
      'A bit in a page table entry saying whether the translation can be used. Accessing a page with the bit clear causes a fault.',
    long: 'Textbooks differ: OSTEP separates valid (mapped at all) from present (in memory), OSC uses one valid-invalid bit for both. This site uses a single valid bit, as OSC does.',
    modules: ['translation'],
  },
  {
    id: 'protection-bit',
    term: 'Protection bit',
    short:
      'Bits in a page table entry saying which accesses are allowed, such as read, write or execute. A disallowed access faults.',
    long: 'Writing to a read-only page is a protection fault, not a page fault: the page is in memory, the access just isn’t permitted.',
    modules: ['translation'],
  },
  {
    id: 'page-fault',
    term: 'Page fault',
    short:
      'A trap to the OS because the page being accessed is not in memory. The OS loads it, evicting another if memory is full.',
    long: 'After the OS brings the page into a frame and updates the page table, the faulting instruction runs again. In the replacement module every reference that misses the frames counts as one fault.',
    modules: ['translation', 'replacement'],
  },

  // ── Page replacement ───────────────────────────────────────────────────────────────
  {
    id: 'reference-string',
    term: 'Reference string',
    short:
      'The sequence of page numbers a program accesses, in order. It is the input to every page-replacement algorithm.',
    long: 'Consecutive references to the same page are usually collapsed, since the second can never fault. Here a reference string is typed as numbers separated by spaces or commas.',
    modules: ['replacement'],
  },
  {
    id: 'victim',
    term: 'Victim',
    short:
      'The page chosen to be evicted from its frame to make room for the page being brought in.',
    long: 'Choosing the victim is the whole job of a replacement policy: FIFO picks the oldest, LRU the least recently used, OPT the one used furthest in the future. Deadlock recovery uses the same word for the thread chosen to terminate or roll back.',
    modules: ['replacement', 'deadlock'],
  },
  {
    id: 'cold-fault',
    term: 'Cold fault',
    short:
      'A fault on the first ever reference to a page. No policy can avoid it. Also called a compulsory fault.',
    long: 'Every algorithm, OPT included, takes exactly one cold fault per distinct page in the reference string. The metrics split them out so the rest can be compared fairly.',
    modules: ['replacement'],
  },
  {
    id: 'capacity-fault',
    term: 'Capacity fault',
    short:
      'A fault on a page that was in memory before but was evicted because the frames were full.',
    long: 'These are the faults a better policy or more frames can avoid. OSTEP calls them capacity misses (alongside cold and conflict misses; with fully associative frames there are no conflict misses).',
    modules: ['replacement'],
  },
  {
    id: 'beladys-anomaly',
    term: 'Belady’s anomaly',
    short:
      'Adding frames causes more page faults, not fewer. It can happen with FIFO but never with LRU or OPT.',
    long: 'The classic case is the reference string 1 2 3 4 1 2 5 1 2 3 4 5 under FIFO: 9 faults with 3 frames, 10 with 4. LRU and OPT are stack algorithms, so they cannot show it.',
    modules: ['replacement'],
  },
  {
    id: 'use-bit',
    term: 'Use bit',
    short:
      'A bit the hardware sets when a page is accessed. The Clock algorithm clears it as its hand passes, giving pages a second chance.',
    long: 'Also called the reference bit. Clock evicts the first page whose use bit is already 0, approximating LRU without tracking exact access times.',
    modules: ['replacement'],
  },

  // ── Deadlock ───────────────────────────────────────────────────────────────────────
  {
    id: 'resource-allocation-graph',
    term: 'Resource-allocation graph',
    short:
      'A graph of threads and resources. An arrow from a thread to a resource is a request; from a resource to a thread, an assignment.',
    long: 'With one instance per resource, a cycle means deadlock. With several instances, a cycle means deadlock is possible but not certain, so the detection algorithm has to run.',
    modules: ['deadlock'],
  },
  {
    id: 'wait-for-graph',
    term: 'Wait-for graph',
    short:
      'A resource-allocation graph with the resources removed: an arrow from one thread to another means the first waits for the second.',
    long: 'Only valid when every resource has a single instance. Then a cycle in the wait-for graph is exactly a deadlock.',
    modules: ['deadlock'],
  },
  {
    id: 'deadlock',
    term: 'Deadlock',
    short:
      'A set of threads each waiting for a resource held by another in the set, so none can ever proceed.',
    long: 'Deadlock needs all four Coffman conditions at once: mutual exclusion, hold and wait, no preemption and circular wait. Break any one and it cannot happen.',
    modules: ['deadlock', 'sync'],
  },
  {
    id: 'safe-state',
    term: 'Safe state',
    short:
      'A state from which every thread can finish, in some order, even if each asks for its full declared maximum.',
    long: 'An unsafe state is not yet a deadlock, but the OS can no longer guarantee to avoid one. Banker’s algorithm grants a request only if the state after it is still safe.',
    modules: ['deadlock'],
  },
  {
    id: 'safe-sequence',
    term: 'Safe sequence',
    short:
      'An order in which the threads can each get their remaining Need, finish and release everything. Its existence proves the state safe.',
    long: 'There may be several safe sequences. The one shown is the one the stated tie-break finds: lowest-numbered thread first among those that can finish.',
    modules: ['deadlock'],
  },
  {
    id: 'need',
    term: 'Need',
    short:
      'In Banker’s algorithm, how many more of each resource a thread may still ask for: Max minus Allocation.',
    long: 'Need is computed, not entered. A thread can finish when its Need fits within Work.',
    modules: ['deadlock'],
  },
  {
    id: 'work',
    term: 'Work',
    short:
      'In the safety algorithm, the resources free so far. Starts as Available and grows as each thread finishes and releases its allocation.',
    long: 'Work is a scratch vector: it only exists while the safety check runs, and is shown as a bar that grows with each finished thread.',
    modules: ['deadlock'],
  },
  {
    id: 'available',
    term: 'Available',
    short:
      'How many instances of each resource are free right now, not allocated to any thread.',
    long: 'Available = total instances − the sum of every thread’s Allocation. The safety algorithm copies it into Work to start.',
    modules: ['deadlock'],
  },
  {
    id: 'mutual-exclusion',
    term: 'Mutual exclusion',
    short:
      'Only one thread can use a resource instance, or be in a critical section, at a time.',
    long: 'As a Coffman condition it is the one this simulator always assumes: no resource instance is ever shared. In synchronisation it is the property a lock exists to provide.',
    modules: ['deadlock', 'sync'],
  },
  {
    id: 'hold-and-wait',
    term: 'Hold and wait',
    short:
      'A thread holds at least one resource while waiting to acquire another. One of the four conditions for deadlock.',
    long: 'Preventable by requiring a thread to request everything at once, at the cost of holding resources it does not yet need.',
    modules: ['deadlock'],
  },
  {
    id: 'no-preemption',
    term: 'No preemption',
    short:
      'A resource can only be released by the thread holding it; the OS cannot take it away. One of the four conditions for deadlock.',
    long: 'Some resources, like the CPU or memory, can be preempted by saving their state. Locks and printers mid-job generally cannot.',
    modules: ['deadlock'],
  },
  {
    id: 'circular-wait',
    term: 'Circular wait',
    short:
      'A cycle of threads, each waiting for a resource the next one holds. One of the four conditions for deadlock.',
    long: 'Preventable by numbering resources and always acquiring them in increasing order, which makes a cycle impossible. In the graph it shows as a cycle.',
    modules: ['deadlock', 'sync'],
  },

  // ── Synchronisation ────────────────────────────────────────────────────────────────
  {
    id: 'race-condition',
    term: 'Race condition',
    short:
      'A bug where the result depends on how threads happen to interleave, so the same program can give different answers.',
    long: 'The synchronisation module runs the same threads under different schedules to show the outcomes a race allows, including the rare ones.',
    modules: ['sync'],
  },
  {
    id: 'critical-section',
    term: 'Critical section',
    short:
      'Code that accesses shared data and must not be run by more than one thread at a time.',
    long: 'A correct solution provides mutual exclusion, progress and bounded waiting. Locks and semaphores are the usual way to guard a critical section.',
    modules: ['sync'],
  },
  {
    id: 'mutex',
    term: 'Mutex',
    short:
      'A lock: a thread acquires it before a critical section and releases it after. Only one thread can hold it at a time.',
    long: 'A thread that tries to acquire a held mutex waits until it is released. Short for "mutual exclusion lock".',
    modules: ['sync'],
  },
  {
    id: 'semaphore',
    term: 'Semaphore',
    short:
      'A counter with two atomic operations: wait decrements it and blocks if the result is negative; signal increments it and wakes a waiter.',
    long: 'A semaphore that starts at 1 behaves like a mutex. One that starts at n admits n threads at once. Wait and signal are also called P and V, or down and up.',
    modules: ['sync'],
  },
  {
    id: 'lost-update',
    term: 'Lost update',
    short:
      'Two threads read the same value, both change it, and the second write overwrites the first, so one change disappears.',
    long: 'The classic case is two threads each running counter = counter + 1 from 0 and leaving 1 instead of 2: both loaded 0 before either stored.',
    modules: ['sync'],
  },
] as const satisfies readonly GlossaryEntry[];

export type GlossaryId = (typeof GLOSSARY)[number]['id'];

const BY_ID: ReadonlyMap<string, GlossaryEntry> = new Map(
  GLOSSARY.map((entry) => [entry.id, entry]),
);

/** The entry for an id, or undefined. `<Term>`'s `id` prop is typed, so this is a guard. */
export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id);
}
