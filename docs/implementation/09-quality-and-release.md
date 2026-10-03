# 09 — Lessons, quality, deploy and portfolio entry

Wave: **W4** (9.1), **W5** (9.2 → 9.3 → 9.4) · Estimate: 3–4 days · Original plan: phase 4

## Goal

Turn five working modules into a finished portfolio project: guided lessons, an accuracy
document, a full accessibility and performance pass, a production deploy, and the entry on
the portfolio site.

## Prerequisites

04–08 merged.

---

## Deliverables

```
src/content/lessons/<module>.mdx     one walkthrough per module
src/app/learn/page.tsx               lesson index with completion
src/components/lesson/               Checkpoint (predict-the-next-step), LessonStep
docs/ACCURACY.md                     every source, every convention, every known gap
tests/accuracy.test.ts               ACCURACY.md ⊇ every citation the product uses
e2e/a11y.spec.ts  e2e/keyboard.spec.ts
perf/bundles.mjs                     per-route JS budget (copied from Internet Visualizer)
README.md                            screenshots, what it does, how accuracy is checked
```

---

## Steps

### 1. Lessons (prompt 9.1)

Each module gets a **Walkthrough** mode driven by an MDX file: short text (about 150 words
between visuals, same voice as Internet Visualizer's `CONTENT-STYLE.md`), a preset, and
2–4 **Checkpoints**. A checkpoint pauses the timeline and asks a prediction question whose
answer comes from the core, never hard-coded: "Which process runs at t = 6?", "Is the next
reference a hit?", "Which frame does LRU evict?", "Is this state safe?". Wrong answers show
the reason from the event label.

| Lesson | Covers |
|---|---|
| Scheduling | FCFS and the convoy effect → SJF/SRTF → RR and response time → priority, starvation, aging → MLFQ rules and gaming |
| Compare | Turnaround vs response; quantum trade-off; no policy wins every metric |
| Translation | VPN/offset; TLB hit and miss; locality in the array walk; why two levels |
| Replacement | FIFO → OPT as the upper bound → LRU → Clock as a cheap LRU; Belady's anomaly |
| Deadlock | The four conditions; cycles; multi-instance; Banker's; recovery |

A "Real systems" box at the end of each lesson describes (not simulates) what real
kernels do: Linux EEVDF (which replaced CFS in 6.6), multi-level page tables on x86-64,
Linux's approximate LRU with active/inactive lists, and why most OSes don't use Banker's
(deadlock is usually prevented by lock ordering). Each box cites a source.

`/learn` lists the lessons with completion from `useProgress`.

### 2. Accuracy doc (prompt 9.1)

`docs/ACCURACY.md` in the same form as Internet Visualizer's: every source (OSTEP v1.10
chapters, OSC10 sections), every modelling convention from each module's `rules.ts`,
and the known simplifications. `tests/accuracy.test.ts` fails if a citation used by any
scenario is missing from it.

### 3. Disclaimers (on `/about` and in the portfolio entry)

- "Models the textbook algorithms, not a real kernel. There are no interrupts, no
  multicore and no real hardware timings. I/O is a fixed wait with no device queue, and
  context switches cost a fixed, configurable number of ticks."
- "Where textbooks disagree on a small rule (tie-breaks, when a preempted process
  re-queues, the Clock hand after a load), one rule is chosen and shown in the Rules
  panel. Another book's worked example may differ by that rule."
- "MLFQ follows the rules as OSTEP states them. Real schedulers (Linux EEVDF, Windows) are
  described in lessons, not simulated."
- "The TLB is fully associative with no ASIDs, and belongs to one process. Page faults stop
  the translation; loading the page is shown in the Page Replacement module."
- "Banker's algorithm shows one safe sequence; there may be others."

### 4. Quality pass (prompt 9.2)

- **axe** on every route, light and dark, walkthrough and free play (`e2e/a11y.spec.ts`).
- **Keyboard walk** per module (`e2e/keyboard.spec.ts`): reach every control, build an
  input, play, step, scrub, and read the result without a mouse.
- **Screen reader text:** every chart has a table view; the step caption is an
  `aria-live="polite"` region, throttled during playback.
- **Colour-blind check:** screenshot the Gantt and FrameStrip with a simulated deuteranopia
  filter; every distinction must still be readable (pattern + label).
