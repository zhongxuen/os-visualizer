# 07 — Module 4: Page replacement

Wave: **W2** (7.core), **W3** (7.ui) · Estimate: 3–4 days · Original plan: phase 2 (second half)

## Goal

Run a reference string over N frames with FIFO, LRU, OPT and Clock, one reference at a
time, with the reason for each eviction. See Belady's anomaly happen (FIFO with 3 frames
vs 4), and see the faults-vs-frames curve for every policy so the difference between
stack algorithms and FIFO is visible, not just stated.

## Prerequisites

02 for the core prompt. 03 for the UI prompt.

---

## Deliverables

```
src/core/replace/
  input.ts           Zod schema: refString (1..40 pages, page ids 0..15), frames 1..8, policy
  policies/          fifo.ts lru.ts opt.ts clock.ts
  replace.ts         replace(refString, frames, policy) => SimResult<ReplEvent>
  curve.ts           faultsByFrames(refString, policy, 1..8) => number[]
  generate.ts        seeded workloads: uniform (no locality), 80/20, looping-sequential
  rules.ts           conventions for the RulesPanel (id, text, plain, whyItMatters)
  presets.ts  events.ts  citations.ts  scenarios.ts  state.ts  index.ts
tests/fixtures/replace/*.test.ts
tests/oracle/replace.test.ts
src/modules/replacement/         InputPanel, PolicyTabs, ReplacementView, CurvePanel, BeladyPanel
src/app/(modules)/replacement/page.tsx
```

---

## Steps

### 1. Rules (`rules.ts`)

- Frames start empty and fill in order (frame 0 first); a fill is a **cold (compulsory)
  fault** and evicts nothing. Faults are split into cold and capacity in the metrics.
- FIFO evicts the page loaded earliest. LRU evicts the page used least recently.
- OPT evicts the page whose next use is furthest away; a page never used again counts as
  infinitely far. **Ties: the page in the lowest-numbered frame.**
- Clock (second chance): one use bit per frame. A hit sets the bit to 1. A loaded page
  starts with its bit set to 1 and the hand moves to the next frame. On a fault the hand
  sweeps: bit 1 → clear it and move on; bit 0 → evict that frame. The hand starts at frame 0.
- Every reference is its own phase; its events are `hit`, or `fault` → `choose victim`
  (with the reason) → `evict` → `load`.

