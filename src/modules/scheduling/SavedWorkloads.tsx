'use client';

import { Button } from '@/components/timeline/ui/Button';
import { policyName, type Policy, type Workload } from '@/core/sched/workload';
import { validatePolicy, validateWorkload } from '@/core/sched/workload.schema';

/**
 * The workloads saved in this browser, each checked against the schema before it is
 * offered (storage is the learner's to edit). Loaded on demand (`next/dynamic` in
 * SchedulingView) and only when something is saved: saved inputs are read after
 * hydration anyway, and the schema (Zod) stays out of the route's first-load JS
 * (docs/UIUX.md §10.5).
 */

export interface SavedRun {
  workload: Workload;
  policy: Policy;
}

export function asSaved(value: unknown): SavedRun | null {
  if (typeof value !== 'object' || value === null) return null;
  const { workload, policy } = value as Record<string, unknown>;
  const w = validateWorkload(workload);
  const p = validatePolicy(policy);
  return w.ok && p.ok ? { workload: w.value, policy: p.value } : null;
}

export default function SavedWorkloads({
  entries,
  onLoad,
  onDelete,
}: {
  /** What storage holds for the module, unchecked. */
  entries: readonly unknown[];
  /** `n` counts from 1, as the list does. */
  onLoad: (run: SavedRun, n: number) => void;
  /** By the entry's index in storage. */
  onDelete: (index: number) => void;
}) {
  const saved = entries
    .map((value, index) => ({ value: asSaved(value), index }))
    .filter((entry): entry is { value: SavedRun; index: number } => entry.value !== null);
  if (saved.length === 0) return null;
  return (
    <ul aria-label="Saved workloads" className="flex flex-col gap-2">
      {saved.map(({ value, index }, n) => (
        <li key={index} className="flex flex-wrap items-center gap-2">
          <span className="text-small min-w-0 flex-1">
            {n + 1}. {value.workload.processes.length} processes,{' '}
            {policyName(value.policy)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onLoad(value, n + 1)}>
            Load<span className="sr-only"> saved workload {n + 1}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(index)}>
            Delete<span className="sr-only"> saved workload {n + 1}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
