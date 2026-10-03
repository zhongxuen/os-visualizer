# 03 — UI shell, timeline UI and visual building blocks

Wave: **W2** (3.1) and **W3** (3.2) · Estimate: 2–2.5 days · Original plan: phase 0 (UI part)

## Goal

The app shell and every shared UI piece the modules need, so module UIs only compose them:
the timeline and playback controls, the Gantt chart, the bit field, the frame strip, the
matrix table, the step inspector with citations, and the module page layout.

## Prerequisites

02.

---

## Deliverables

```
src/styles/tokens.css           colour, spacing, type tokens; light + dark; process palette
src/components/shell/           SiteHeader, SiteFooter, ModuleLayout, DisclaimerBanner, ThemeToggle
src/components/timeline/        usePlayback (Zustand), usePlaybackKeys, keymap, Timeline,
                                PlaybackControls, PhaseStepper, StepCaption
src/components/inspector/       StepInspector, CitationLink, RulesPanel
src/components/blocks/          GanttChart, BitField, FrameStrip, MatrixTable, QueueView,
                                MetricsTable, ChartTableToggle, MiniLineChart
src/components/state/           useShareState, useProgress (localStorage `osv:v1`)
src/app/about/page.tsx          disclaimers + how accuracy is checked
src/app/demo/page.tsx           noindex, not in the sitemap
VENDORED.md                     (append the timeline UI entries)
```

---

## Steps

### 1. Tokens and shell (prompt 3.1)

- Tokens in `tokens.css` as CSS variables consumed by Tailwind v4 `@theme`. Light and
  dark, `prefers-color-scheme` plus a manual toggle.
- **Process palette:** 10 colours, each paired with a pattern (solid, stripes, dots,
  cross-hatch, …) and the PID always drawn as text inside or beside the bar. Colour is
  never the only signal. Checked with a simulated deuteranopia screenshot in 9.2.
- `ModuleLayout`: title, one-line intro, mode switch (Walkthrough / Free play), input
  panel, the visual area, the inspector panel, the timeline pinned at the bottom.
- `DisclaimerBanner` on every module page: "Textbook algorithms, not a real kernel."
  links to `/about`.
- `/about` holds the full disclaimers (see 09-quality-and-release.md) and explains the
  worked-example, property and oracle tests.

### 2. Timeline (prompt 3.1)

Vendor the playback UI from Internet Visualizer (`src/components/viz/Timeline.tsx`,
`PlaybackControls.tsx`, `PhaseStepper.tsx`, `StepCaption.tsx`, `keymap.ts`, `time.ts`,
`frameClock.ts`, `hooks/usePlayback.ts`, `hooks/usePlaybackKeys.ts`) into
`src/components/timeline/`. These import IV's `@/components/prefs`, `ui`, `glossary` and
`motion`: vendor the small pieces they need (`usePauseAtSteps`, `Popover`, `Switch`,
`useReducedMotionSafe`) and replace `TermText` with plain text. Drop anything tied to
React Flow or packets. Record every file and every edit in `VENDORED.md`.

Keyboard: Space play/pause, ←/→ step, Shift+←/→ previous/next phase, Home/End, 1–5 speed.
The timecode shows **ticks** ("t = 7") for tick runs and "step 7 / 23" for step runs,
not milliseconds. Reduced motion: no tweening, instant step changes.

### 3. Building blocks (prompt 3.2)

| Component | Used by | Behaviour |
|---|---|---|
| `GanttChart` | Scheduling, Compare | SVG. One bar per run segment, idle and context-switch ticks drawn distinctly (hatched grey, "CS"). Tick axis with labels. A cursor at the current tick; bars after it are hidden or faded. Optional per-queue lanes for MLFQ. Accepts an external `tick` so several charts can share one cursor. `aria-label` summary plus `ChartTableToggle` |
| `QueueView` | Scheduling | Ready queue(s) as ordered chips with PID and remaining time; I/O waiting list; running slot |
| `BitField` | Translation | An address as bits, split into labelled fields (PD index / PT index / offset, or VPN / offset), each field showing binary, hex and decimal. Fields highlight in sync with the current step |
| `FrameStrip` | Replacement, Translation | Columns = references, rows = frames; the evicted and loaded cells marked; fault/hit row underneath. Clock mode shows use bits and the hand position |
| `MatrixTable` | Deadlock (Max, Allocation, Need, Request, Available, Work) | Rows = processes, columns = resources. Highlights a row, a comparison (Need ≤ Work), and a changed cell. Editable mode with number inputs for free play |
| `MetricsTable` | Scheduling, Compare, Replacement | Rows of metrics, columns of runs; per-row "best" marker (icon + text, not only colour); averages row |
| `MiniLineChart` | Replacement (faults vs frames) | Small SVG line chart, one line per policy, with a table toggle |
| `StepInspector` | all | Current event's `label`, `detail`, and a `CitationLink` |
| `RulesPanel` | all | A collapsible list of the modelling conventions the module uses, fed by the core |

Each component gets a unit test and an axe check in the component test.

### 4. State hooks (prompt 3.2)

- `useShareState(moduleId)`: read/write `?s=` via the phase-02 codec with
  `router.replace` (no history spam), debounced.
- `useProgress()`: `localStorage` key `osv:v1`, versioned `{ v: 1, completed: string[],
  saved: { [module]: input[] }, prefs: {...} }` with a migration function. Wrapped in
  try/catch, never read during server render. Saved custom workloads/graphs live here.

---

## Acceptance criteria

- [ ] `/demo` drives every building block from a fake `SimResult`, keyboard only
- [ ] Two `GanttChart`s on `/demo` follow one shared cursor
- [ ] Every component has tests and is axe clean in light and dark
- [ ] Every chart has a working table view
- [ ] Reduced motion turns off every animation
- [ ] `npm run verify` passes

---

## Prompts to execute

### Prompt 3.1 — tokens, shell, timeline (wave W2, parallel with the core prompts)

```
Read docs/implementation/00-overview.md and docs/implementation/03-ui-shell-and-visual-blocks.md.
Look at ../internet-visualizer/src/components/viz, src/components/prefs, src/components/ui
and src/styles for the originals.

Build steps 1 and 2: tokens.css (light/dark, a 10-colour process palette where every colour
has a pattern and the PID is always drawn as text), the shell components, ModuleLayout,
DisclaimerBanner, the /about page skeleton, and the timeline UI vendored from Internet
Visualizer with its small prefs/ui/motion dependencies. Show ticks or steps instead of
milliseconds. Record every vendored file and edit in VENDORED.md. Prove it with a /demo
page (noindex) driven by a fake run.

Only touch src/styles, src/components/shell, src/components/timeline, src/app and
VENDORED.md. Done when `npm run verify` passes. Commit.
```

### Prompt 3.2 — building blocks and state hooks (wave W3, before the module UIs)

```
Read docs/implementation/03-ui-shell-and-visual-blocks.md steps 3-4.

Build GanttChart (with external-cursor support and MLFQ lanes), QueueView, BitField,
FrameStrip (with Clock mode), MatrixTable (read-only and editable), MetricsTable,
MiniLineChart, ChartTableToggle, StepInspector, CitationLink and RulesPanel, plus
useShareState and useProgress. Each gets unit tests and an axe check. Add them all to the
/demo page, including two Gantt charts sharing one cursor.

Only touch src/components and the /demo route. Done when `npm run verify` passes. Commit.
```
