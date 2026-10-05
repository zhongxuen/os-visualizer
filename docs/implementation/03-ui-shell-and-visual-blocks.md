# 03 — UI shell, timeline UI and visual building blocks

Wave: **W2** (3.1) and **W3** (3.2) · Estimate: 2–2.5 days · Original plan: phase 0 (UI part)

## Goal

The app shell and every shared UI piece the modules need, so module UIs only compose them:
the "Timing diagram" theme and motion primitives, the timeline and playback controls, the
Gantt chart, the bit field, the frame strip, the matrix table, the step inspector with
citations, and the **module workspace** (`docs/UIUX.md` §4.3) every module page sits in.

The look, the components and the motion follow `docs/UIUX.md` §4–§6. Its waves U1 and U2
(§9) run alongside prompts 3.1 and 3.2.

## Prerequisites

02.

---

## Deliverables

```
src/styles/tokens.css           colour, spacing, type and motion tokens (UIUX §5, §6.2);
                                light + dark; process palette with patterns
src/styles/motion.css           idle keyframes for ModuleGlyph (UIUX §7.1)
src/components/ui/              Popover, Sheet, Tabs, SegmentedControl, Kbd, Pill
src/components/motion/          useReducedMotionSafe, useStepTransition, Flash, Ticker,
                                DrawPath, Flip (lazy-loads `motion`)   (UIUX §6.3)
src/components/shell/           SiteHeader, SiteFooter, ModuleLayout (the workspace),
                                ThemeToggle, ShareControl, EndOfRunCard, ModuleGlyph
src/components/timeline/        usePlayback (Zustand), usePlaybackKeys, keymap, Timeline,
                                PlaybackControls, PhaseStepper, StepCaption, ShortcutsSheet
src/components/inspector/       StepInspector, CitationLink, RulesPanel
src/components/glossary/        Term
src/content/glossary.ts         term, short and long definition, modules it appears in
src/components/blocks/          GanttChart, BitField, FrameStrip, MatrixTable, QueueView,
                                MetricsTable, ChartTableToggle, MiniLineChart
src/components/state/           useShareState, useProgress (localStorage `osv:v1`)
src/app/about/page.tsx          "what this means for you", disclaimers, how accuracy is checked
src/app/not-found.tsx           404 inside the shell, with the module list and /learn
src/app/demo/page.tsx           noindex, not in the sitemap
tests/tokens-contrast.test.ts   every text pair ≥ 4.5:1, every UI border ≥ 3:1, both themes
VENDORED.md                     (append the timeline UI entries)
```

There is no `DisclaimerBanner` (UIUX G8): the honesty note is one line in the module
header.

---

## Steps

### 1. Tokens, primitives and shell (prompt 3.1)

- **Tokens** follow `docs/UIUX.md` §5 ("Timing diagram": Datasheet light, Logic analyser
  dark) and the motion tokens in §6.2 (`--dur-1..3`, `--ease-out`, `--ease-inout`,
  `--ease-snap`). CSS variables in `tokens.css`, consumed by Tailwind v4 `@theme`. Light
  and dark under `prefers-color-scheme`, with `:root[data-theme]` overrides both ways, a
  no-flash inline script and a three-state `ThemeToggle` (System / Light / Dark).
  `tests/tokens-contrast.test.ts` parses `tokens.css` and asserts the contrast pairs.
- **Type:** Geist and Geist Mono via `next/font`. Every number the simulation produces is
  mono with `tabular-nums` (§5.2).
- **Process palette:** 10 colours (Okabe–Ito extended), each paired with a pattern (solid,
  diagonal, dots, cross-hatch, …) and the PID always drawn as text inside or beside the
  bar. Colour is never the only signal. Process chips are **pills**; thread chips
  (Deadlock, Sync) are **rounded squares**. Checked with a simulated deuteranopia
  screenshot in 9.2.
- **UI primitives** (`src/components/ui/`): `Popover`, `Sheet`, `Tabs`,
  `SegmentedControl`, `Kbd`, `Pill`, vendored from the siblings where they exist.
