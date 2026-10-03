# src/modules

One folder per module (`scheduling`, `compare`, `translation`, `replacement`,
`deadlock`, later `sync`). A module renders events from its core run; it never decides
anything itself.

- `registry.ts` is the manifest the home page and navigation read. A module agent only
  flips its own entry's `status` to `'ready'`.
- A module may not import another module. **Exception:** `compare` may import
  `src/modules/scheduling/index.ts` (the public renderers) and nothing else of it.
- `@xyflow/react` is allowed only under `src/modules/deadlock/**`, lazy-loaded.

All three are enforced in `eslint.config.mjs`.
