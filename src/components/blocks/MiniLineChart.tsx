import { ChartTableToggle } from './ChartTableToggle';

/**
 * A small line chart, one line per series: faults against frame count, one line per
 * policy. Each series has its own colour, dash pattern and marker shape, and its name is
 * written at the end of its line, so no line is told apart by colour alone. The table
 * view has the same numbers.
 */

export interface LineSeries {
  id: string;
  label: string;
  /** One per `x`; `null` leaves a gap. */
  values: readonly (number | null)[];
}

export interface MiniLineChartProps {
  title: string;
  xLabel: string;
  yLabel: string;
  x: readonly number[];
  series: readonly LineSeries[];
  className?: string;
}

const STYLES = [
  { stroke: 'var(--accent)', dash: undefined, marker: 'circle' },
  { stroke: 'var(--state-warn)', dash: '6 3', marker: 'square' },
  { stroke: 'var(--state-ok)', dash: '2 3', marker: 'triangle' },
  { stroke: 'var(--state-error)', dash: '8 3 2 3', marker: 'diamond' },
  { stroke: 'var(--text-secondary)', dash: '4 4', marker: 'cross' },
] as const;

export function seriesStyle(index: number) {
  return STYLES[index % STYLES.length]!;
}

const W = 360;
const H = 200;
const M = { top: 12, right: 72, bottom: 36, left: 40 };

function Marker({
  kind,
  x,
  y,
  colour,
}: {
  kind: string;
  x: number;
  y: number;
  colour: string;
}) {
  switch (kind) {
    case 'square':
      return <rect x={x - 3.5} y={y - 3.5} width={7} height={7} fill={colour} />;
    case 'triangle':
      return (
        <path
          d={`M${x} ${y - 4.5} L${x + 4.5} ${y + 3.5} L${x - 4.5} ${y + 3.5} Z`}
          fill={colour}
        />
      );
    case 'diamond':
      return (
        <path
          d={`M${x} ${y - 5} L${x + 5} ${y} L${x} ${y + 5} L${x - 5} ${y} Z`}
          fill={colour}
        />
      );
    case 'cross':
      return (
        <path
          d={`M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}`}
          stroke={colour}
          strokeWidth={2}
        />
      );
    default:
      return <circle cx={x} cy={y} r={3.5} fill={colour} />;
  }
}

/** Points of a series as SVG path commands, breaking the line at each `null`. */
export function linePath(
  values: readonly (number | null)[],
  px: (i: number) => number,
  py: (v: number) => number,
): string {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${px(i)} ${py(v)} `;
    pen = true;
  });
  return d.trim();
}

/**
 * Label positions at least `gap` apart, each as close to its wanted `y` as that allows:
 * lines that end on the same value would otherwise print their names on top of each
 * other. Returned in the order given.
 */
export function spreadLabels(ys: readonly number[], gap: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  for (let k = 1; k < order.length; k += 1) {
    order[k]!.y = Math.max(order[k]!.y, order[k - 1]!.y + gap);
  }
  // Centre the pushed group on where it wanted to be, so it doesn't only grow downwards.
  const shift =
    (order.reduce((sum, o) => sum + o.y, 0) - ys.reduce((sum, y) => sum + y, 0)) /
    Math.max(1, order.length);
  const out: number[] = [];
  for (const o of order) out[o.i] = o.y - shift;
  return out;
}

export function MiniLineChart({
  title,
  xLabel,
  yLabel,
  x,
  series,
  className,
}: MiniLineChartProps) {
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const yMax = Math.max(1, ...all);
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const px = (i: number) =>
    M.left + (x.length <= 1 ? plotW / 2 : (i / (x.length - 1)) * plotW);
  const py = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const yTicks = [0, Math.round(yMax / 2), yMax].filter((v, i, a) => a.indexOf(v) === i);

  const ends = series.map((s) =>
    s.values.reduce<number>((last, v, i) => (v === null ? last : i), -1),
  );
  const labelYs = spreadLabels(
    series.map((s, i) => (ends[i]! >= 0 ? py(s.values[ends[i]!]!) : 0)),
    13,
  );

  const summary = `${title}. ${series
    .map(
      (s) =>
        `${s.label}: ${s.values.map((v, i) => `${x[i]} → ${v ?? 'n/a'}`).join(', ')}`,
    )
    .join('; ')}.`;

  const chart = (
    <svg
      role="img"
      aria-label={summary}
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-md"
    >
      <line
        x1={M.left}
        x2={M.left}
        y1={M.top}
        y2={M.top + plotH}
        stroke="var(--border-strong)"
      />
      <line
        x1={M.left}
        x2={M.left + plotW}
        y1={M.top + plotH}
        y2={M.top + plotH}
        stroke="var(--border-strong)"
      />
      {yTicks.map((v) => (
        <text
          key={v}
          x={M.left - 6}
          y={py(v)}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={10}
          fill="var(--text-muted)"
        >
          {v}
        </text>
      ))}
      {x.map((value, i) => (
        <text
          key={i}
          x={px(i)}
          y={M.top + plotH + 14}
          textAnchor="middle"
          fontSize={10}
          fill="var(--text-muted)"
        >
          {value}
        </text>
      ))}
      <text
        x={M.left + plotW / 2}
        y={H - 4}
        textAnchor="middle"
        fontSize={11}
        fill="var(--text-secondary)"
      >
        {xLabel}
      </text>
      <text
        x={10}
        y={M.top + plotH / 2}
        textAnchor="middle"
        fontSize={11}
        fill="var(--text-secondary)"
        transform={`rotate(-90 10 ${M.top + plotH / 2})`}
      >
        {yLabel}
      </text>
      {series.map((s, index) => {
        const style = seriesStyle(index);
        const lastIndex = ends[index]!;
        return (
          <g key={s.id} data-series={s.id}>
            <path
              d={linePath(s.values, px, py)}
              fill="none"
              stroke={style.stroke}
              strokeWidth={2}
              strokeDasharray={style.dash}
            />
            {s.values.map((v, i) =>
              v === null ? null : (
                <Marker
                  key={i}
                  kind={style.marker}
                  x={px(i)}
                  y={py(v)}
                  colour={style.stroke}
                />
              ),
            )}
            {lastIndex >= 0 ? (
              // The series' marker in front of its name ties the label to its line.
              <g>
                <Marker
                  kind={style.marker}
                  x={px(lastIndex) + 14}
                  y={labelYs[index]!}
                  colour={style.stroke}
                />
                <text
                  x={px(lastIndex) + 22}
                  y={labelYs[index]!}
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--text-primary)"
                >
                  {s.label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );

  const table = (
    <table className="text-small w-full max-w-md text-right">
      <caption className="mb-1 text-left font-semibold">{title}</caption>
      <thead>
        <tr>
          <th scope="col" className="text-left">
            {xLabel}
          </th>
          {series.map((s) => (
            <th key={s.id} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="font-mono">
        {x.map((value, i) => (
          <tr key={i} className="border-border border-t">
            <th scope="row" className="text-left font-medium">
              {value}
            </th>
            {series.map((s) => (
              <td key={s.id}>{s.values[i] ?? '—'}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartTableToggle label={title} chart={chart} table={table} className={className} />
  );
}
