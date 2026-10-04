import { MiniLineChart } from '@/components/blocks/MiniLineChart';
import { CURVE_FRAMES } from '@/core/replace/curve';
import { POLICY_NAMES, type Policy } from '@/core/replace/input';

import { anomaliesOf, curveSeries } from './adapters';

/**
 * Faults against frame count, 1 to 8 frames, one line per policy, with a table view
 * (MiniLineChart's toggle). Every point where one frame more gives more faults is listed
 * underneath as Belady's anomaly, in words, so it is not left to the eye.
 */

export interface CurvePanelProps {
  curves: Record<Policy, number[]>;
  /** The frame count in use, called out under the chart. */
  frames: number;
}

export function CurvePanel({ curves, frames }: CurvePanelProps) {
  const anomalies = anomaliesOf(curves);
  return (
    <div className="flex flex-col gap-3">
      <MiniLineChart
        title="Page faults by number of frames"
        xLabel="Frames"
        yLabel="Faults"
        x={CURVE_FRAMES}
        series={curveSeries(curves)}
      />
      <p className="text-small">
        With {frames} {frames === 1 ? 'frame' : 'frames'}:{' '}
        {(Object.keys(POLICY_NAMES) as Policy[])
          .map((p) => `${POLICY_NAMES[p]} ${curves[p][frames - 1]}`)
          .join(', ')}{' '}
        faults.
      </p>
      {anomalies.length > 0 ? (
        <ul
          aria-label="Belady's anomaly on this string"
          className="text-small border-state-warn flex flex-col gap-1 rounded-md border-l-4 py-1 pl-3"
        >
          {anomalies.map((a) => (
            <li key={`${a.policy}-${a.frames}`} data-testid="belady-point">
              <span className="font-semibold">Belady’s anomaly:</span>{' '}
              {POLICY_NAMES[a.policy]} faults {a.faults} times with {a.frames} frames but
              only {a.previous} with {a.frames - 1}.
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-fg-muted">
          No anomaly on this string: no curve rises when a frame is added.
        </p>
      )}
      <p className="text-caption text-fg-muted">
        LRU and OPT are stack algorithms, so their curves can never rise. FIFO and Clock
        carry no such guarantee.
      </p>
    </div>
  );
}
