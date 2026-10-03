# src/components

Shared UI used by more than one module: timeline controls, Gantt chart, bit field, frame
strip, matrix, inspector (phase 03).

- May import `src/core/**`, `src/lib/**` and `src/modules/registry.ts`.
- May **not** import any module under `src/modules/<name>/`. If a component needs
  module knowledge, it belongs in that module.
- May **not** import `@xyflow/react` (deadlock module only).
- Every SVG chart has a "Show as table" toggle; colour is always paired with a label or
  pattern.