- **Reduced motion:** no tweening anywhere.
- **Performance:** `perf/bundles.mjs` copied from Internet Visualizer; budget per route
  (start from the same numbers as Internet Visualizer and record them). React Flow only in
  `/deadlock`. Lighthouse ≥ 95 performance and 100 accessibility on `/` and `/scheduling`.
- `sitemap.ts`, `robots.ts`, metadata and Open Graph images per module; `/demo` is noindex.

### 5. Deploy (prompt 9.3)

New Vercel project linked to the repo, production branch `main`, `@vercel/analytics`
enabled. No environment variables are needed. Check a few share links in production.

### 6. Portfolio entry (prompt 9.4, run in the portfolio repo)

Following `docs/README.md` §4: a `Project` entry (slug `os-visualizer`, description,
longDescription, technologies, githubUrl/githubRepo, liveUrl, keyFeatures, disclaimers from
step 3, order), a screenshot in `public/images/projects/`, new skills in `data/skills.ts`
if any, and the optional `series: "visualizers"` field (serializer and admin form too, or
the next admin save drops it).

technologies: Next.js, TypeScript, React, Tailwind CSS, Zustand, Zod, React Flow, Vitest,
fast-check, Playwright.

Highlight: one pure tick-based kernel behind every scheduling policy; results checked
against the textbook worked examples, property tests and brute-force oracles; every
tie-break stated in the UI; side-by-side policy comparison.

---

## Acceptance criteria

- [ ] Five lessons with working checkpoints; `/learn` tracks completion
- [ ] `docs/ACCURACY.md` exists and the accuracy test passes
- [ ] axe clean on every route in both themes; keyboard walk passes for every module
- [ ] Bundle budgets pass; React Flow only in `/deadlock`
- [ ] Production deploy is live; share links work there
- [ ] Portfolio entry merged in the portfolio repo

---

## Prompts to execute

### Prompt 9.1 — lessons and accuracy doc (wave W4)

```
Read docs/implementation/00-overview.md and docs/implementation/09-quality-and-release.md
steps 1-3. Look at ../internet-visualizer/docs/CONTENT-STYLE.md and docs/ACCURACY.md for
voice and format.

Add the Checkpoint and LessonStep components, one MDX walkthrough per ready module (the
coverage in the step 1 table), with checkpoint answers computed from the core runs and
never hard-coded, plus the "Real systems" box with citations. Build /learn with
completion from useProgress. Write docs/ACCURACY.md from every module's citations and
rules.ts, tests/accuracy.test.ts, and the /about disclaimers from step 3.

Done when `npm run verify` passes. Commit.
```

### Prompt 9.2 — quality pass (wave W5)

```
Read docs/implementation/09-quality-and-release.md step 4.

Add e2e/a11y.spec.ts (axe on every route, both themes, both modes) and
e2e/keyboard.spec.ts (a keyboard-only walk per module). Fix everything they find. Make the
step caption a throttled aria-live region, confirm every chart has a table view, run the
deuteranopia screenshot check, and copy perf/bundles.mjs from ../internet-visualizer with
per-route budgets. Add sitemap, robots, metadata and OG images. Report Lighthouse scores
for / and /scheduling.

Done when `npm run verify`, `npm run test:e2e` and the bundle budget pass. Commit.
```

### Prompt 9.3 — deploy

```
Read docs/implementation/09-quality-and-release.md step 5.

Update README.md (what it is, screenshots, the module list, how accuracy is checked, how to
run it) and remove the "Nothing is built yet" status. Then deploy to a new Vercel project
from main with analytics enabled, and check the home page, one route per module and two
share links in production. Report the production URL.
```

### Prompt 9.4 — portfolio entry (run in the portfolio repo, not this one)

```
Read ../visualizers/os-visualizer/docs/README.md §4 and
../visualizers/os-visualizer/docs/implementation/09-quality-and-release.md steps 3 and 6
(adjust the path to where this repo lives).

Add the os-visualizer Project entry to data/projects.ts with the technologies, highlight
and disclaimers given there, the production URL, and the GitHub repo. Add the screenshot to
public/images/projects/ and any new skills to data/skills.ts. If the series field doesn't
exist yet, add series?: "visualizers" to types/project.ts, lib/admin/serializeProjects.ts
and the admin project form. Check app/sitemap.ts. Run the portfolio's own checks. Commit.
```
