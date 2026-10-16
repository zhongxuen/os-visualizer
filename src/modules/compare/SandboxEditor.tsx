'use client';

import { Term } from '@/components/glossary/Term';
import type { Policy, Workload } from '@/core/sched/workload';
import { Panel, WorkloadEditor } from '@/modules/scheduling';

import { PolicyColumns } from './PolicyColumns';

/**
 * "Edit the policies and workload": a policy per column and the shared workload. Loaded
 * on demand (`next/dynamic` in CompareView), the first time the editor is opened, so the
 * editors and the validation they bring (Zod) stay out of the route's first-load JS
 * (docs/UIUX.md §10.5).
 */
export default function SandboxEditor({
  workload,
  policies,
  names,
  editorKey,
  onChange,
}: {
  workload: Workload;
  policies: Policy[];
  names: readonly string[];
  /** Changes when the input is replaced from outside, so the forms start again. */
  editorKey: string;
  onChange: (input: { workload: Workload; policies: Policy[] }) => void;
}) {
  return (
    <>
      <Panel title="Policies">
        <p className="text-caption text-fg-muted">
          Each column runs the same workload under its own policy. Round robin gives each
          process a <Term id="quantum">quantum</Term> of CPU time; a preemptive policy can{' '}
          <Term id="preempt">preempt</Term> the running process.
        </p>
        <PolicyColumns
          key={`policies-${editorKey}`}
          policies={policies}
          names={names}
          onChange={(nextPolicies) => onChange({ workload, policies: nextPolicies })}
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
          showPriority={policies.some((p) => p.kind === 'priority')}
          burstBuilder
          disclose
          onChange={(nextWorkload) => onChange({ workload: nextWorkload, policies })}
        />
      </Panel>
    </>
  );
}
