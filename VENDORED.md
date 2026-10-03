# Vendored code

Code copied from another repository. Vendored files are **byte-identical** to the source;
don't edit them here. To pick up a fix, re-copy from a newer source commit and update this
file.

## Playback kernel and seeded RNG — Internet Visualizer

- **Source:** `../internet-visualizer` (the Internet Visualizer repo), commit
  `59ae4ad613935fd4ea523433a419081863819b21` ("Add MIT licence")
- **Licence:** MIT, same author
- **Why:** the Visualizer Series shares one kernel pattern and timeline. Playback (play,
  pause, seek, step by phase or event, speeds) and the seeded PRNG are already written and
  tested there; copying them keeps behaviour identical across the series.

| File here | Source path | Git blob |
|---|---|---|
| `src/core/sim/playback.ts` | `src/core/sim/playback.ts` | `23968126049cacd75d1a642a3090dff44ff04021` |
| `src/core/sim/rng.ts` | `src/core/sim/rng.ts` | `7572d51d34ba5a86cd27624c20d56bf9561214bc` |
| `src/core/sim/__tests__/playback.test.ts` | `src/core/sim/__tests__/playback.test.ts` | `80457dc157a899521bb3747428eebc3cc2c14cf5` |
| `src/core/sim/__tests__/rng.test.ts` | `src/core/sim/__tests__/rng.test.ts` | `3ad5ed2c857edbe7bb601498df89248d0a918ecb` |

Check them with `git hash-object <file>`; each must print the blob above.

### Local files the vendored code depends on (not vendored)

- **`src/core/sim/result.ts`** is a local re-implementation of the same contract.
  Internet Visualizer's `result.ts` imports its PDU and packet event types, so it can't be
  copied unchanged. This one exports the names `playback.ts` imports, with the same shape
  minus PDUs:
  - `SimResult<E extends TimedEvent = TimedEvent>` has `events`, `phases` and `durationMs`
    (no `pdus`). The event type is a parameter; its default lets the vendored
    `import type { SimResult } from './result'` compile unchanged.
  - `PhaseSummary` has the same fields.
  - `summarizePhases(starts, durationMs)` has the same semantics (half-open
    `[startMs, endMs)`, last phase ends at `max(durationMs, startMs)`, `plain` omitted
    when absent). The one difference is its input: Internet Visualizer filters
    `{ kind: 'phase' }` events out of the event list, whereas here the run builder
    (`src/core/events/builder.ts`) records phase starts separately and passes them in, so
    the `OsEvent` union only holds module events.
- **`src/core/sim/toyRun.ts`** is a small local stand-in for Internet Visualizer's toy
  ping run, which the vendored `playback.test.ts` imports as `../toyRun`. It reproduces
  only what that test reads (phase starts, event times, duration), without PDUs or a
  topology.

`src/core/sim/result.test.ts` checks that the vendored `timelineFrom` accepts a local
result, and `src/core/events/builder.test.ts` checks the same for `createRun` output in
both tick and step units.

## Timeline UI and its small dependencies — Internet Visualizer

- **Source:** `../internet-visualizer`, same commit as above
  (`59ae4ad613935fd4ea523433a419081863819b21`)
- **Licence:** MIT, same author
- **Why:** the series shares one transport bar. Copying it keeps the controls, the
  keyboard map and their accessibility work identical across the visualizers.
- **Where:** phase 03.1 may only touch `src/components/timeline` and
  `src/components/shell`, so Internet Visualizer's `ui` and `motion` pieces are vendored
  *into* `src/components/timeline/`, and its `prefs` is replaced by a stand-in in
  `shell/`.

### Unchanged (byte-identical)

