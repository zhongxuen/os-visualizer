'use client';

import { useId } from 'react';

import { LIMITS, type Policy, type PolicyKind } from '@/core/sched/workload';
import { cn } from '@/lib/cn';

import { CheckboxField, NumberField, SelectField } from './fields';

/**
 * Pick a policy and its parameters: the quantum for RR, preemption and aging for
 * priority, and the queues, quanta, allotments, boost and rule 4 for MLFQ. Every change
 * produces a valid `Policy` (each number input only reports in-range values).
 */

export const POLICY_OPTIONS: readonly { value: PolicyKind; label: string }[] = [
  { value: 'fcfs', label: 'FCFS: first come, first served' },
  { value: 'sjf', label: 'SJF: shortest job first' },
  { value: 'srtf', label: 'SRTF: shortest remaining time first' },
  { value: 'priority', label: 'Priority' },
  { value: 'rr', label: 'Round robin' },
  { value: 'mlfq', label: 'MLFQ: multi-level feedback queue' },
];

/** A sensible starting configuration for each kind. */
export function defaultPolicy(kind: PolicyKind): Policy {
  switch (kind) {
    case 'fcfs':
    case 'sjf':
    case 'srtf':
      return { kind };
    case 'priority':
      return { kind, preemptive: false };
    case 'rr':
      return { kind, quantum: 2 };
    case 'mlfq':
      return {
        kind,
        levels: [
          { quantum: 2, allotment: 4 },
          { quantum: 4, allotment: 8 },
          { quantum: 8, allotment: 8 },
        ],
        rule4: 'allotment',
      };
  }
}

export interface PolicyPickerProps {
  policy: Policy;
  onChange: (policy: Policy) => void;
  /** Prefix for labels when several pickers share a page ("Column 2"). */
  label?: string;
  className?: string;
}

export function PolicyPicker({ policy, onChange, label, className }: PolicyPickerProps) {
  const prefix = label ? `${label} ` : '';
  const name = useId();

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <SelectField
        label={`${prefix}Policy`}
        value={policy.kind}
        options={POLICY_OPTIONS}
        onChange={(kind) => onChange(defaultPolicy(kind))}
      />

      {policy.kind === 'rr' ? (
        <NumberField
          label={`${prefix}Quantum (ticks)`}
          value={policy.quantum}
          min={LIMITS.minQuantum}
          max={LIMITS.maxQuantum}
          onChange={(quantum) => onChange({ ...policy, quantum })}
        />
      ) : null}

      {policy.kind === 'priority' ? (
        <div className="flex flex-col gap-2">
          <CheckboxField
            label={`${prefix}Preemptive`}
            checked={policy.preemptive}
            onChange={(preemptive) => onChange({ ...policy, preemptive })}
          />
          <CheckboxField
            label={`${prefix}Aging`}
            checked={policy.aging !== undefined}
            onChange={(on) => {
              if (on) onChange({ ...policy, aging: { every: 2, by: 1 } });
              else onChange({ kind: 'priority', preemptive: policy.preemptive });
            }}
          />
          {policy.aging ? (
            <div className="flex flex-wrap gap-3">
              <NumberField
                label={`${prefix}Every (ticks waited)`}
                value={policy.aging.every}
                min={1}
                max={LIMITS.maxAgingEvery}
                onChange={(every) =>
                  onChange({ ...policy, aging: { ...policy.aging!, every } })
                }
              />
              <NumberField
                label={`${prefix}Lower by`}
                value={policy.aging.by}
                min={1}
                max={LIMITS.maxAgingBy}
                onChange={(by) =>
                  onChange({ ...policy, aging: { ...policy.aging!, by } })
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {policy.kind === 'mlfq' ? (
        <div className="flex flex-col gap-3">
          <NumberField
            label={`${prefix}Queues`}
            value={policy.levels.length}
            min={LIMITS.minLevels}
            max={LIMITS.maxLevels}
            onChange={(count) => {
              const levels = Array.from(
                { length: count },
                (_, i) =>
                  policy.levels[i] ??
                  policy.levels[policy.levels.length - 1] ?? { quantum: 4, allotment: 8 },
              );
              onChange({ ...policy, levels });
            }}
          />
          <table className="text-small">
            <caption className="text-caption text-fg-muted mb-1 text-left">
              {prefix}Per queue (Q0 is the top)
            </caption>
            <thead>
              <tr className="text-caption text-fg-muted text-left">
                <th scope="col" className="font-medium">
                  Queue
                </th>
                <th scope="col" className="font-medium">
                  Quantum
                </th>
                <th scope="col" className="font-medium">
                  Allotment
                </th>
              </tr>
            </thead>
            <tbody>
              {policy.levels.map((level, i) => {
                const set = (patch: Partial<typeof level>) =>
                  onChange({
                    ...policy,
                    levels: policy.levels.map((l, j) =>
                      j === i ? { ...l, ...patch } : l,
                    ),
                  });
                return (
                  <tr key={i}>
                    <th scope="row" className="pr-2 text-left font-mono font-medium">
                      Q{i}
                    </th>
                    <td className="py-1 pr-2">
                      <NumberField
                        label={`${prefix}Q${i} quantum`}
                        hideLabel
                        value={level.quantum}
                        min={LIMITS.minQuantum}
                        max={LIMITS.maxQuantum}
                        onChange={(quantum) => set({ quantum })}
                      />
                    </td>
                    <td className="py-1">
                      <NumberField
                        label={`${prefix}Q${i} allotment`}
                        hideLabel
                        value={level.allotment}
                        min={1}
                        max={LIMITS.maxAllotment}
                        onChange={(allotment) => set({ allotment })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <CheckboxField
            label={`${prefix}Priority boost`}
            checked={policy.boostEvery !== undefined}
            onChange={(on) => {
              if (on) onChange({ ...policy, boostEvery: 20 });
              else onChange({ kind: 'mlfq', levels: policy.levels, rule4: policy.rule4 });
            }}
          />
          {policy.boostEvery !== undefined ? (
            <NumberField
              label={`${prefix}Boost every (ticks)`}
              value={policy.boostEvery}
              min={1}
              max={LIMITS.maxBoostEvery}
              onChange={(boostEvery) => onChange({ ...policy, boostEvery })}
            />
          ) : null}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-caption text-fg-muted">
              {prefix}Rule 4 (demotion)
            </legend>
            {(
              [
                ['allotment', 'Allotment: time used at a level counts across I/O'],
                ['original', 'Old rules 4a/4b: only a whole quantum demotes'],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="text-small inline-flex items-start gap-2">
                <input
                  type="radio"
                  name={name}
                  value={value}
                  checked={policy.rule4 === value}
                  onChange={() => onChange({ ...policy, rule4: value })}
                  className="accent-accent mt-0.5 size-4"
                />
                {text}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}
