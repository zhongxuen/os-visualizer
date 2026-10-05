# OS Visualizer — UI/UX and motion plan

Written: 2026-10-03 · Revised: 2026-10-05 (retrofit, see below)
Status: **[planned]**
Applies to: every route in `src/app`, every shared component in `src/components`, every
module in `src/modules`. Core (`src/core`) is not touched by this plan, with two
exceptions: the home page hero reads one scheduling run from it at build time (§7.1),
and each module's `rules.ts` gains two optional **text** fields (G4).

> **Revision 2026-10-05: this is now a retrofit.** The plan was written to run alongside
> implementation waves W1–W3, but every implementation phase (01–10, including 09.3)
> was merged before any U-prompt ran. So:
>
> - U0.2 (folding the plan into the phase files) is **removed**. Those prompts have
>   already run, and G4, its only part with code impact, moved into U2.1 and U3.x.
> - Every remaining prompt in §9 says what already exists and must be **reworked, not
>   rebuilt**: tokens, header, footer, three-state theme toggle, `useReducedMotionSafe`,
>   the `Popover` and `Kbd` primitives, `KeyboardLegend`, `useProgress`, every block,
>   and the in-module Walkthrough lessons.
> - §3 records which bugs are already fixed. §9's wave table is replaced by a
>   dependency-based run order.
>
> §2 and §7 below are kept as written: they describe the target UI, and §3/§9 say
> what's left.

## Why this plan looks different from Crypto Visualizer's

Crypto Visualizer's `docs/UIUX.md` was written against a finished site. This one isn't.
On 2026-10-03 the repo holds the **phase-01 scaffold only** (`chore/scaffold`): a home
page with six "Coming soon" cards and nothing else. Every other route returns the bare
Next.js 404.

So the passes below cover two things:

1. **The live site**, run on `next dev` at 1440×900 (desktop) and 375×740 (phone), in
   light and dark, with axe and a keyboard walk (§2.1, §3).
2. **The planned site**, read as if it were built exactly as `docs/implementation/03–10`
   specify. This is a pre-mortem: where would a beginner get lost if we ship the plan
   as written? (§2.2, §2.3)

~~Because nothing is built yet, most of the fixes are amendments to the phase prompts,
not rework.~~ *Superseded 2026-10-05:* the phases were built before this plan was folded
in, so the fixes are now **rework of built UI**, run as the U-waves in §9.

Everything is judged against the aims in `CLAUDE.md`. Three of them constrain the design
directly:

- **Aim 1 (teach by stepping):** every animation must explain a step, never decorate it.
  If an animation doesn't make the *reason* for a decision easier to see, cut it.
- **Aim 5 (honesty):** the redesign keeps "textbook algorithms, not a real kernel"
  visible. It says it once and clearly, not on a banner on every page.
- **Aim 6 (quality bar):** axe on every route, keyboard-only use, reduced motion, and a
  JS budget per route. The series uses **170 KB gzipped first-load JS per module route**
  (Crypto Visualizer). Motion is CSS-first; the `motion` library is only for layout
  (FLIP) animations, and only on routes that need it.

---

## 1. The broken link (fixed 2026-10-03)

**Symptom:** `docs/README.md`, the shared-decisions index, linked to five plan files. Four
of them don't exist in this repo (`forensics-game-plan.md`, `crypto-visualizer-plan.md`,
`compiler-visualizer-plan.md`, `database-internals-visualizer-plan.md`), and the fifth
(`os-visualizer-plan.md`) is now only a stub pointing at `implementation/`.

**Cause:** `docs/README.md` was copied from the portfolio-expansion folder, where all five
plans sat next to each other. Each plan now lives in its own repo, and relative links
can't cross repos on GitHub.

**Fix:** the four cross-repo rows now name the file and the repo it lives in as plain
text. The OS row links to `implementation/00-overview.md`. The README's plan link was
already corrected to `docs/implementation/00-overview.md`. Both fixes are in commit
`7cd1bcb` ("stuff") on `main`.