| File here | Source path | Git blob |
|---|---|---|
| `src/components/timeline/frameClock.ts` | `src/components/viz/frameClock.ts` | `52383501daf8d3b4ce31e165fd11de2330a75078` |
| `src/components/timeline/ui/Button.tsx` | `src/components/ui/Button.tsx` | `1488eed39fbf01a4d3bb8dbd3909fc8cf253e193` |
| `src/components/timeline/ui/Button.test.tsx` | `src/components/ui/Button.test.tsx` | `73849c3465cae44738c72ae15e4ab364ffcf25be` |
| `src/components/timeline/ui/ids.ts` | `src/components/ui/ids.ts` | `f89439fef36ce602302367536e2b25c4d7c5804f` |
| `src/components/timeline/ui/Kbd.tsx` | `src/components/ui/Kbd.tsx` | `cf8258a1c29a8986bd42ebd0a2387ceafcc269aa` |
| `src/components/timeline/ui/Kbd.test.tsx` | `src/components/ui/Kbd.test.tsx` | `a911ec4c0e524ee3481c71c6d70f3af47e191e65` |
| `src/components/timeline/ui/Popover.tsx` | `src/components/ui/Popover.tsx` | `84a699ab0677dd458fab2cd65002ceaaa1c26e58` |
| `src/components/timeline/ui/Popover.test.tsx` | `src/components/ui/Popover.test.tsx` | `f1432a8d8a4d4f3068408e8d719e9b29b780afe0` |
| `src/components/timeline/ui/position.ts` | `src/components/ui/position.ts` | `308869ac888ac46d245e4fbc1b4d843d5b91f598` |
| `src/components/timeline/ui/position.test.ts` | `src/components/ui/position.test.ts` | `d33d79a7f52470e45fbd28a94f12735b893bb5b3` |
| `src/components/timeline/ui/styles.ts` | `src/components/ui/styles.ts` | `9e721a12bf13b43eae662d68d46cc737109dc5a5` |
| `src/components/timeline/ui/Switch.tsx` | `src/components/ui/Switch.tsx` | `9e4c43a4dd411f0855127d55278cdb1738a8a30b` |
| `src/components/timeline/ui/Switch.test.tsx` | `src/components/ui/Switch.test.tsx` | `63e39780541feecfb91dea4d2a8182b78e36b882` |
| `src/components/timeline/ui/topLayer.ts` | `src/components/ui/topLayer.ts` | `bbcc00a800b88c3e57b33832f0a75379c1f855b6` |

Check them with `git hash-object <file>`, as above.

### Vendored with edits

The blob is the **source** file's. The copy here differs from it by the edits listed and
nothing else, and each edited file says so in its header comment. Paths are relative to
`src/components/` on both sides unless written in full.