Besides its `id` and formal `text`, every rule carries **`plain`** (one plain sentence for
students) and **`whyItMatters`** (what changes if a book uses another convention, e.g. "A
book that starts the Clock hand elsewhere, or doesn't advance it after a load, may evict a
different page") (`docs/UIUX.md` G4). They are text only and change no logic.

### 2. Events

```ts
ReplEvent = { kind: 'repl.ref' | 'repl.hit' | 'repl.fault' | 'repl.scan' | 'repl.victim'
                  | 'repl.evict' | 'repl.load'; page: number; frame?: number }
          & EventBase & { state: { index; frames: (number | null)[]; useBits?: (0|1)[];
                                   hand?: number; queue?: number[]; lastUse?: number[];
                                   nextUse?: number[]; hits; faults; cold } }
```

The victim label always says why: "Evict 3: loaded first (FIFO)", "Evict 7: not used
for the longest time (LRU)", "Evict 2: not needed again (OPT)", "Clear use bit of frame 1,
move hand".

### 3. Curves and generated workloads

- `faultsByFrames` runs every policy for 1–8 frames. The CurvePanel plots it with
  `MiniLineChart` (with a table view) and marks any point where faults *increase* with more
  frames as "Belady's anomaly".
- `generate.ts` uses the vendored seeded rng: *no locality* (uniform over N pages),
  *80/20* (80% of references to 20% of pages), *looping sequential* (0..N−1 repeated).
  These reproduce the shape of OSTEP §22's hit-rate-vs-cache-size figures, including LRU's
  worst case on the looping workload.

### 4. Presets

- *OSC10 string* `7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1`, 3 frames.
- *OSTEP string* `0,1,2,0,1,3,0,3,1,2,1`, 3 frames.
- *Belady's anomaly* `1,2,3,4,1,2,5,1,2,3,4,5`, FIFO with 3 and 4 frames side by side
  (BeladyPanel), then LRU on the same string to show it doesn't happen.
- *Looping workload vs LRU* and *80/20 workload*, seeded.

### 5. Tests

Worked examples (record each in `tests/fixtures/README.md`; check section numbers against
the edition):

| Source | Example | Expected |
|---|---|---|
| OSC10 §10.4 | 20-reference string above, 3 frames | FIFO 15, OPT 9, LRU 12 faults |
| OSC10 §10.4.2 | Belady string, FIFO | 3 frames: 9 faults; 4 frames: 10 faults |
| OSTEP §22.2–22.4 | `0,1,2,0,1,3,0,3,1,2,1`, cache 3 | OPT 6 hits (54.5%), FIFO 4 hits (36.4%), LRU 6 hits (54.5%) |

Oracle (`tests/oracle/replace.test.ts`): for strings of length ≤ 12 over ≤ 6 pages and
≤ 4 frames, an exhaustive search over every possible eviction choice (memoised on index +
resident set) finds the minimum number of faults; **OPT must equal it**.

Properties (fast-check, seeded):

- OPT faults ≤ FIFO, LRU and Clock faults, for every string and frame count.
- **Stack property:** LRU and OPT faults never increase as frames go from 1 to 8.
- faults ≥ number of distinct pages (cold misses); faults ≤ length; hits + faults = length.
- With frames ≥ distinct pages, every policy faults exactly once per distinct page.
- With 1 frame, every policy gives the same result.
- Clock never evicts a page whose use bit is 1 at the moment of eviction.

---

## Acceptance criteria

- [ ] All worked examples pass, including Belady 9 vs 10
- [ ] OPT equals brute force on every generated case; the stack property holds for LRU/OPT
- [ ] `/replacement`: type or generate a string, pick frames and policy, step through; the
      FrameStrip, Clock hand/use bits, inspector and metrics stay in sync
- [ ] BeladyPanel and CurvePanel work, with table views
- [ ] Every rule in `rules.ts` has a non-empty `plain` and `whyItMatters`
- [ ] UIUX §2.3 R1–R5: "cold" and "capacity" are `<Term>`s with a split bar in the
      metrics; OPT is stated as the unbuildable yardstick and shows "next use in n" under
      each frame (OPT only); the Belady callout ("4 frames, *more* faults than 3") appears
      exactly when the 4-frame fault count passes the 3-frame one, reduced-motion safe; the
      frame strip fits the width at 390 px with sticky row labels and keeps the current
      column in view; the reference-string field accepts spaces or commas, shows parsed
      chips live and gives an error per bad token
- [ ] UIUX §7.2.4 animations, through the shared motion primitives only: current
      reference chip lifts, past ones marked H/F; columns slide in; hit pulse; victim drops
      out, new page drops in, with the victim's reason as a label; Clock ring with a
      rotating hand and flipping use bits whose resting position matches the snapshot on
      every step; OPT "next use" and LRU "last used" labels with a ring on the chosen one;
      Belady counters roll and the callout slides in; curves draw once with the anomaly
      ringed
- [ ] The end-of-run card offers a contrasting preset and links to /deadlock
- [ ] URL round-trips; axe clean; `npm run verify` passes

---

## Prompts to execute

### Prompt 7.core — replacement core (wave W2)

```
Read docs/implementation/00-overview.md and docs/implementation/07-module-4-page-replacement.md.

In src/core/replace only: implement the input schema and limits, FIFO, LRU, OPT and Clock
following the rules in step 1 exactly (including the OPT and Clock conventions), rules.ts
(each rule with `plain` and `whyItMatters` strings), replace()
with one phase per reference and a victim label that says why, faultsByFrames, and the
seeded generators. Replace the placeholder events.ts with ReplEvent. Add OSTEP ch. 22 and
OSC10 ch. 10 citations, presets, scenarios.ts and the state.ts branch.

Write the worked-example tests (record them in tests/fixtures/README.md), the brute-force
OPT oracle and the property tests from step 5. Only touch the append-only shared files.
Done when `npm run verify` passes. Commit on feat/replace-core.
```

### Prompt 7.ui — replacement module (wave W3, after 3.2)

```
Read docs/implementation/07-module-4-page-replacement.md, 03-ui-shell-and-visual-blocks.md
and docs/UIUX.md §2.2, §2.3 (Page Replacement), §6 and §7.2.4.

Build src/modules/replacement and the /replacement route inside the shared workspace, from
shared components: an input panel (type a string or generate one with a seed; spaces or
commas accepted, parsed chips shown live, one human error per bad token; presets first,
Edit reveals controls), frame count, policy tabs, FrameStrip (fit to width, sticky row
labels, current column kept in view; Clock mode as a ring with the hand and use bits; OPT
shows "next use in n" under each frame, LRU "last used t"), StepInspector (Rule-used
chip), RulesPanel, MetricsTable (hits, faults, a cold vs capacity split bar, hit rate),
the BeladyPanel (FIFO 3 vs 4 frames side by side on one timeline, with the "4 frames,
more faults than 3" callout) and the CurvePanel. Say plainly that OPT can't be built and is
the yardstick. Wrap the first use of each glossary term (cold fault, capacity fault,
victim, use bit, Belady's anomaly, …) in <Term>. Add every animation in UIUX §7.2.4
through the shared motion primitives only. Read the page number carried over from
/translation via ?s=. Supply the EndOfRunCard's "Try this next" preset and next-module
link. Wire presets and useShareState.

Flip the registry entry to 'ready'. e2e: load the Belady preset, step both runs to the end
and check 9 vs 10 faults and that the callout appears on the step where 4-frame faults
pass 3-frame faults; check the Clock hand position matches the snapshot on every step of a
Clock preset; the reduced-motion e2e; plus axe. Done when `npm run verify` and
`npm run test:e2e` pass. Commit.
```