**Same failure mode, not hit yet:** Crypto Visualizer's live URL returned
`DEPLOYMENT_NOT_FOUND` because the app sat on an unpushed branch while Vercel built
`main`, which held only docs. This repo is set up the same way: the app is on
`chore/scaffold` and `main` holds only docs. There was no Vercel project yet
(`.vercel/` was absent), so nothing was broken, but **phase 9.3 had to deploy from a
`main` that contains the app**. *Resolved 2026-10-05:* the scaffold was merged into
`main` (PR #1) before phase 02, so `main` has held the app ever since.

---

## 2. Beginner pass: pain points

The persona is a second-year student who has just been taught "the CPU scheduler picks
the next process" and is about to do a homework sheet on SJF and Round Robin. They know
what a program is. They don't know what a tick, a burst, a VPN or a Need matrix is.

### 2.1 The live site (scaffold)

| # | Where | Pain point |
|---|---|---|
| P1 | Home | **Nothing to do.** All six cards say "Coming soon" and none is a link. A visitor has no next step: no lesson, no demo, no explanation of what a scheduler is. They leave in about 10 seconds. |
| P2 | Home | The opening sentence is a list of jargon ("address translation, page replacement and deadlock") with no hint of what each one is or why it matters. |
| P3 | Home | "These are the textbook algorithms, not a real kernel." To a beginner this raises a question ("what's a kernel? is this wrong, then?") without answering it. It needs one more clause: *what* that means for them ("…so the numbers match your textbook, not your laptop"). |
| P4 | Home | "Module 6 · phase 2" exposes our internal roadmap vocabulary. A visitor reads "phase 2" as meaningless. Use "Coming later" or nothing. |
| P5 | Home | Six identical white boxes with no picture. Nothing shows that this is a *visual* tool. Every card should carry a small picture of its module (a Gantt strip, an address splitting into bits, a clock hand, a cycle). |
| P6 | Home | No order is suggested. Should a beginner start with Deadlock? (No: Scheduling, then Translation, then Replacement, then Deadlock.) |
| P7 | Home, desktop | The page ends after two rows of cards, leaving half the screen empty. It looks unfinished. |
| P8 | Home, phone | Six tall identical cards make a 1,550 px scroll with nothing to break it up. |
| P9 | Every page | No header, no navigation, no footer, no About link, no theme toggle. The only way to move around is the browser's address bar. |
| P10 | Any unknown URL | The bare Next.js "404 · This page could not be found." No site styling and no link home. Because the cards aren't links yet, people will type `/scheduling` by hand, so many visitors will see this page. |

### 2.2 Whole site, as planned (pre-mortem of phases 03–09)

| # | Planned feature | Pain point | Fix (wave) |
|---|---|---|---|
| G1 | No "start here" until phase 9 | `/learn` arrives last, so for most of the build a beginner lands in free play with a blank editor. | Every module **opens in Walkthrough mode the first time** (remembered in `osv:v1`), on its best preset, already at step 1. Free play is one click away. (U2.1) |
| G2 | Vocabulary | tick, burst, quantum, preempt, VPN, PFN, PTE, TLB, frame, victim, Need, Work, safe sequence, Coffman. None is defined anywhere in the plan. | A **glossary** (`src/content/glossary.ts`) and a `<Term>` component: a dotted underline, with the definition in a popover on hover, focus or tap. The first use on each page is wrapped. `/learn/glossary` lists every term. (U2.2) |
| G3 | Abbreviations in citations | "OSC10 §5.3.2" means nothing to a student who owns the 9th edition, or the book under another name. | `CitationLink` shows "Silberschatz, *Operating System Concepts* 10th ed., §5.3.2" in its popover, and the short form inline. (U2.2) |
| G4 | Rules panel | "Equal keys never preempt" and "the very first dispatch is free" are written for us, not for students. | Each rule gets a **plain sentence**, the **formal rule** and **"why it matters"** (what changes if your book uses the other convention). Each module's `rules.ts` keeps `text` (the formal rule) and `detail`, and gains optional `plain` and `whyItMatters` strings. (U2.1 renders them; each U3.x fills its own module's rules) |
| G5 | Rules panel placement | Collapsed at the bottom, so nobody opens it, and then the student's homework answer differs by one tick and they think the tool is wrong. | When a step is *decided by a rule* (a tie-break), the inspector shows a **"Rule used" chip** on that step, linked to the rule. The rules only get read when they matter. (U2.1) |
| G6 | Keyboard shortcuts | Space, ←/→, Shift+←/→, Home/End and 1–5 are invisible. | A `?` key and a visible keyboard button open a **shortcuts sheet**. The play button's tooltip shows "Space". (U2.1) |
| G7 | Timeline unit | "t = 7": a tick isn't defined. | The timecode reads "t = 7 ticks" the first time, with a `<Term>` for *tick*. (U2.1) |
| G8 | `DisclaimerBanner` on every module page | People stop seeing banners, and it takes vertical space on phones. | One line in the module header ("Textbook model, not a real kernel → what that means") linking to `/about#model`. No banner. (U1.2) |
| G9 | `ModuleLayout` on phones | Input panel + visual + inspector + pinned timeline stacked at 375 px means the visual gets about 200 px of height and the editor sits under the timeline. Opening the on-screen keyboard in the editor covers everything. | A three-tab layout on phones (**Setup / Watch / Results**). The timeline is pinned only on Watch and hidden while an input has focus. See §4.3. (U2.1) |
| G10 | Too many controls at once | MLFQ alone has levels × (quantum, allotment) + boost + a rule-4 toggle. Banker's shows five matrices. | **Progressive disclosure:** presets first, then "Edit" reveals the controls. Advanced options (context-switch cost, I/O bursts, rule 4) go under "More options". (U3.x) |
| G11 | Validation messages from Zod | Raw Zod messages ("Number must be less than or equal to 9") are developer text. | One human message per field ("Priority is 0–9; 0 is the highest"), mapped in each module, next to the field and announced. (U3.x) |
| G12 | Free play vs Walkthrough | The mode switch (`ModuleLayout`: "Walkthrough" / "Free play") has no explanation. | Name the modes **"Guided"** and **"Sandbox"** and give each a one-line description under the switch. (U2.1) |
| G13 | Process naming | Scheduling numbers processes `P1..P10`, deadlock numbers threads `T0..T7` (following OSC10). On one site, a student meets P1 and T1 and assumes they are related. | Keep the textbook names (they make homework checkable) but **explain the switch** in Deadlock's intro: "Silberschatz calls them threads T0, T1…". Use a different chip shape for threads. (U3.5) |
| G14 | Results with no reading | The metrics table gives numbers but doesn't say whether they are good or bad. | Each metric shows its direction ("lower is better") and a definition popover, and Compare's "Why?" sentence becomes the headline above the table. (U3.1, U3.2) |
| G15 | Losing work | A beginner builds a workload, follows a link to another module and loses it. `?s=` saves it, but they don't know that. | A small "Saved in this link · Copy link" control in the module header. The editor restores the last workload from `osv:v1`. (U2.1) |
| G16 | Dead ends | Each module stops at its last step. | An **end-of-run card**: the result in one sentence, "Try this next" (a preset that contrasts with it), and a link to the next module in the learning order. (U2.1, U3.x) |

### 2.3 Per module (pre-mortem)

**CPU Scheduling (`/scheduling`)**

- S1. **Burst input as an odd-length list** (CPU, I/O, CPU…) is hard to read. Use a
  **burst builder**: a row of blocks where solid blocks are CPU and outlined ones are I/O,
  with + CPU / + I/O buttons and a number in each block. A text field stays available for
  power users.
- S2. **Priority direction.** "Lower number = higher priority" surprises people. Show it
  on the column header ("Priority (0 = highest)") and as a rule chip whenever priority
  decides a step.
- S3. **Waiting vs response vs turnaround** is the classic exam confusion. When a
  process's metrics row is hovered or focused, draw three **brackets on its Gantt row**:
  arrival → first run (response), arrival → completion (turnaround), and the gaps
  (waiting) shaded. This is the single most useful visual in the module.