| File here | Source path (blob) | Edits |
|---|---|---|
| `timeline/Timeline.tsx` | `viz/Timeline.tsx` (`d862d7845f803dd0b90ff4180af1700b0cbb4bea`) | New required `unit: RunUnit` prop. Timecode, total and `aria-valuetext` print ticks (`t = 7`, `t = 7 of 23 ticks`) or steps (`step 7 / 23`, `step 7 of 23`) through `time.ts`, never ms. Phase markers read "Phase n, title, at t = 5". Slider `step` is one tick or step (was 1/200 of the run). The timecode row shows at every width (was hidden below `lg`). Reduced motion: fill, thumb and timecode snap to the start of the current unit. IV's Packet Journey measurement note removed. |
| `timeline/Timeline.test.tsx` | `viz/Timeline.test.tsx` (`a73b1fdd74f8c9ec91ebd09b774886503157ac09`) | Uses the local `buildTickRun()` fixture (`timeline/testing.ts`); expectations in ticks; "Phase" names; the ms/seconds test replaced by a step-run test; new tests for the slider step and reduced-motion snapping. |
| `timeline/PlaybackControls.tsx` | `viz/PlaybackControls.tsx` (`e59899ddb016477a15dc42032fc4ed6ae068af95`) | Imports from `./ui/*` and `@/components/shell/prefs`. Back and Next emit `step-event` (one tick or step, as the arrow keys do here) instead of `step-phase`, and "Next step" is labelled "Next". New optional `unit` prop for their titles ("Next tick (Right arrow)"). "Replay this step" and "Pause after each step" say "phase". |
| `timeline/PlaybackControls.test.tsx` | `viz/PlaybackControls.test.tsx` (`bc31d4c484e5173a0efc4b739a7aa7c3b0285df8`) | `render` instead of `renderWithPreferences`; the labels and commands above; the two detail-level tests replaced by one: the switch is off by default and writes `osv:v1`. |
| `timeline/PhaseStepper.tsx` | `viz/PhaseStepper.tsx` (`f8f590d09c3f881e02b3092495869b6cb9aeb27c`) | No `TermText` (plain text) and no `useDetail`: one voice, title + length + description. New required `unit` prop; lengths print as ticks or steps. "Phase" in the screen-reader number and the empty state. Header rewritten. |
| `timeline/PhaseStepper.test.tsx` | `viz/PhaseStepper.test.tsx` (`c3c8e3741cd22daf248160b273343d92073ea201`) | Rewritten against `buildTickRun()`; Simple/Full tests dropped; the length test covers ticks and steps. |
| `timeline/StepCaption.tsx` | `viz/StepCaption.tsx` (`ed689ba6dd8e53ec18fac5a09c8514fb2ee3cc0d`) and `viz/stage.ts` (`2813e1375c7432b7a179b1af388a31a4018369af`) | `stageMoment`, `StageMoment`, `stepCaption` and `DONE_CAPTION` from `stage.ts` inlined, without the `detail` parameter (always title + description), as "Phase n of m", with new ready and done wording. No `TermText`. The `detail` prop is gone. |
| `timeline/keymap.ts` | `viz/keymap.ts` (`33a4d2b0dad783df03d056da7194e20da2294d18`) | ←/→ map to `step-event` (one tick or step) and Shift+←/→ to `step-phase`, the reverse of IV, as docs/implementation/03 step 2 specifies; legend wording follows. `STAGE_SHORTCUTS` (`?` help) removed. "Replay this phase". |
| `timeline/keymap.test.ts` | `viz/keymap.test.ts` (`ee0c8d587feee163d020bf15d333572dd83476f5`) | Expectations follow the arrow swap. |
| `timeline/KeyboardLegend.tsx` | `viz/KeyboardLegend.tsx` (`5edaa8b388d7afaf622e6e9f6ed748e0dc8314f1`) | `Kbd` from `./ui/Kbd`; `STAGE_SHORTCUTS` dropped. |
| `timeline/KeyboardLegend.test.tsx` | `viz/KeyboardLegend.test.tsx` (`f4038db6b47185c961b8dd8afb101ee612991e8b`) | `STAGE_SHORTCUTS` assertions dropped. |
| `timeline/time.ts` | `viz/time.ts` (`c0cddb5267e65ca27a974d8229127cf6dc4bc913`) | Rewritten for units: `formatTimecode(ms, durationMs, unit)` and `formatDuration(ms, unit)`, plus `formatTotal`, `formatValueText`, `unitIndex`, `unitCount` and `snapToUnit`. `percentOf` unchanged. |
| `timeline/time.test.ts` | `viz/time.test.ts` (`f1eb50bd46e43bbc69e8a4ba8b01a111f4d1600c`) | Rewritten for the functions above. |
| `timeline/hooks/usePlayback.ts` | `viz/hooks/usePlayback.ts` (`9f949b53c5f2329635a9714a503681bd6e0a33a0`) | Imports `useReducedMotionSafe` from `../useReducedMotionSafe` and `usePauseAtSteps` from `@/components/shell/prefs`. Notes naming IV files (`single-raf-loop.test.ts`, `SimulationView`, Simple/Full detail, phase-02) reworded. No logic change. |
| `timeline/hooks/usePlayback.test.tsx` | `viz/hooks/usePlayback.test.tsx` (`c0b9fc2a3efe796b422c18be98608fa61740b93c`) | Reduced motion is stubbed through `matchMedia` instead of `MotionProvider`. The pause-at-phase block uses the shared `osv:v1` store and the setting is off by default (IV: on in Simple detail). |
| `timeline/hooks/usePlaybackKeys.ts` | `viz/hooks/usePlaybackKeys.ts` (`3085c470f99ff8e7c50b0775266ff46ae9994e7b`) | One comment: "from `SimulationView`" became "once per page, from the module view". |
| `timeline/useReducedMotionSafe.ts` | `motion/useReducedMotionSafe.ts` (`38d1d668966c6acc2f24f8e7170f8d8154a02ed8`) and `motion/MotionProvider.tsx` (`b471316769063df97a32789ad461e523ccf8aaec`) | Folded into one hook with no provider: `reduced` is the OS `prefers-reduced-motion` setting only (IV also has a stored in-app override). Returns `{ reduced, scale }`; `scaleDuration` kept. |
| `src/styles/tokens.css` | `src/styles/tokens.css` (`f7c03b9fe424c1d20b784ec633070b0a343ccc63`) | Same token names and Tailwind wiring, so the vendored components read them unchanged. A new light theme (IV is dark only); IV's dark values are the dark theme, reached by the OS setting or `data-theme="dark"`. IV's OSI layer colours replaced by the ten-slot process palette and the idle tokens. System font stacks instead of Geist. The `prefers-contrast` block dropped. |

### Local stand-ins (not vendored)

- **`src/components/shell/prefs.ts`** replaces IV's `src/components/prefs` (store,
  provider, pre-paint script). It keeps only what the timeline reads (`usePreference`,
  `usePauseAtSteps`) plus the theme, stored under `prefs` in the single `osv:v1` key, and
  leaves that key's other fields alone. `shell/themeScript.ts` is the pre-paint script,
  self-contained in the same way as IV's `prePaint.ts`.
- **`src/components/timeline/PlaybackBar.tsx`** wires `PlaybackControls` and `Timeline`
  to one store and provides the `FrameClock`, which IV does inside its `SimulationView`.
- **`src/lib/cn.ts`** registers the type scale and target sizes with tailwind-merge, as
  IV's does. Without that, `cn('text-fg-muted text-caption')` drops the colour.
