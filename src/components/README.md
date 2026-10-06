# src/components

Shared UI used by more than one module: timeline controls, Gantt chart, bit field, frame
strip, matrix, inspector (phase 03).

- May import `src/core/**`, `src/lib/**` and `src/modules/registry.ts`.
- May **not** import any module under `src/modules/<name>/`. If a component needs
  module knowledge, it belongs in that module.
- May **not** import `@xyflow/react` (deadlock module only).
- Every SVG chart has a "Show as table" toggle; colour is always paired with a label or
  pattern.

## The module workspace (U2.1): extension points for modules

Modules plug in through optional props and one file convention; none needs a shared
component edited.

- **`ModuleLayout`** (`shell/ModuleLayout.tsx`): `inputs` (Setup), `children` (Watch),
  `inspector`, and the optional
  - `results`: metrics, under the visual on wider screens and the Results tab on phones;
  - `endOfRun`: `{ result?, tryNext?: { label, why?, onSelect }, next? }` for the
    end-of-run card (`shell/EndOfRunCard.tsx`). `next` defaults to the next ready module
    in `LEARNING_ORDER` (`nextModuleAfter`); `null` hides it; `false` turns the card off;
  - `share`: `{ link, shareable }` from `useShareState` (defaults to the address bar);
    `false` hides "Saved in this link · Copy link";
  - `shortcuts`: the module's own keys, listed in the shortcuts sheet;
  - `moduleId`: defaults to the route's first segment.
  Mode values stay `'walkthrough'` / `'free'`; they are labelled Guided / Sandbox
  (`MODE_LABELS`). The first visit opens Guided; later visits reopen the last mode
  (`prefs.moduleModes` in `osv:v1`).
- **Rules** (`inspector/`): `Rule` has optional `plain` and `whyItMatters`. Pass the id
  of the rule that decided the current step to both
  `<StepInspector rule={ruleUsed(rules, id)} />` (the "Rule used" chip) and
  `<RulesPanel currentRuleId={id} />` (highlighted, panel opened).
- **Module keys** (B6): export `MODULE_SHORTCUTS: ModuleShortcut[]` from
  `src/modules/<name>/shortcuts.ts` and pass the same list to `ModuleLayout`'s
  `shortcuts`. `timeline/keymap.test.ts` globs those files and fails if a module key
  collides with a playback key (`PLAYBACK_SHORTCUTS`) or a workspace key
  (`WORKSPACE_SHORTCUTS`: `F`, `?`).
- **Step motion:** `ModuleLayout` wraps the page in `StepTransitionProvider`, fed by the
  `PlaybackBar` in `timeline`, so `useStepTransition()` (and `Flash`, `Ticker`,
  `DrawPath`, `Flip`) work anywhere inside a module without further wiring.