- S4. **Gantt and queues feel unrelated.** Hovering or focusing a process anywhere (editor
  row, queue chip, Gantt bar, metrics row) highlights it everywhere ("linked
  highlighting").
- S5. **Context-switch ticks "are neither busy nor idle"**: say this under the Gantt
  legend, with the hatched CS swatch.
- S6. **300 ticks on a phone.** A horizontal-scrolling Gantt hides the cursor. Use
  **fit-to-width by default**, auto-scrolling to follow the cursor when zoomed, with a
  zoom control (fit / 1 tick = 16 px).
- S7. **MLFQ is overwhelming.** Show the levels as horizontal lanes with the quantum and
  allotment written on each lane label. Presets explain OSTEP's rules 1–5 by name, and a
  "Which rule fired?" chip appears on every demote and boost step.
- S8. **Why didn't P2 run?** The inspector explains who ran, not who waited. Add "Waiting:
  P2 (arrived t=1, longer burst)" for the top two ready processes on dispatch steps,
  generated from the snapshot.

**Compare (`/compare`)**

- C1. Four stacked Gantt charts plus a wide table don't fit a phone. On phones show **one
  policy at a time** (a swipeable segmented control) with a mini-map of all four, and
  turn the metrics table into **cards per metric** (rows = policies).
- C2. "Best" needs a direction (higher utilisation is better, lower waiting is better),
  and a **tie** must be marked as a tie.
- C3. Make the generated "Why?" sentence the headline above the table, not a line
  underneath it.
- C4. Adding a second RR column with a different quantum isn't obvious. Add an
  "Add policy" menu with "Same policy, other settings" as an option.

**Address Translation (`/translation`)**

- T1. Beginners don't read binary or hex fluently. BitField shows **one base at a time**
  (a binary / hex / decimal toggle, binary by default) with the others on hover. The field
  split is explained with derived numbers: "16-byte pages → 4 offset bits → 4 VPN bits →
  16 pages".
- T2. **Where am I in the 7 steps?** A horizontal **pipeline** (Split → TLB → Walk →
  Check → Fill → PA → Access) with the current stage lit. Skipped stages (on a TLB hit)
  are visibly skipped, which teaches what a hit saves.
- T3. Acronyms: PTBR, PDE, PTE, PFN, VPN. Spell each out in its `<Term>`, and label the
  page-table rows with words as well ("entry for page 6").
- T4. The **sizing calculator** sits apart from the lesson. Put it on its own tab ("Why two
  levels?") with a sentence linking it to the walk the student just did.
- T5. Faults stop the access, which is correct, but the "What happens next? → Page
  Replacement" link must carry the page number over (via `?s=`) so the next module isn't
  a cold start.

**Page Replacement (`/replacement`)**

- R1. **"Cold" and "capacity" faults** need `<Term>`s and a split bar in the metrics.
- R2. **OPT "sees the future"**, so say plainly that it can't be built and is the
  yardstick. Show its look-ahead as a small "next use in 4" label under each frame,
  visible only in OPT.
- R3. **Belady's anomaly** must be a moment, not a number: when the second run passes the
  first's fault count, a callout reads "4 frames, *more* faults than 3". It respects
  reduced motion.
- R4. A 40-column frame strip on a phone: fit to width with sticky row labels, and scroll
  so the current column stays in view.
- R5. Typing a reference string: accept spaces or commas, show the parsed chips live
  underneath, and give an error per bad token.

**Deadlock (`/deadlock`)**

- D1. **Two tabs, two models.** Graph and Banker's use different state, and the plan
  doesn't say why. Each tab gets a one-line intro: "Detection: what's happening now" vs
  "Avoidance: what might happen, given every thread's maximum".
- D2. **Five matrices** (Max, Allocation, Need, Available, Work). Show Max and Allocation
  as inputs, Need as computed (visibly derived, with a "= Max − Allocation" header), and
  **Work as a separate vector bar** that grows as threads finish. Only the row being
  compared is at full strength; the rest are dimmed but still readable (contrast holds).
- D3. "Assumed by the model" in the Coffman panel is jargon. Use "Always true here: this
  simulator never shares a resource instance."
- D4. **Dragging on a phone** in React Flow is fiddly and fights page scroll. On touch,
  the canvas is **view-only with pan and zoom**, and the form is the editor. It says so.
- D5. **The safe sequence isn't unique.** The plan says so in the Rules panel. Also show
  it next to the result: "One safe order (there may be others)".

**Synchronisation (`/sync`, phase 2)**

- Y1. **Bug in the plan:** manual scheduling uses keys **1/2** to run a thread, but the
  shared timeline already binds **1–5 to playback speed**. Use the keys **A/B** (thread A,
  thread B) or `[`/`]`, and record it in the keymap. (See §3, B6.)
- Y2. A lost update must be *visible*: when a store overwrites a value that the other
  thread had already stored, the old value is struck through in MemoryView, with a "lost
  update" label.

### 2.4 About, 404 and other pages

- A1. `/about` is planned as disclaimers plus test methodology. A beginner needs the
  **"what this means for you"** version first ("numbers match your textbook; your laptop
  does more, for example…"), and the testing detail after it.
- A2. The 404 should offer the module list and `/learn`, not just a link home.
- A3. `/demo` must stay `noindex` and must not be linked from the nav.

---

## 3. Bugs and functional problems

Found in the scaffold (live) and in the plan (pre-mortem). axe was run with
`@axe-core/playwright` against `next dev`.

| # | Severity | Where | Problem | Fix (prompt) |
|---|---|---|---|---|
Status as of 2026-10-05, after phases 01–10 were merged:

| # | Severity | Where | Problem | Fix (prompt) | Status |
|---|---|---|---|---|---|
| B1 | — | `docs/README.md` | Four broken relative links to plans in other repos. | **Fixed** (§1). | fixed |
| B2 | High | repo | **The app isn't on `main`.** `main` holds docs only; the scaffold is on `chore/scaffold`. A Vercel project linked to `main` would fail with "No Next.js version detected", which is Crypto Visualizer's 404 exactly. | Merge `chore/scaffold` into `main` before phase 02 work branches off it. | **fixed** (PR #1) |
| B3 | Medium | `.gitignore` | `docs/**` is ignored. Docs added before the rule (and the force-added `ACCURACY.md`) are tracked, but **every new doc is silently ignored, this file included** (`git status --ignored` shows `!! docs/UIUX.md`). U5.1's §10 write-up would never be committed. | Remove `docs/**` from `.gitignore`, or narrow it to the files you mean to keep private. (U0.1) | open |
| B4 | Low | `main` | Commit `7cd1bcb` tracks `test-results/.last-run.json`, a Playwright artefact that `.gitignore` excludes. | `git rm --cached test-results/.last-run.json`. (U0.1) | open |
| B5 | Medium | any unknown route | The default Next.js 404: unstyled, with no link home, and axe reports `landmark-one-main` and `region` (2 nodes). | `src/app/not-found.tsx` inside the site shell. (U1.2) | open |
| B6 | Medium | `/sync` (built) | Sync's manual-step keys (1/2) collide with the timeline's speed keys (1–5). 10.ui shipped with 1/2 (`src/modules/sync/sync.test.tsx`). | Thread keys become A/B (U3.6); `keymap.test.ts` gains a uniqueness test across playback and module keys (U2.1). | open |
| B7 | Low | `layout.tsx` | `font-sans` is set, but no font is loaded, so text falls back to Segoe UI on Windows, SF on Mac and Roboto on Android. The siblings use `next/font` (Geist). | Load Geist and Geist Mono with `next/font`. (U1.1) | open |
| B8 | Low | `globals.css` | Dark mode is media-query only. The planned manual toggle needs a no-flash inline script and `data-theme` overrides (Crypto Visualizer's pattern). | — | **fixed** in 03.1 (`ThemeToggle`, `themeScript.ts`) |
| B9 | Low | `globals.css` | The reduced-motion rule only catches CSS. JS-driven animations (`motion`, the Web Animations API) ignore it. | The hook exists (`src/components/timeline/useReducedMotionSafe.ts`). Every new JS animation goes through it via the motion primitives. (U1.1) | partly |
| B10 | Low | home | Ready cards are one link wrapping the module number, an `h3` and the blurb, so screen readers announce all of it as the link name. | Link the heading only and stretch its hit area over the card (`::after` overlay). (U1.3) | open |
| B11 | Low | workspace | The pinned timeline plus the phone's on-screen keyboard covers the input being edited. | Hide the pinned timeline while an input has focus on narrow screens. (U2.1) | open |
| B12 | Info | dev only | The Next dev indicator ("N") overlaps the third card on phones. Dev only, not a production bug, but it hides content during manual testing. | `devIndicators: { position: 'bottom-right' }`, optional. | open (optional) |
| B13 | Low | `README.md` | The 09.3 README screenshots show the pre-redesign UI once the U-waves land. | Retake them. (U5.2) | open |

No horizontal overflow at 375 px, no console errors on `/`, and axe is clean on `/` in
both themes.

---

## 4. Inventory: every page, section and component, and the UI each one gets

### 4.1 Pages

| Route | Sections | UI it should have |
|---|---|---|
| `/` | Hero, "How it works" (3 steps), module grid, learning order, honesty note, footer | **Hero:** a one-sentence promise ("Step through the algorithms from your OS course, one tick at a time") and a **live miniature Gantt** (§7.1) that is itself the demo. Primary CTA "Start with CPU scheduling", secondary "See all lessons". **How it works:** three panels (Build a workload → Step through → Read why). **Module grid:** cards with a mini-picture, a status pill ("Ready", "Coming soon"), and the textbook chapter they cover. **Learning order:** a numbered rail 1→5 ("start here"). **Honesty note:** one line + link. |
| `/scheduling` … `/deadlock`, `/sync` | Module header, mode switch, workspace (Setup / Watch / Results), inspector, timeline, end-of-run card | The **module workspace** (§4.3). |
| `/learn` | Learning path, glossary link, progress | A **vertical path** (stations 1–5 with progress rings), each with lesson length and checkpoints done. Not a card grid: the order is the point. Each station opens its module in Guided mode. |
| Lessons (inside each module, Guided mode) | MDX lesson + workspace + checkpoints | Lessons already run inside each module in Walkthrough mode (09.1), so there is **no separate `/learn/<module>` route**. Guided mode gets a **reading column** (≤ 68ch) in the Setup/Inspector area, and checkpoints become question cards (§7.3). |
| `/learn/glossary` | A–Z terms | A searchable definition list, with each term linking to where it appears. |
| `/about` | What this means for you, the model, how accuracy is checked, sources, credits | A long-read page with a sticky table of contents on desktop. |
| `/demo` | Every block | Developer page, noindex, not linked. Unchanged. |
| 404 | Message, module list, learn link | Same shell; "That page isn't here" plus the module list. |

### 4.2 Shared components (`src/components`)

"Built" means it exists after phases 03–10 and is **reworked** by the named prompt, not
rebuilt.

| Component | Today (2026-10-05) | UI decision |
|---|---|---|
| `SiteHeader` | built (flat link list + toggle) → U1.2 | Wordmark (left), Modules menu (lists the registry, with status pills), Learn, About, theme toggle, keyboard-help button. On phones, a menu sheet. Sticky with a 1px rule; it shrinks on scroll on desktop only. A skip link comes first. |
| `SiteFooter` | built → U1.2 | Series links (Internet / Crypto Visualizer), GitHub, the honesty line, `/about`. |
| `ModuleLayout` | built (mode switch, banner) → U2.1 | Becomes the **workspace** (§4.3). |
| `DisclaimerBanner` | built → **removed** in U2.1 | Replaced by one line in the module header (G8). |
| `ThemeToggle` | **done** (03.1) | Three-state (System / Light / Dark), with the no-flash script. Only restyled by U1.1. |
| `Timeline` + `PlaybackControls` | vendored → U2.1 | A **transport bar**: step back, play/pause (large), step forward, then the scrubber with **phase ticks** (one notch per dispatch, reference or access) and speed. The timecode is in mono ("t = 7 ticks" or "step 7 / 23"). On phones: the three main buttons and the scrubber; speed goes into a menu. |
| `PhaseStepper` | vendored → U2.1 | Phase chips ("P2 runs t=4–7"); horizontal scroll with the current chip centred. |
| `StepCaption` | vendored → U2.1 | The **narration line**: event label in large type, detail underneath, `aria-live="polite"` throttled. It changes with a short cross-fade (§6). |
| `StepInspector` | built → U2.1 | A side panel (bottom sheet on phones): **What happened** (label), **Why** (detail), **Rule used** chip (G5), **Source** (CitationLink). |
| `RulesPanel` | built (`text`, `detail`) → U2.1 | A drawer listing rules with plain / formal / why-it-matters for each (G4); the rule used on the current step is highlighted. |
| `CitationLink` | built → U2.2 | Short form inline, full reference in a popover. |
| `GanttChart` | built → U3.1 | §7.2.1. Fit-to-width, process chips with colour + pattern + PID, a cursor, brackets on hover (S3). |
| `QueueView` | built → U3.1 | Lanes of process chips (ready / I/O / running slot), FLIP-animated. |
| `BitField` | built → U3.3 | Bit cells grouped into labelled fields, one base at a time (T1). |
| `FrameStrip` | built → U3.4 | Columns slide in; victim and loaded cells marked by shape and label; Clock mode as a ring (§7.2.4). |
| `MatrixTable` | built → U3.5 | Mono, tabular figures; the compared row at full strength; changed cells flash once; editable cells are visibly inputs. |
| `MetricsTable` | built → U3.1 / U3.2 | Direction labels, definitions, best and tie markers (icon + word). Becomes per-metric cards on phones. |
| `MiniLineChart` | built → U3.4 | Lines draw in once; the anomaly point is marked with a ring + label. Table toggle. |
| `ChartTableToggle` | built | A segmented control "Chart / Table", remembered in prefs. |
| **New:** `Term` | U2.2 | A dotted underline with a definition popover (G2). |
| `Popover`, `Kbd`, `Button`, `Switch` | built (`src/components/timeline/ui`) | Reused as-is; U1.1 re-exports them from `src/components/ui`. |
| **New:** `Sheet`, `Tabs`, `SegmentedControl`, `Pill` | U1.1 | Small primitives in `src/components/ui` (vendored from the siblings where they exist). |
| **New:** `ShortcutsSheet` | U2.1 | Opened with `?`. Wraps the existing `KeyboardLegend` (already generated from `keymap.ts`) in a `Sheet`. |
| **New:** `EndOfRunCard` | U2.1 | Result sentence, "Try this next", next module (G16). |
| **New:** `ShareControl` | U2.1 | "Saved in this link · Copy" (G15). |
| **New:** `ModuleGlyph` | U1.3 | The small animated picture for each module (cards, header, learn path). |

### 4.3 The module workspace (replaces the `ModuleLayout` description in phase 03)

```
Desktop ≥ 1024 px                                  Phone < 640 px
┌───────────────────────────────────────────────┐  ┌───────────────────────┐
│ ◇ CPU Scheduling   Guided | Sandbox   ⧉ Share │  │ ◇ CPU Scheduling   ⋯  │
│ Textbook model, not a real kernel → what      │  │ [Setup][Watch][Results]│
├──────────────┬────────────────────┬───────────┤  ├───────────────────────┤
│ Setup        │ Watch (the visual) │ Inspector │  │  (active tab only)     │
│ presets      │ Gantt / Bits /     │ What      │  │                       │
│ editor       │ Frames / Graph     │ Why       │  │                       │
│ policy       │ queues             │ Rule used │  │                       │
│ (collapsible)│                    │ Source    │  ├───────────────────────┤
├──────────────┴────────────────────┴───────────┤  │ caption               │
│ caption · ◀ ▶︎ ▶ ═══|══╪══╪════ t = 7 ticks · 1× │  │ ◀  ▶︎  ▶  ═══|══════  │
└───────────────────────────────────────────────┘  └───────────────────────┘
```

- **Tablet (640–1023 px):** Setup collapses into a drawer opened from the header; the
  Inspector sits under the visual.
- **Phone:** three tabs. Pressing Play from Setup switches to Watch. Results shows the
  metrics and the end-of-run card. The transport bar is pinned only on Watch, and is
  hidden while an input has focus (B11).
- The Setup column can be collapsed on desktop to give the visual full width ("Focus
  mode", key `F`).

---

## 5. Theme: "Timing diagram"

**Why this theme.** Most of what this site draws is a **timing diagram**: a Gantt chart is
a CPU timing diagram, a frame strip is a memory timing diagram, and a race is two
threads' timing diagrams interleaved. So the theme borrows from **datasheets and logic
analysers**: precise, calm, gridded, with colour reserved for the things being scheduled.
It suits a course tool (it looks like a lab instrument, not a toy), it fits the series
(Internet Visualizer is a network map, Crypto Visualizer is a lab notebook), and it isn't
the usual cliché (green-on-black terminal text, which also fails contrast and reads as
"hacker", not "course").

### 5.1 Colour

**Light, "Datasheet":** warm off-white paper with a faint 8 px tick grid behind visuals
only (never behind text). Near-black ink. One signal-blue accent.
**Dark, "Logic analyser":** deep blue-grey graphite, slightly brighter trace colours,
and the same grid at lower contrast.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f6f5f1` | `#0f1217` | page |
| `--surface` | `#ffffff` | `#161b22` | panels |
| `--surface-2` | `#efede7` | `#1d232c` | wells, editor fields |
| `--grid` | `#e4e1d8` | `#232a34` | tick grid, rulers (decorative only) |
| `--fg` | `#17191e` | `#e8eaee` | text |
| `--fg-muted` | `#555a63` | `#a1a8b3` | secondary text (must stay ≥ 4.5:1 on every surface) |
| `--border` | `#cfcbc0` | `#323a46` | panel rules (≥ 3:1 for UI borders) |
| `--accent` | `#1f5bd0` | `#7aa7ff` | links, focus, cursor, current step |
| `--ok` / `--warn` / `--danger` | green / amber / red | lighter versions | hit, wait, fault/deadlock (always with icon + word) |
| `--cs` | hatched grey | hatched grey | context switch |
| `--idle` | dotted grey | dotted grey | idle |

**Process palette (10):** based on Okabe–Ito, extended to ten, each paired with a
**pattern** (solid, diagonal, dots, cross-hatch, vertical, horizontal, checker, wave,
zig-zag, ring) and the PID always printed. Bars use a pale fill and a strong edge so the
PID text stays ≥ 4.5:1 on every fill. The same palette marks pages in Page Replacement
(page 0–15 → hue by `id mod 10` + a number) and threads in Deadlock (thread chips are
**rounded squares**; process chips in Scheduling are **pills**, G13).

The exact hex values are set in U1.1 and asserted by a token contrast test (Internet and
Crypto Visualizer's `tests/tokens-contrast.test.ts` pattern), plus a deuteranopia
screenshot in U5.1.

### 5.2 Type

- **Geist Sans** for UI and prose (the series font). Display: Geist 700, tight tracking,
  clamp-scaled (`2.25rem → 3.5rem`).
- **Geist Mono** for **every number the simulation produces**: ticks, PIDs, addresses,
  bits, matrices, metrics. `font-variant-numeric: tabular-nums` so columns don't jitter
  while values change during playback. That jitter is a real readability bug in animated
  tables.
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48. Body 16, prose line length ≤ 68ch.

### 5.3 Surfaces and details

- **Rulers as dividers:** section breaks are a thin rule with tick marks every 8 px (a
  CSS gradient, no images), echoing the Gantt axis.
- Panels: 1 px border, 6 px radius, no drop shadows in light; in dark, a 1 px inner
  highlight.
- **Focus ring:** 2 px accent + 2 px offset, the same everywhere, visible on every
  surface.
- **Hatching** (`.pattern-cs`, `.pattern-idle`, and the process patterns) is defined
  once in CSS as `background-image` gradients, and exported as SVG `<pattern>`s for
  charts.
- Icons: `lucide-react` (already a dependency), 16/20 px, stroke 1.75.

---

## 6. Motion system

### 6.1 Rules

1. **Motion explains a step.** Every animation answers "what changed and why". Purely
   decorative motion is allowed only in idle glyphs (§7.1), which are `aria-hidden`.
2. **Forward steps animate; everything else is instant.** Scrubbing, jumping (Home/End,
   phase jumps), stepping back and loading a URL go straight to the state. A step-back
   animation would teach a process that never happened.
3. **Animations fit inside the step.** Duration = `min(token, 0.6 × step interval)` at the
   current speed. At speeds 4–5, animations collapse to instant, so fast playback never
   queues animations behind the timeline.
4. **State is never only in motion.** Every animated change ends in a static visual that
   shows the same thing (a mark, a label, a pattern), so a paused frame and a
   reduced-motion user see everything.
5. **Reduced motion:** CSS durations collapse globally (already in `globals.css`), and JS
   animations go through `useReducedMotionSafe()` (B9). Highlights still appear, just
   without movement.
6. **Budget:** CSS transitions and the Web Animations API first. The `motion` library
   (already a dependency) is used only for FLIP layout animations (queue chips, frame
   cells, Compare columns), is imported only by the modules that need it, and never by
   the home page. Each route stays under 170 KB gzipped first-load JS (U5.1).
7. **No layout shift:** animate `transform` and `opacity` only. Bars grow with
   `scaleX` from a fixed origin, never by changing `width`.

### 6.2 Tokens (`src/styles/tokens.css`)

```
--dur-1: 120ms   highlights, chip state, colour changes
--dur-2: 220ms   movement: a chip changing queue, a bar extending one tick
--dur-3: 360ms   arrivals and exits: a page loading into a frame, a phase change
--ease-out:   cubic-bezier(.2, .8, .2, 1)
--ease-inout: cubic-bezier(.6, 0, .3, 1)
--ease-snap:  cubic-bezier(.3, 1.4, .5, 1)   (one small overshoot, used only for "decided" moments)
```

### 6.3 Primitives (`src/components/motion/`, new)

| Primitive | What it does | Implementation |
|---|---|---|
| `useStepTransition()` | Returns `{ animate: boolean, duration }` for the current step change, applying rules 2, 3 and 5 | hook over `usePlayback` |
| `<Flash>` | One-shot background pulse on a value that changed (matrix cell, counter) | CSS keyframe, re-keyed per step |
| `<Ticker>` | Number roll for counters (faults, hits, t) | CSS `translateY` over a digit column, tabular |
| `<DrawPath>` | Draws an SVG path or edge in (stroke-dashoffset) | CSS |
| `<Flip>` | Layout animation for reordering lists | `motion`'s `layout`, lazy-loaded |
| `ModuleGlyph` | Idle loops for each module (§7.1) | CSS keyframes in `src/styles/motion.css`, `aria-hidden` |

---

## 7. Animations per page and component

### 7.1 Site and shell

| Where | Animation | What it teaches |
|---|---|---|
| Home hero | A **miniature Gantt chart** of Round Robin (q = 2) on three processes **draws itself tick by tick** with a moving cursor and a one-line caption ("P2 runs: quantum expired for P1"), loops every ~8 s, and pauses on hover or focus. The SVG and its keyframes are **generated on the server from the real core run** (the core is pure, so a Server Component can call `schedule()` at build time): zero client JS, and the hero is provably the real algorithm. | The site's whole idea in one picture. |
| Module cards (`ModuleGlyph`) | Scheduling: three bars filling in turn. Compare: two Gantt strips of different lengths. Translation: a binary number splitting into two coloured fields. Replacement: a column of frames with one page dropping out and another in. Deadlock: two nodes and two arrows forming a loop, which pulses. Sync: two counters racing, one striking through. Glyphs play once on view, loop on hover and focus, and rest on a frame that still shows the idea. | What each module *looks like*, before reading a word (P5). |
| Card hover / focus | Lift 2 px, border to accent, glyph starts | Affordance |
| Header | Shrinks on scroll (desktop), sheet slides in on phones | — |
| Theme toggle | Sun/moon icon cross-fade, no full-page transition | — |
| Learn path | Progress rings fill on view; a finished station gets a tick | Progress |
| Page transitions | None (the View Transitions API isn't worth the risk to the budget; revisit after U5) | — |

### 7.2 Modules

#### 7.2.1 CPU Scheduling

| Component | Animation |
|---|---|
| `GanttChart` | On each tick the running bar **extends by one tick** (`scaleX` from its left edge, `--dur-2`). A new segment **fades in with its PID label**. The **cursor glides** to the next tick. Idle ticks draw as dotted, and CS ticks **wipe in as hatching** (a shutter). On preemption, the old bar's end gets a small notch mark (a static marker remains). |
| `QueueView` | Arrival: the chip **slides in from the left** into the ready lane. Dispatch: the chip **moves into the CPU slot** (FLIP), and the slot's outline snaps. Quantum expiry: a **ring timer** around the running chip drains over the quantum; when empty, the chip moves to the **tail** of the queue (FLIP), *behind* any same-tick arrivals, which shows rule 3 happening. I/O: the chip drops to the I/O lane with a countdown badge. Finish: the chip shrinks into a ✓ in a "done" tray. |
| MLFQ lanes | Demote: the chip **steps down one lane** (FLIP, `--dur-3`) with a "Rule 4" chip. Boost: every chip **rises to the top lane together**, and the lane labels flash "Rule 5: boost". |
| Aging | The priority badge on a waiting chip **ticks down** (`<Ticker>`) every `every` ticks. |
| Metrics | Values settle with `<Ticker>` when a process finishes. On row hover, **brackets draw** on the Gantt (S3) with `<DrawPath>`. |
| Inspector | Caption cross-fade; the "Rule used" chip pops in with `--ease-snap`. |
| Editor | Adding a process: the row expands (height via a grid-row transition), and a burst block appears in the burst builder. |

#### 7.2.2 Compare

| Component | Animation |
|---|---|
| Stacked Gantts | All charts extend together under one shared cursor (a vertical line through every chart). A run that finishes early shows a "done at t = 23" flag that drops in. |
| Metrics | At the end of the run the **best cell in each row gets its marker** in sequence, top to bottom (staggered 60 ms); ties get a "tie" marker. The "Why?" headline types in once (respects reduced motion). |
| Add/remove policy | Columns reflow with `<Flip>`. |

#### 7.2.3 Address Translation

| Component | Animation |
|---|---|
| `BitField` | Split: the address **separates into fields** (the gap opens with `--dur-3`), and each field tints and gets its label. The VPN field then **travels** (a ghost copy) to the TLB. |
| Pipeline (T2) | The current stage lights up; the path between stages **draws in**. On a TLB hit, the Walk and Check stages **dim with a "skipped" strike**, which shows the saving. |
| `TlbView` | Lookup: a **scan highlight sweeps** down the entries. Hit: the matching row **pulses green with ✓ Hit**. Miss: every row gets an × and the scan line exits the bottom. Fill: the evicted entry slides out and the new one slides in (FLIP). |
| `PageTableView` | Walk: an arrow **draws from PTBR** to the PTE address (two hops for two levels: PTBR → PDE → PTE), each hop with a memory-reference counter `<Ticker>` +1. Invalid: the row gets a hatched red "invalid" mark. Protection fault: a lock icon. |
| Physical address | The PFN and the offset **slide together** into the PA readout. |
| Sizing tab | Bars for linear vs two-level size **grow** to their values, and the saving is labelled. |

#### 7.2.4 Page Replacement

| Component | Animation |
|---|---|
| Reference string | The current reference chip **lifts and is underlined**; past ones are marked H or F. |
| `FrameStrip` | Each reference adds a **column that slides in** from the right. Hit: the page's cell **pulses** with an H. Fault: the victim cell **drops out** (translateY + fade), then the new page **drops in** (`--dur-3`). The victim's reason appears as a label ("loaded first"). |
| Clock mode | Frames drawn as a **ring** with a **hand that rotates** frame to frame. Use bits flip 1→0 with a small flip animation as the hand sweeps (one rotation step per scan event). The hand's resting position is always drawn. |
| OPT look-ahead | "Next use in n" labels count down with `<Ticker>`; the furthest one gets a ring before eviction. |
| LRU | "Last used t" labels; the oldest one gets the ring. |
| `BeladyPanel` | Two fault counters roll side by side. When the 4-frame counter overtakes the 3-frame one, a callout **slides in** ("4 frames, more faults") (R3). |
| `CurvePanel` | Lines **draw left to right** once on first view; the anomaly point gets a ring + label. |

#### 7.2.5 Deadlock

| Component | Animation |
|---|---|
| Graph canvas | Request edges are **dashed and flowing** (`--idle-flow`, a CSS stroke-dashoffset loop) toward the resource; assignment edges are solid. During cycle detection, the DFS path **draws edge by edge**; when the cycle closes, its edges **pulse in sequence around the loop** and stay highlighted (static: thicker, red, labelled "cycle"). |
| Form editor | A new edge appears in the canvas with `<DrawPath>`; a removed edge fades. |
| Detection / Banker's | **Work vector bar** (D2): when a thread can finish, its Allocation row **flows into Work** (cells slide down into the vector), and Work's numbers roll. The `Need_i ≤ Work` comparison shows a ✓ or × **per column**, popping in left to right, so you can see *which* resource blocks a thread. Finished threads get a ✓ and dim (contrast still holds). |
| Safe sequence | Chips **append** one by one as threads finish. Unsafe: the remaining threads get a red outline and "can't finish". |
| Request algorithm | Each check (≤ Need, ≤ Available, pretend, safety) is a step in a checklist that ticks. "Pretend to allocate" shows the matrices **ghosted** (dashed borders), and a roll-back **reverts** them visibly. |
| Recovery | The terminated thread **fades out of the graph** and its resources **return to the pool** (edges retract), then detection re-runs. |
| Coffman panel | Each condition's state changes with a flip; "violated by you" appears after a preempt. |

#### 7.2.6 Synchronisation (phase 2)

| Component | Animation |
|---|---|
| ThreadColumns | A program-counter arrow **steps down** the ops; a blocked thread greys and shows a lock icon with a waiting animation (a slow pulse, reduced-motion safe). |
| MemoryView | Register and memory values **roll** (`<Ticker>`); a lost update **strikes through** the overwritten value (Y2). The lock owner chip **moves** between threads (FLIP). Semaphore waiters queue as chips. |
| OutcomeHistogram | Bars grow once; clicking a bar loads an interleaving and the schedule bar **fills in**. |

### 7.3 Lessons

- Checkpoint cards: the question appears, the timeline pauses (the transport bar shows a
  "paused for a question" state), the answer options are buttons. Correct: a ✓ and a
  short reveal of the next step. Wrong: an × and the reason from the event label. No
  confetti.
- "Try it" embeds scroll into view and start at the right step.

---

## 8. Not in scope

- A light/dark *theme switcher* beyond System / Light / Dark.
- Sound.
- Page-level transitions (View Transitions API), until U5 shows budget to spare.
- 3D, WebGL, canvas rendering. Everything stays SVG and DOM so it stays accessible.
- Changing any core algorithm, event shape or tie-break. This plan only *displays* what
  the core decides. (The `plain` and `whyItMatters` fields added to `rules.ts` in U3.x are text, not
  logic.)
- Accounts, a database or analytics beyond `@vercel/analytics` (`CLAUDE.md`: no database).

---

## 9. Waves and prompts

The implementation (phases 01–10) is merged, so the U-waves now run **after** it, as a
retrofit. The order below follows real dependencies and which files each prompt touches,
not the implementation waves. U0.2 is removed (see the revision note at the top).

### 9.1 Run order

| Step | Prompts | Runs | Waits for | Why it can't start earlier |
|---|---|---|---|---|
| **1** | U0.1 | alone | — | Until B3 is fixed, this file and §10 can't be committed. |
| **2** | U1.1 | alone | U0.1 | Tokens, fonts and primitives are used by everything after it. |
| **3** | U1.2 ∥ U1.3 ∥ U2.2 | 3 worktrees | U1.1 | U2.2 needs only U1.1's primitives; no file overlap with the shell or home page. |
| **4** | U2.1 | alone | U1.2 | Reworks `ModuleLayout` in `src/components/shell`, which U1.2 also edits. Can start while U1.3 and U2.2 are still running. |
| **5** | U3.1 ∥ U3.3 ∥ U3.4 ∥ U3.5 ∥ U3.6 ∥ U4.1 | 6 worktrees | U2.1 + U2.2 | All need the workspace, `<Term>` and the motion primitives. Their folders don't overlap. |
| **6** | U3.2 | joins step 5 | U3.1 | Reuses the scheduling renderers U3.1 reworks. |
| **7** | U5.1 → U5.2 | sequential | all of the above | QA of the finished site. |

So prompts from different waves can run together in three places: **U2.2 with U1.2 and
U1.3**, **U4.1 with the U3 wave**, and **U3.6 with the rest of U3** (10.ui is already
merged).

**Parallel rules.** As `CLAUDE.md`: own worktree
(`git worktree add ../osv-<name> -b feat/<name>`), only your own folders, append-only
shared files, merge one branch at a time, `npm run verify` after each merge. Every
`npm run test:e2e` defaults to port 3100, so in steps 3 and 5 each worktree sets its own
`PLAYWRIGHT_PORT` (3101, 3102, …). **A U-prompt never changes a shared contract** (event
types, the timeline API, a shared component's required props); if it needs to, it stops
and reports. Adding *optional* props to a shared component is allowed only in the prompt
that owns that component (U1.x, U2.x).

---

### Prompt U0.1 — repo fixes (step 1)

```
Read docs/UIUX.md §3 (B3, B4).

1. B3: remove `docs/**` from .gitignore (ask me first if you think some docs were meant
   to stay private). Then `git add docs/UIUX.md`.
2. B4: `git rm --cached test-results/.last-run.json`.
3. Run `npm run verify`. When it passes, commit on main as
   "chore: track docs, untrack Playwright artefact". Don't push until I say so.

Report what changed and the final `git log --oneline -3`.
```

### Prompt U1.1 — theme, type and primitives (step 2)

```
Read docs/UIUX.md §5 and §6. Look at ../crypto-visualizer/src/styles/tokens.css,
../internet-visualizer/src/styles/tokens.css and motion.css for the pattern.

These already exist; rework them, don't duplicate them: src/styles/tokens.css,
src/styles/process.css, src/components/shell/tokens.test.ts, ThemeToggle.tsx,
themeScript.ts (three-state + no-flash, done: B8), and
src/components/timeline/useReducedMotionSafe.ts plus timeline/ui/{Popover,Kbd,Button,Switch}.

Build the "Timing diagram" theme:
- tokens.css: set every colour token in §5.1 for light and dark (keep the existing
  prefers-color-scheme + :root[data-theme] structure), the 10-colour process palette
  with a pattern each (process.css), --cs and --idle hatching, the type scale, the
  motion tokens in §6.2. Keep existing token names where a component uses them, or
  rename everywhere in one go. Wire into Tailwind v4 @theme in globals.css.
- Extend tokens.test.ts: every text pair >= 4.5:1 and every UI border >= 3:1 on every
  surface, both themes, including PID text on each process fill.
- Load Geist and Geist Mono with next/font (B7); a tabular-nums utility for numbers.
- src/components/ui: Sheet, Tabs, SegmentedControl, Pill (new), and re-export the
  existing Popover, Kbd, Button and Switch from timeline/ui (don't move them: the
  timeline is vendored).
- src/components/motion/: useStepTransition, Flash, Ticker, DrawPath and Flip (which
  lazy-loads `motion`), all going through the existing useReducedMotionSafe (B9).
  Each with a unit test, including that reduced motion and speeds 4-5 give instant
  changes.
- src/styles/motion.css: idle keyframes for ModuleGlyph.

Only touch src/styles, src/app/globals.css, src/app/layout.tsx, src/components/motion,
src/components/ui, src/components/shell/{tokens.test.ts,ThemeToggle.tsx} and tests/.
Done when `npm run verify` passes. Commit.
```

### Prompt U1.2 — shell and 404 (step 3, parallel with U1.3 and U2.2)

```
Read docs/UIUX.md §2.1 (P9, P10), §2.4 (A2, A3), §3 (B5) and §4.2 (SiteHeader,
SiteFooter). U1.1 is merged.

SiteHeader and SiteFooter exist; rework them. Header: skip link, wordmark, a Modules
menu from the registry with status pills ("Ready" / "Coming later", never "phase 2"),
Learn, About, ThemeToggle, a keyboard-help button (it dispatches the same `?` action
the ShortcutsSheet will listen for in U2.1; until then it opens the existing
KeyboardLegend in a Popover), and a menu Sheet on phones. Sticky with a 1px rule.
Footer: series links (Internet / Crypto Visualizer), GitHub, the honesty line, /about.
Add src/app/not-found.tsx inside the shell with the module list and a /learn link (B5,
A2). /demo stays noindex and unlinked (A3). Don't touch /about (U4.1 owns it) or
ModuleLayout (U2.1 owns it).

Playwright: axe clean on /, /about and a 404 in both themes; a keyboard walk reaches
every header control; no horizontal scroll at 375 px. Use PLAYWRIGHT_PORT=3101.
Only touch src/components/shell/{SiteHeader,SiteFooter}*, src/app/not-found.tsx and
e2e/. Done when `npm run verify` and `npm run test:e2e` pass. Commit.
```

### Prompt U1.3 — home page (step 3, parallel with U1.2 and U2.2)

```
Read docs/UIUX.md §2.1 (P1-P8), §3 (B10), §4.1 (the / row) and §7.1. U1.1 is merged.

Rebuild src/app/page.tsx: the hero with its promise, CTAs and the server-generated
miniature Gantt (call `schedule()` from src/core/sched in the Server Component: RR q=2
on three processes), "How it works", the module grid with ModuleGlyph pictures, status
pills ("Ready" / "Coming later", P4) and textbook chapters, the numbered learning order,
and a one-line honesty note that says what it means for the student (P3). Cards link
from the heading only, stretched over the card (B10).

The home page must ship no `motion` import and no client component except the theme
toggle; the hero animation is CSS keyframes. It must pause on hover and focus and
respect reduced motion. Check the first-load JS for / in the build output and report it.
Only touch src/app/page.tsx, src/components/home and src/components/ModuleGlyph*.
Done when `npm run verify` passes. Commit.
```

### Prompt U2.1 — the module workspace and timeline UX (step 4)

```
Read docs/UIUX.md §2.2 (G1, G4-G9, G12, G15, G16), §3 (B6, B11), §4.2-4.3 and §6.1.
U1.1 and U1.2 are merged.

Rework src/components/shell/ModuleLayout.tsx into the workspace in §4.3: the desktop
three-column layout with a collapsible Setup column and Focus mode (F), the tablet
drawer, and the phone Setup/Watch/Results tabs where Play switches to Watch and the
pinned transport bar hides while an input has focus (B11). Delete DisclaimerBanner and
replace it with the one-line module-header note linking /about#model (G8). Rename the
modes "Walkthrough" / "Free play" to "Guided" / "Sandbox" with one-line descriptions
(G12), and open Guided on the first visit to each module (remembered in osv:v1, G1).
Add the "Rule used" chip in StepInspector (G5). Give RulesPanel's Rule type optional
`plain` and `whyItMatters` fields, render plain / formal (`text`) / why-it-matters, and
highlight the rule used on the current step (G4). Add ShortcutsSheet (`?`) wrapping
KeyboardLegend, and wire the header's keyboard-help button to it (G6); extend
keymap.test.ts with a uniqueness test that will also cover module keys (B6). Add
ShareControl (G15) and EndOfRunCard (G16). Restyle the transport bar per §4.2 (phase
notches, mono timecode "t = 7 ticks", G7). Apply useStepTransition so forward steps
animate and scrub, jump and back are instant.

Every module route must still render and pass its existing tests; adjust module call
sites only where a renamed prop forces it, and list each one in the commit message.
Update /demo to show the workspace at all three sizes. Playwright: screenshots at 1366,
800 and 390 px, axe in both themes, a keyboard walk through every workspace control.
Only touch src/components (shell, timeline, inspector, state), /demo and those forced
call sites. Don't change the timeline's public API; if you must, stop and report.
Done when `npm run verify` and `npm run test:e2e` pass. Commit.
```

### Prompt U2.2 — glossary, Term and citations (step 3, parallel with U1.2 and U1.3)

```
Read docs/UIUX.md §2.2 (G2, G3) and §2.3 (T3, R1, D3). U1.1 is merged.

Add src/content/glossary.ts (term, short definition <= 25 words, long definition, the
modules it appears in) covering at least: process, thread, tick, burst, CPU burst,
I/O burst, arrival, quantum, preempt, context switch, ready queue, waiting time,
turnaround time, response time, throughput, utilisation, starvation, aging, MLFQ,
virtual address, physical address, page, frame, offset, VPN, PFN, PTE, PDE, PTBR, TLB,
TLB hit/miss, valid bit, protection bit, page fault, reference string, victim, cold
fault, capacity fault, Belady's anomaly, use bit, resource-allocation graph, wait-for
graph, deadlock, safe state, safe sequence, Need, Work, Available, mutual exclusion,
hold and wait, no preemption, circular wait, race condition, critical section, mutex,
semaphore, lost update. Build <Term> on the existing Popover (dotted underline,
definition on hover, focus and tap, accessible name and description), and make the
existing CitationLink show the full book reference in a popover. Test: every glossary
term is unique, every <Term id> used anywhere exists (a static scan), and axe on the
popover.

Only touch src/content/glossary.ts, src/components/glossary,
src/components/inspector/CitationLink* and tests/. Done when `npm run verify` passes.
Commit.
```

### Prompts U3.1–U3.6 — modules (step 5, one worktree each; U3.2 in step 6)

Every module's UI is already merged, so all six start as soon as U2.1 and U2.2 are
merged. U3.2 (Compare) waits for U3.1 because it reuses the scheduling renderers. Each
prompt uses the same template:

```
Read docs/UIUX.md §2.2, §2.3 (<module section>), §6 and §7.2.<n>, then
src/modules/<module>. The shared workspace, glossary and motion primitives exist.

Apply every pain-point fix for this module in §2.3 and every animation in §7.2.<n>,
using the shared motion primitives only (no new keyframes outside src/styles/motion.css,
no direct `motion` import except through <Flip>). Wrap the first use of each glossary
term in <Term>. Map validation messages to human text (G11). Add progressive disclosure
(G10): presets first, Edit reveals controls, advanced options under "More options". Add
the end-of-run card's "Try this next" preset and next-module link. Fill `plain` and
`whyItMatters` for every rule in src/core/<core>/rules.ts (G4; text only: no other
change to core, and the existing rules tests must still pass unchanged).

Tests: a unit test per new behaviour; e2e screenshots at 1366 and 390 px in both themes;
axe; a keyboard-only walk that builds an input, plays, steps and reads the result; the
reduced-motion e2e that steps forward and asserts no element has a running animation.
Set PLAYWRIGHT_PORT to <port>. Report the route's first-load JS against the 170 KB
budget.

Only touch src/modules/<module>/, src/app/(modules)/<route>/,
src/core/<core>/rules.ts and e2e/<module>*. Don't change shared components; if you
need to, stop and report.
Done when `npm run verify` and `npm run test:e2e` pass. Commit on feat/ux-<module>.
```

| Prompt | `<module>` | `<core>` | Port | §2.3 items | §7.2 | Extra acceptance |
|---|---|---|---|---|---|---|
| U3.1 | scheduling | sched | 3111 | S1–S8 | 7.2.1 | Hovering a metrics row draws the three brackets (S3); linked highlighting across editor, queue, Gantt and metrics (S4); the Gantt fits 300 ticks at 390 px and follows the cursor (S6) |
| U3.2 | compare | — (sched's rules are U3.1's) | 3112 | C1–C4 | 7.2.2 | Phone view shows one policy at a time with a mini-map; ties are marked as ties; the "Why?" headline names the right policy (reuse the property test) |
| U3.3 | translation | vm | 3113 | T1–T5 | 7.2.3 | The pipeline shows skipped stages on a hit; the fault link carries the page to /replacement via ?s= |
| U3.4 | replacement | replace | 3114 | R1–R5 | 7.2.4 | The Belady callout appears exactly when 4-frame faults pass 3-frame faults; Clock ring hand position matches the snapshot on every step |
| U3.5 | deadlock | deadlock | 3115 | D1–D5, G13 | 7.2.5 | Canvas is view-only on touch; per-column ≤ checks visible; React Flow still only in the /deadlock chunk |
| U3.6 | sync | sync | 3116 | Y1, Y2, B6 | 7.2.6 | Thread keys are A/B (update `sync.test.tsx`, which still fires 1/2); keys registered so U2.1's uniqueness test covers them; lost update struck through |

### Prompt U4.1 — learning path, Guided lessons and about (step 5, parallel with U3)

```
Read docs/UIUX.md §2.4 (A1), §4.1 (/learn, Lessons, /learn/glossary, /about) and §7.3.
U2.1 and U2.2 are merged. Lessons already run inside each module (src/components/lesson,
src/content/lessons, src/app/learn/LessonList.tsx); there is no /learn/<module> route
and none is to be added.

Rebuild /learn as a vertical path with progress rings from the existing useProgress,
each station opening its module in Guided mode. Add /learn/glossary (searchable, each
term linking to the modules it appears in). Restyle the lesson UI in Guided mode: a
reading column <= 68ch, "Try it" steps that scroll the visual into view at the right
step, and the Checkpoint card states in §7.3. Wrap glossary terms in the lesson MDX in
<Term>. Reorganise /about: "What this means for you" first (A1), then the model (with
an #model anchor for the workspace header link), how accuracy is checked, sources and
credits, with a sticky table of contents on desktop. Keep reading conventions from each
module's rules.ts as it does now.

Playwright (PLAYWRIGHT_PORT=3117): complete one checkpoint by keyboard, check /learn
shows progress after a reload, axe on /learn, /learn/glossary and /about in both themes.
Only touch src/app/learn, src/app/about, src/components/lesson, src/content/lessons and
e2e/learn*, e2e/about*. Done when `npm run verify` and `npm run test:e2e` pass. Commit.
```

### Prompt U5.1 — QA pass (step 7)

```
Read docs/UIUX.md in full.

On a production build (`npm run build && npm run start -p 3100`), at 1366×850 and
390×844 in light and dark, walk the site as the beginner in §2 and check every item in
§2 and §3 against what's built. Run: axe on every route, both themes, Guided and
Sandbox; the keyboard walk per module; the deuteranopia screenshot of Gantt, FrameStrip
and the deadlock graph; the reduced-motion e2e; the per-route first-load JS against
170 KB gzipped. Fix what fails, if the fix is inside the UI. Anything that needs a core
or contract change gets reported, not fixed.

Fill in §10 of docs/UIUX.md: a table per section (§2 items, §3 bugs, §7 animations)
with done / partly / not done and evidence (test name or screenshot path), plus the
bundle table. Commit.
```

### Prompt U5.2 — beginner re-test, README and close (step 7, after U5.1)

```
Read docs/UIUX.md §2 and §10.

Do one fresh beginner walk with no knowledge of this plan: open /, follow the suggested
order through every module in Guided mode, and write down anything still confusing,
broken or slow, in the §2 table format, as §10.1 "Second pass". Fix the small ones;
list the rest as follow-ups. Retake the README screenshots so they show the new design
(B13), and check every other README claim still matches the site. Set this file's
Status to [done] with the date. Commit.
```

---

## 10. QA results

*Empty until U5.1.*
