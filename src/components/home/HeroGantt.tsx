import { ProcessPatternDefs } from '@/components/shell/ProcessPatternDefs';
import { processPatternId } from '@/components/shell/processPalette';

import { heroRun, type HeroRun } from './heroRun';

/**
 * The home page's miniature Gantt chart (docs/UIUX.md §7.1): the real Round Robin run
 * from `heroRun()` drawing itself tick by tick, with a moving cursor and a one-line
 * caption saying why each process got the CPU.
 *
 * A Server Component with no JS: the SVG and its keyframes are generated here from the
 * run, so the picture is provably the algorithm and costs the route nothing. The loop
 * pauses while the figure is hovered or holds focus, or while "Pause" is ticked (a plain
 * checkbox, read by `:has()`), which is the keyboard and screen-reader way to stop it.
 * Under reduced motion `globals.css` collapses each animation to one instant pass,
 * which lands on the last keyframe: the finished chart and its summary.
 */

/** One loop, in seconds: draw for the first 75%, then hold the finished chart. */
const LOOP_S = 8;
const DRAW = 75;

/** Chart geometry, in SVG user units. */
const TICK = 24;
const PAD = 8;
const BAR_Y = 8;
const BAR_H = 36;
const AXIS_Y = 52;

function pct(tick: number, ticks: number): string {
  return `${+((tick / ticks) * DRAW).toFixed(3)}%`;
}

/** The keyframes for one run. Exported for the test, which checks them against the run. */
export function heroCss(run: HeroRun): string {
  const { segments, ticks } = run;
  const width = ticks * TICK;
  const rules: string[] = [
    `.hero-gantt .hg-anim{animation-duration:${LOOP_S}s;animation-iteration-count:infinite;animation-fill-mode:both;animation-timing-function:linear}`,
    `.hero-gantt .hg-step{animation-timing-function:steps(1,end)}`,
    `.hero-gantt:is(:hover,:focus-within,:has(.hg-pause:checked)) .hg-anim{animation-play-state:paused}`,
    `.hero-gantt .hg-bar{transform-box:fill-box;transform-origin:left center}`,
    `@keyframes hg-cursor{0%{transform:translateX(0)}${DRAW}%,100%{transform:translateX(${width}px)}}`,
    `@keyframes hg-done{0%{opacity:0}${DRAW}%,100%{opacity:1}}`,
  ];

  segments.forEach((s, i) => {
    const start = pct(s.start, ticks);
    const end = pct(s.end, ticks);
    // The bar grows across its own ticks and stays drawn until the loop restarts.
    rules.push(
      `@keyframes hg-bar-${i}{${s.start === 0 ? '0%' : `0%,${start}`}{transform:scaleX(0)}${end},100%{transform:scaleX(1)}}`,
    );
    // Its PID appears once the bar is complete.
    rules.push(`@keyframes hg-pid-${i}{0%{opacity:0}${end},100%{opacity:1}}`);
    // Its caption shows while it draws (`steps`, so captions swap rather than fade).
    rules.push(
      `@keyframes hg-cap-${i}{${s.start === 0 ? '' : '0%{opacity:0}'}${start}{opacity:1}${end},100%{opacity:0}}`,
    );
    rules.push(
      `.hg-bar-${i}{animation-name:hg-bar-${i}}.hg-pid-${i}{animation-name:hg-pid-${i}}.hg-cap-${i}{animation-name:hg-cap-${i}}`,
    );
  });

  return rules.join('\n');
}