- **Motion primitives** (`src/components/motion/`, UIUX §6.3): `useReducedMotionSafe()`
  (every JS animation goes through it), `useStepTransition()` (returns `{ animate,
  duration }` applying §6.1 rules 2, 3 and 5: only forward steps animate, duration =
  `min(token, 0.6 × step interval)`, instant at speeds 4–5 and under reduced motion),
  `<Flash>`, `<Ticker>`, `<DrawPath>` and `<Flip>` (the only way to use `motion`,
  lazy-loaded). Animate `transform` and `opacity` only.
- **`ModuleLayout` is the workspace** in `docs/UIUX.md` §4.3:
  - Module header: `ModuleGlyph`, title, the **Guided / Sandbox** switch with a one-line
    description of each mode, `ShareControl` ("Saved in this link · Copy link"), and one
    line "Textbook model, not a real kernel → what that means" linking to `/about#model`.
  - Desktop (≥ 1024 px): three columns, **Setup** (presets, editor, policy; collapsible),
    **Watch** (the visual) and the **Inspector**, with the caption and transport bar
    pinned at the bottom. `F` toggles Focus mode (Setup collapsed, visual full width).
  - Tablet (640–1023 px): Setup is a drawer opened from the header; the Inspector sits
    under the visual.
  - Phone (< 640 px): three tabs, **Setup / Watch / Results**. Play from Setup switches to
    Watch. Results holds the metrics and the `EndOfRunCard`. The transport bar is pinned
    only on Watch and hidden while an input has focus.
  - The first visit to a module opens **Guided** on its best preset at step 1
    (remembered in `osv:v1`); Sandbox is one click away.
- `SiteHeader` (skip link, wordmark, Modules menu from the registry with status pills,
  Learn, About, ThemeToggle, keyboard-help button; a menu sheet on phones) and
  `SiteFooter` (series links, GitHub, the honesty line, `/about`). Status pills say
  "Ready" / "Coming soon" / "Coming later", never "phase 2".
- `ModuleGlyph`: the small CSS-animated picture for each module (UIUX §7.1), `aria-hidden`,
  resting on a frame that still shows the idea.
- `/about` opens with **"What this means for you"**, then holds the full disclaimers (see
  09-quality-and-release.md) and explains the worked-example, property and oracle tests.
- `not-found.tsx` sits inside the shell: "That page isn't here", the module list and
  `/learn`.

### 2. Timeline (prompt 3.1)

Vendor the playback UI from Internet Visualizer (`src/components/viz/Timeline.tsx`,
`PlaybackControls.tsx`, `PhaseStepper.tsx`, `StepCaption.tsx`, `keymap.ts`, `time.ts`,
`frameClock.ts`, `hooks/usePlayback.ts`, `hooks/usePlaybackKeys.ts`) into
`src/components/timeline/`. These import IV's `@/components/prefs`, `ui`, `glossary` and
`motion`: vendor the small pieces they need (`usePauseAtSteps`, `Popover`, `Switch`,
`useReducedMotionSafe`) and replace `TermText` with plain text. Drop anything tied to
React Flow or packets. Record every file and every edit in `VENDORED.md`.

