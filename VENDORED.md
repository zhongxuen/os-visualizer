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