export function HeroGantt() {
  const run = heroRun();
  const { segments, ticks, doneCaption } = run;
  const width = ticks * TICK;
  const viewWidth = width + PAD * 2;
  const axis = Array.from({ length: ticks + 1 }, (_, t) => t);

  return (
    <figure className="hero-gantt panel p-4 sm:p-5">
      <style dangerouslySetInnerHTML={{ __html: heroCss(run) }} />

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-caption text-fg-muted font-medium tracking-wide uppercase">
          Round Robin · q = 2
        </p>
        <label className="text-caption text-fg-secondary flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" className="hg-pause accent-accent size-4" />
          Pause
        </label>
      </div>

      <div className="bg-tick-grid mt-3 rounded-[var(--radius-panel)] p-2">
        <svg
          viewBox={`0 0 ${viewWidth} 64`}
          className="block h-auto w-full overflow-visible"
          role="img"
          aria-label={`Gantt chart of Round Robin with a quantum of 2 ticks: ${segments
            .map((s) => `${s.pid} from ${s.start} to ${s.end}`)
            .join(', ')}.`}
        >
          <ProcessPatternDefs />
          {segments.map((s, i) => {
            const x = PAD + s.start * TICK;
            const w = (s.end - s.start) * TICK;
            return (
              <g key={`${s.pid}-${s.start}`}>
                <rect
                  x={x}
                  y={BAR_Y}
                  width={w}
                  height={BAR_H}
                  rx={2}
                  className={`hg-anim hg-bar hg-bar-${i}`}
                  style={{
                    fill: `url(#${processPatternId(s.slot)})`,
                    stroke: `var(--proc-edge-${s.slot})`,
                    strokeWidth: 1.5,
                  }}
                />
                <g className={`hg-anim hg-step hg-pid-${i}`}>
                  <rect
                    x={x + w / 2 - 11}
                    y={BAR_Y + BAR_H / 2 - 8}
                    width={22}
                    height={16}
                    rx={2}
                    style={{ fill: `var(--proc-${s.slot})` }}
                  />
                  <text
                    x={x + w / 2}
                    y={BAR_Y + BAR_H / 2 + 4}
                    textAnchor="middle"
                    className="num text-[11px] font-semibold"
                    style={{ fill: 'var(--proc-ink)' }}
                  >
                    {s.pid}
                  </text>
                </g>
              </g>
            );
          })}

          <line
            x1={PAD}
            y1={AXIS_Y}
            x2={PAD + width}
            y2={AXIS_Y}
            style={{ stroke: 'var(--border)' }}
          />
          {axis.map((t) => (
            <g key={t}>
              <line
                x1={PAD + t * TICK}
                y1={AXIS_Y}
                x2={PAD + t * TICK}
                y2={AXIS_Y + (t % 2 === 0 ? 4 : 2)}
                style={{ stroke: 'var(--border)' }}
              />
              {t % 2 === 0 ? (
                <text
                  x={PAD + t * TICK}
                  y={AXIS_Y + 12}
                  textAnchor="middle"
                  className="num text-[9px]"
                  style={{ fill: 'var(--fg-muted)' }}
                >
                  {t}
                </text>
              ) : null}
            </g>
          ))}

          <line
            x1={PAD}
            y1={BAR_Y - 6}
            x2={PAD}
            y2={AXIS_Y}
            className="hg-anim"
            style={{
              animationName: 'hg-cursor',
              stroke: 'var(--accent)',
              strokeWidth: 2,
            }}
          />
        </svg>
      </div>

      {/* Every caption sits in one grid cell; keyframes show one at a time. */}
      <div aria-hidden="true" className="text-small mt-3 grid min-h-[2.5rem]">
        {segments.map((s, i) => (
          <p
            key={`${s.pid}-${s.start}`}
            className={`hg-anim hg-step hg-cap-${i} [grid-area:1/1]`}
          >
            <span className="num text-fg-muted">t = {s.start}</span>{' '}
            <span className="text-fg">{s.caption}</span>
          </p>
        ))}
        <p
          className="hg-anim hg-step [grid-area:1/1]"
          style={{ animationName: 'hg-done' }}
        >
          <span className="text-fg">{doneCaption}</span>
        </p>
      </div>

      <figcaption className="text-caption text-fg-muted mt-2">
        The real run from this site&rsquo;s scheduler, not a drawing.
        <ol className="sr-only">
          {segments.map((s) => (
            <li key={`${s.pid}-${s.start}`}>
              t = {s.start} to {s.end}: {s.caption}.
            </li>
          ))}
          <li>{doneCaption}.</li>
        </ol>
      </figcaption>
    </figure>
  );
}
