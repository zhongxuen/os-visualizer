# `perf/`: the performance budget

```bash
npm run build
npm run perf:bundles      # also the last step of `npm run verify`
```

`bundles.mjs` is Internet Visualizer's script (same measurement) with budgets and one
extra check added. It sums the gzipped size of every `static/chunks/*.js` each
prerendered page references, deduped, skipping the `noModule` polyfill bundle that no
browser able to run the app downloads. It fails when:

- a route's first-load JS is over its budget, or a route has no budget;
- React Flow (found by its `react-flow__` class prefix) is reachable from any route but
  `/deadlock`, directly or through a lazily loaded chunk.

## Budgets (first-load JS, gzipped)

| Routes | Budget | Measured when set (2026-10-05) |
| --- | --- | --- |
| Module routes: `/scheduling`, `/compare`, `/translation`, `/replacement`, `/deadlock`, `/sync`, `/demo` | 250 KB (Internet Visualizer's module-route budget) | 218–222 KB |
| Pages: `/`, `/learn`, `/about`, not found, global error | 165 KB | 131–148 KB |

`/deadlock` loads React Flow on demand (`next/dynamic`), after its first load; the
budget covers what comes before it.

## Lighthouse (2026-10-05)

Lighthouse 12 against `next start` on a local production build, Chromium from
Playwright, median of several runs. SEO reads 66 on any build that is not the Vercel
production deployment, because `robots.ts` then serves `Disallow: /` on purpose.

| Page | Preset | Performance | Accessibility | Best practices |
| --- | --- | --- | --- | --- |
| `/` | desktop | 100 | 100 | 100 |
| `/scheduling` | desktop | 97 | 100 | 100 |
| `/` | mobile (4x CPU, slow 4G) | 87 | 100 | 100 |
| `/scheduling` | mobile (4x CPU, slow 4G) | 70 | 100 | 100 |

On the mobile preset the score is held down by Total Blocking Time (about 0.4 s on `/`
and 1.1–1.7 s on `/scheduling`): the cost of hydrating React and a fully client-rendered
module view under a 4x CPU slowdown. The DOM is small (about 640 elements on
`/scheduling`). The local machine is noisy, so compare a change against its own
baseline, measured the same way, rather than against these figures.