Keyboard: Space play/pause, ←/→ step, Shift+←/→ previous/next phase, Home/End, 1–5 speed,
`?` shortcuts sheet, `F` focus mode. **`keymap.ts` is the single table of every key on
the site** (modules add theirs to it, e.g. Sync's A/B) and has a uniqueness test.
`ShortcutsSheet` is generated from it and opened with `?` or the header's keyboard
button; the play button's tooltip shows "Space".

The timeline is a **transport bar** (UIUX §4.2): step back, play/pause, step forward, the
scrubber with phase notches, speed. The timecode is mono and shows **ticks** ("t = 7
ticks", with a `<Term>` for *tick* the first time) for tick runs and "step 7 / 23" for
step runs, not milliseconds. On phones speed moves into a menu. `StepCaption` cross-fades
and is `aria-live="polite"`, throttled.

Motion follows UIUX §6.1 through `useStepTransition`: forward steps animate; scrubbing,
jumps, stepping back and loading a URL are instant. Reduced motion: no tweening, instant
step changes.

### 3. Building blocks (prompt 3.2)

| Component | Used by | Behaviour |
|---|---|---|
| `GanttChart` | Scheduling, Compare | SVG. One bar per run segment, idle and context-switch ticks drawn distinctly (dotted idle, hatched "CS"). Tick axis with labels. Fit-to-width by default with a zoom control (fit / 1 tick = 16 px) that follows the cursor when zoomed. A cursor at the current tick; bars after it are hidden or faded. Bars grow with `scaleX`. Optional per-queue lanes for MLFQ. Accepts an external `tick` so several charts can share one cursor, and an optional highlighted PID and bracket overlay. `aria-label` summary plus `ChartTableToggle` |
| `QueueView` | Scheduling | Lanes of process chips (ready queue(s), I/O, running slot, done tray) with PID and remaining time; moves use `<Flip>` |
| `BitField` | Translation | An address as bits, split into labelled fields (PD index / PT index / offset, or VPN / offset). One base at a time (binary / hex / decimal toggle, binary by default) with the others on hover. Fields highlight in sync with the current step |
| `FrameStrip` | Replacement, Translation | Columns = references, rows = frames, sticky row labels, fit to width; the evicted and loaded cells marked by shape and label; fault/hit row underneath. Clock mode draws the frames as a ring with the hand and use bits |
| `MatrixTable` | Deadlock (Max, Allocation, Need, Request, Available, Work) | Mono, tabular figures. Rows = processes, columns = resources. Highlights a row (others dimmed, contrast kept), a per-column comparison (Need ≤ Work), and a changed cell (`<Flash>`). Editable mode with visible number inputs for Sandbox |
| `MetricsTable` | Scheduling, Compare, Replacement | Rows of metrics, columns of runs; each metric shows its direction ("lower is better") and a definition popover; per-row "best" marker and "tie" marker (icon + word, not only colour); averages row. Per-metric cards on phones |
| `MiniLineChart` | Replacement (faults vs frames) | Small SVG line chart, one line per policy, drawn in once; marked points get a ring + label; table toggle |
| `ChartTableToggle` | all charts | `SegmentedControl` "Chart / Table", remembered in prefs |
| `StepInspector` | all | Side panel (bottom sheet on phones): **What happened** (`label`), **Why** (`detail`), a **"Rule used" chip** when a rule decided the step (links to the rule in the RulesPanel; pops in with `--ease-snap`), **Source** (`CitationLink`) |
| `RulesPanel` | all | A drawer listing the module's conventions, fed by the core. Each rule shows its **plain** sentence, the formal rule and **why it matters** (`plain`, `text`, `whyItMatters` from `rules.ts`); the rule used on the current step is highlighted |
| `CitationLink` | all | Short form inline ("OSC10 §5.3.2"); the full reference ("Silberschatz, *Operating System Concepts* 10th ed., §5.3.2") in a popover |
| `Term` | all | Dotted underline with the glossary definition in a popover on hover, focus or tap; accessible name and description. The first use of a term on each page is wrapped. Terms come from `src/content/glossary.ts` |
| `ShortcutsSheet` | all | A `Sheet` listing every key from `keymap.ts`, opened with `?` |
| `ShareControl` | all | "Saved in this link · Copy link" in the module header |
| `EndOfRunCard` | all | Shown at the last step (and in Results on phones): the result in one sentence, "Try this next" (a contrasting preset the module supplies), and a link to the next module in the learning order |
| `ModuleGlyph` | home, header, learn path | Per-module idle picture (built in 3.1) |

Each component gets a unit test and an axe check in the component test. Every animation
uses the motion primitives from step 1; no keyframes outside `src/styles/motion.css`.

### 4. State hooks (prompt 3.2)

- `useShareState(moduleId)`: read/write `?s=` via the phase-02 codec with
  `router.replace` (no history spam), debounced.
- `useProgress()`: `localStorage` key `osv:v1`, versioned `{ v: 1, completed: string[],
  saved: { [module]: input[] }, prefs: {...} }` with a migration function. Wrapped in
  try/catch, never read during server render. Saved custom workloads/graphs, the last
  workload per module (restored by the editor), the Guided/Sandbox choice and the
  first-visit flag live here.

---

## Acceptance criteria

- [ ] `/demo` drives every building block from a fake `SimResult`, keyboard only
- [ ] `/demo` shows the workspace at desktop, tablet and phone widths; the phone tabs,
      Play → Watch, the hidden transport bar while an input has focus, and Focus mode (F)
      work
- [ ] Two `GanttChart`s on `/demo` follow one shared cursor
- [ ] No `DisclaimerBanner`; the module header carries the one-line honesty note
- [ ] `tests/tokens-contrast.test.ts` passes for both themes, including PID text on every
      process fill
- [ ] `?` opens the ShortcutsSheet; the keymap uniqueness test passes
- [ ] StepInspector shows the "Rule used" chip; RulesPanel shows plain / formal / why it
      matters for each rule
- [ ] Every component has tests and is axe clean in light and dark
- [ ] Every chart has a working table view
- [ ] Reduced motion and speeds 4–5 give instant changes (unit tests on
      `useStepTransition`); stepping back, scrubbing and jumping never animate
- [ ] `npm run verify` passes

---

## Prompts to execute

### Prompt 3.1 — tokens, primitives, shell, workspace, timeline (wave W2, parallel with the core prompts)

```
Read docs/implementation/00-overview.md, docs/implementation/03-ui-shell-and-visual-blocks.md
and docs/UIUX.md §4-§6. Look at ../internet-visualizer/src/components/viz,
src/components/prefs, src/components/ui and src/styles (and ../crypto-visualizer/src/styles
and tests/tokens-contrast.test.ts) for the originals.

Build steps 1 and 2: tokens.css from UIUX §5 and §6.2 (light/dark, a 10-colour process
palette where every colour has a pattern and the PID is always drawn as text, motion
tokens) with tests/tokens-contrast.test.ts; Geist via next/font; the no-flash script and
three-state ThemeToggle; the ui primitives (Popover, Sheet, Tabs, SegmentedControl, Kbd,
Pill); the motion primitives in UIUX §6.3 with unit tests (reduced motion and speeds 4-5
give instant changes; only forward steps animate); SiteHeader, SiteFooter, ModuleGlyph,
not-found.tsx; ModuleLayout as the workspace in UIUX §4.3 (Guided/Sandbox switch, the
one-line honesty note linking to /about#model, desktop columns with Focus mode, tablet
drawer, phone Setup/Watch/Results tabs); the /about page skeleton opening with "What this
means for you"; and the timeline UI vendored from Internet Visualizer with its small
prefs/ui/motion dependencies, restyled as the transport bar. Show ticks or steps instead
of milliseconds. keymap.ts is the single key table, with a uniqueness test. No
DisclaimerBanner. Record every vendored file and edit in VENDORED.md. Prove it with a
/demo page (noindex) driven by a fake run, showing the workspace at three widths.

Only touch src/styles, src/components/ui, src/components/motion, src/components/shell,
src/components/timeline, src/app, tests/tokens-contrast.test.ts and VENDORED.md. Done
when `npm run verify` passes. Commit.
```

### Prompt 3.2 — building blocks and state hooks (wave W3, before the module UIs)

```
Read docs/implementation/03-ui-shell-and-visual-blocks.md steps 3-4 and docs/UIUX.md
§2.2, §4.2 and §6.

Build GanttChart (with external-cursor support, fit-to-width and zoom, highlight and
bracket overlays, MLFQ lanes), QueueView, BitField (one base at a time), FrameStrip (with
Clock mode as a ring), MatrixTable (read-only and editable), MetricsTable (direction,
definitions, best and tie markers, phone cards), MiniLineChart, ChartTableToggle,
StepInspector (with the "Rule used" chip), CitationLink (full reference in a popover),
RulesPanel (plain / formal / why it matters), Term with src/content/glossary.ts,
ShortcutsSheet, ShareControl and EndOfRunCard, plus useShareState and useProgress. All
animation goes through the motion primitives. Each gets unit tests and an axe check. Add
them all to the /demo page, including two Gantt charts sharing one cursor.

Only touch src/components, src/content/glossary.ts and the /demo route. Done when
`npm run verify` passes. Commit.
```
