'use client';

import { Term } from '@/components/glossary/Term';
import type { Policy, Workload } from '@/core/sched/workload';

import { Panel } from './fields';
import { PolicyPicker } from './PolicyPicker';
import { WorkloadEditor } from './WorkloadEditor';

/**
 * "Edit the policy and workload": the policy picker and the workload editor with its
 * burst builder. Loaded on demand (`next/dynamic` in SchedulingView), the first time the
 * editor is opened, so the editors and the validation they bring (Zod) stay out of the
 * route's first-load JS (docs/UIUX.md §10.5). The editor is open from the start in
 * Sandbox and folded in Guided, where the lesson chooses the input.
 */
export default function SandboxEditor({
  workload,
  policy,
  editorKey,
  highlightPid,
  onPidHover,
  onChange,
}: {
  workload: Workload;
  policy: Policy;
  /** Changes when the input is replaced from outside, so the forms start again. */
  editorKey: string;
  highlightPid: string | null;
  onPidHover: (pid: string | null) => void;
  onChange: (input: { workload: Workload; policy: Policy }) => void;
}) {
  return (
    <>
      <Panel title="Policy">
        <p className="text-caption text-fg-muted">
          Round robin gives each process a <Term id="quantum">quantum</Term> of CPU time;
          a preemptive policy can <Term id="preempt">preempt</Term> the running process.
        </p>
        <PolicyPicker
          key={`policy-${editorKey}`}
          policy={policy}
          disclose
          onChange={(nextPolicy) => onChange({ workload, policy: nextPolicy })}
        />
      </Panel>
      <Panel title="Workload">
        <p className="text-caption text-fg-muted">
          Each process has an <Term id="arrival">arrival</Term> time and a list of bursts:{' '}
          <Term id="cpu-burst">CPU bursts</Term> (solid) alternating with{' '}
          <Term id="io-burst">I/O bursts</Term> (dashed).
        </p>
        <WorkloadEditor
          key={`workload-${editorKey}`}
          workload={workload}
          showPriority={policy.kind === 'priority'}
          burstBuilder
          disclose
          highlightPid={highlightPid}
          onPidHover={onPidHover}
          onChange={(nextWorkload) => onChange({ workload: nextWorkload, policy })}
        />
      </Panel>
    </>
  );
}
