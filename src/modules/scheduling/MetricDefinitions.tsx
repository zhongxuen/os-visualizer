import { METRIC_DEFINITIONS } from '@/core/sched/metrics';

/** The textbook definition of every metric, shown under the metrics. */
export function MetricDefinitions() {
  return (
    <dl className="text-caption text-fg-muted grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {METRIC_DEFINITIONS.map((d) => (
        <div key={d.id} className="contents">
          <dt className="text-fg-secondary font-semibold">{d.term}</dt>
          <dd>{d.text}</dd>
        </div>
      ))}
    </dl>
  );
}
