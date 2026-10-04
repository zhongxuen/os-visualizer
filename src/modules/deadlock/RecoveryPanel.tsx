'use client';

import { useState } from 'react';

import { Button } from '@/components/timeline/ui/Button';
import {
  describeRecovery,
  processName,
  resourceName,
  type Graph,
  type Recovery,
} from '@/core/deadlock/model';

import { recoveryOptions } from './adapters';
import { SelectField } from './fields';

/**
 * Recovery (OSC10 §8.8): terminate a thread, or preempt one instance of a resource from
 * the thread holding it. Each action is added to the run, and detection runs again right
 * after it.
 */

export interface RecoveryPanelProps {
  graph: Graph;
  recovery: readonly Recovery[];
  /** Whether the run, after the recovery so far, still ends deadlocked. */
  deadlocked: boolean;
  onApply: (action: Recovery) => void;
  onUndo: () => void;
  onClear: () => void;
}

export function RecoveryPanel({
  graph,
  recovery,
  deadlocked,
  onApply,
  onUndo,
  onClear,
}: RecoveryPanelProps) {
  const options = recoveryOptions(graph, recovery);
  const [kind, setKind] = useState<Recovery['kind']>('terminate');
  const [target, setTarget] = useState('');

  const choices =
    kind === 'terminate'
      ? options.terminate.map((t) => ({ value: `${t}`, label: processName(t) }))
      : options.preempt.map(({ t, r }) => ({
          value: `${t}:${r}`,
          label: `1 of ${resourceName(r)} from ${processName(t)}`,
        }));
  const value = choices.some((c) => c.value === target)
    ? target
    : (choices[0]?.value ?? '');

  const action = (): Recovery | null => {
    if (value === '') return null;
    if (kind === 'terminate') return { kind, t: Number(value) };
    const [t, r] = value.split(':').map(Number);
    return { kind, t: t!, r: r! };
  };
  const chosen = action();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-fg-secondary">
        {deadlocked
          ? 'The run ends deadlocked. Break the deadlock by force: detection runs again right after.'
          : recovery.length > 0
            ? 'The deadlock is broken. You can undo recovery steps to try another way.'
            : 'Nothing to recover from: the run does not end in a deadlock. You can still try an action.'}
      </p>
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
        <SelectField<Recovery['kind']>
          label="Recovery action"
          value={kind}
          options={[
            { value: 'terminate', label: 'Terminate a thread' },
            { value: 'preempt', label: 'Preempt a resource' },
          ]}
          onChange={setKind}
        />
        {choices.length > 0 ? (
          <SelectField
            label={kind === 'terminate' ? 'Thread to terminate' : 'Instance to preempt'}
            value={value}
            options={choices}
            onChange={setTarget}
          />
        ) : (
          <p className="text-small text-fg-muted">
            {kind === 'terminate'
              ? 'No thread left to terminate.'
              : 'No thread holds anything.'}
          </p>
        )}
        <Button
          variant={deadlocked ? 'primary' : 'secondary'}
          size="sm"
          disabled={chosen === null}
          onClick={() => {
            if (chosen) onApply(chosen);
          }}
        >
          {chosen ? describeRecovery(chosen) : 'Apply'}
        </Button>
      </div>
      {recovery.length > 0 ? (
        <div className="flex flex-col gap-2">
          <ol aria-label="Recovery steps" className="text-small list-decimal pl-5">
            {recovery.map((step, i) => (
              <li key={i}>{describeRecovery(step)}</li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onUndo}>
              Undo last step
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear recovery
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
