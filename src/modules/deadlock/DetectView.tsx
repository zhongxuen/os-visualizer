'use client';

import type { DlSnapshot } from '@/core/deadlock/events';

import { DetectionMatrices, ResultBanner, WaitForView, WorkFinish } from './StepState';

/**
 * The graph tab's step view: the wait-for graph and DFS during cycle detection, the
 * Allocation and Request matrices with Work and Finish during detection, and the result
 * once a step decides it.
 */
export function DetectView({ state }: { state: DlSnapshot }) {
  const cycle = state.algorithm === 'cycle';
  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption text-fg-muted">
        {cycle
          ? 'Cycle detection on the wait-for graph (OSC10 §8.7.1).'
          : state.algorithm === 'recover'
            ? 'Recovery (OSC10 §8.8): the graph after the action, before detection runs again.'
            : 'The detection algorithm (OSC10 §8.7.2): Request_i ≤ Work, then release.'}
      </p>
      {cycle ? <WaitForView state={state} /> : <DetectionMatrices state={state} />}
      {cycle ? null : <WorkFinish state={state} />}
      <ResultBanner result={state.result} />
    </div>
  );
}
