// Per-route first-load JS, gzipped, read out of the prerendered HTML each route ships,
// checked against a budget per route, and a check that React Flow ships only to
// /deadlock.
//
//   npm run build && npm run perf:bundles
//
// Copied from Internet Visualizer's perf/bundles.mjs (same measurement), with the
// budgets and the React Flow check added. Next 16 does not print a size table.
// Every <script src> and every JS preload in the document is what the browser fetches
// before the route is interactive, so that set -- deduped -- is the route's initial JS.
// Exits 1 when a route is over budget, a route has no budget, or React Flow is reachable
// from any route but /deadlock.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * First-load JS budgets in KB (gzipped). Module routes start from Internet Visualizer's
 * number (250 KB for a module route); pages without a simulation get less. Measured at
 * the time of writing: module routes ~220 KB, content pages ~146 KB.
 */
const MODULE_BUDGET = 250;
const PAGE_BUDGET = 165;
const BUDGETS = {
  '/index': PAGE_BUDGET,
  '/about': PAGE_BUDGET,
  '/learn': PAGE_BUDGET,
  '/_not-found': PAGE_BUDGET,
  '/_global-error': PAGE_BUDGET,
  '/scheduling': MODULE_BUDGET,
  '/compare': MODULE_BUDGET,
  '/translation': MODULE_BUDGET,
  '/replacement': MODULE_BUDGET,
  // Before React Flow, which /deadlock loads on demand (`next/dynamic`).
  '/deadlock': MODULE_BUDGET,
  '/sync': MODULE_BUDGET,
  '/demo': MODULE_BUDGET,
};

/** A string only React Flow's bundle contains: the class prefix on every node it draws. */
const REACT_FLOW_SIGNATURE = 'react-flow__';

const root = process.argv[2] ?? process.cwd();
const next = join(root, '.next');
const appDir = join(next, 'server', 'app');
const chunksDir = join(next, 'static', 'chunks');

if (!existsSync(appDir)) {
  console.error('No production build found. Run `npm run build` first.');
  process.exit(1);
}

const gzipCache = new Map();
function gz(chunk) {
  if (gzipCache.has(chunk)) return gzipCache.get(chunk);
  const file = join(next, chunk);
  const size = existsSync(file) ? gzipSync(readFileSync(file)).length : 0;
  gzipCache.set(chunk, size);
  return size;
}

function files(dir, test, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, test, out);
    else if (test(entry)) out.push(full);
  }
  return out;
}

// Next ships the legacy polyfill bundle with `noModule`, so no browser that can run the
// app ever downloads it. Counting it would inflate every route by the same ~39 KB and
// hide the numbers that actually move.
function noModuleChunks(html) {
  const skip = new Set();
  for (const tag of html.match(/<script[^>]*noModule[^>]*>/gi) ?? []) {
    for (const c of tag.match(/static\/chunks\/[A-Za-z0-9_./-]+\.js/g) ?? []) skip.add(c);
  }
  return skip;
}

const CHUNK_RE = /static\/chunks\/[A-Za-z0-9_./-]+\.js/g;

function routeOf(file) {
  return (
    '/' +
    relative(appDir, file)
      .split(sep)
      .join('/')
      .replace(/\.html$/, '')
      .replace(/^\(modules\)\//, '')
  );
}

const rows = [];
const htmlChunks = new Map();
for (const file of files(appDir, (f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  const skip = noModuleChunks(html);
  const chunks = new Set((html.match(CHUNK_RE) ?? []).filter((c) => !skip.has(c)));
  let total = 0;
  for (const chunk of chunks) total += gz(chunk);
  const route = routeOf(file);
  htmlChunks.set(route, chunks);
  rows.push({ route, chunks: chunks.size, kb: total / 1024, budget: BUDGETS[route] });
}

rows.sort((a, b) => b.kb - a.kb);
const pad = (s, n) => String(s).padEnd(n);
console.log(
  pad('route', 22) + pad('chunks', 8) + pad('first-load JS (gzip)', 22) + 'budget',
);
console.log('-'.repeat(64));
const failures = [];
for (const r of rows) {
  const verdict =
    r.budget === undefined ? 'NO BUDGET' : r.kb <= r.budget ? `${r.budget} KB` : 'OVER';
  console.log(
    pad(r.route, 22) +
      pad(r.chunks, 8) +
      pad(`${r.kb.toFixed(1).padStart(7)} KB`, 22) +
      verdict,
  );
  if (r.budget === undefined)
    failures.push(`${r.route} has no budget in perf/bundles.mjs`);
  else if (r.kb > r.budget) {
    failures.push(`${r.route} is ${r.kb.toFixed(1)} KB, over its ${r.budget} KB budget`);
  }
}

// React Flow: find the chunks that contain it, then every route that can reach one,
// directly (in its HTML) or through a lazily loaded chunk (a chunk that names it, or a
// route's react-loadable manifest).
const allChunks = files(chunksDir, (f) => f.endsWith('.js')).map(
  (f) => 'static/chunks/' + relative(chunksDir, f).split(sep).join('/'),
);
const flowChunks = allChunks.filter((c) =>
  readFileSync(join(next, c), 'utf8').includes(REACT_FLOW_SIGNATURE),
);
const reach = new Set(flowChunks);
// Chunks that load a React Flow chunk on demand, transitively.
for (let grew = true; grew;) {
  grew = false;
  for (const c of allChunks) {
    if (reach.has(c)) continue;
    const body = readFileSync(join(next, c), 'utf8');
    if ([...reach].some((r) => body.includes(r.split('/').pop()))) {
      reach.add(c);
      grew = true;
    }
  }
}
const flowRoutes = new Set();
for (const [route, chunks] of htmlChunks) {
  if ([...chunks].some((c) => reach.has(c))) flowRoutes.add(route);
}
for (const manifest of files(appDir, (f) => f === 'react-loadable-manifest.json')) {
  const body = readFileSync(manifest, 'utf8');
  if (flowChunks.some((c) => body.includes(c.split('/').pop()))) {
    flowRoutes.add(
      '/' +
        relative(appDir, manifest)
          .split(sep)
          .slice(0, -2)
          .filter((part) => !/^\(.*\)$/.test(part))
          .join('/'),
    );
  }
}
console.log(
  `\nReact Flow: ${flowChunks.length} chunk(s), reachable from ${[...flowRoutes].sort().join(', ') || 'no route'}`,
);
if (flowChunks.length === 0) failures.push('React Flow was not found in any chunk');
for (const route of flowRoutes) {
  if (route !== '/deadlock') failures.push(`React Flow is reachable from ${route}`);
}

console.log('routes measured:', rows.length);
if (failures.length > 0) {
  console.error(`\nBundle budget failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log('Bundle budget: pass.');
