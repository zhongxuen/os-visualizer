'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/timeline/ui/Button';
import { MAX_COMPARE, MIN_COMPARE } from '@/core/sched/compare';
import type { Policy } from '@/core/sched/workload';
import { PolicyPicker } from '@/modules/scheduling';

/**
 * The policy columns: 2-4 pickers, each with its own parameters, so the same policy can
 * appear twice with different settings (RR q = 1 vs q = 4).
 */
export function PolicyColumns({
  policies,
  names,
  onChange,
}: {
  policies: readonly Policy[];
  names: readonly string[];
  onChange: (policies: Policy[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Policies being compared" className="flex flex-col gap-3">
        {policies.map((policy, i) => (
          <li key={i} className="border-border rounded-md border p-3">
            <p className="text-small mb-2 font-semibold">
              Column {i + 1}: {names[i]}
            </p>
            <PolicyPicker
              label={`Column ${i + 1}`}
              policy={policy}
              onChange={(next) => onChange(policies.map((p, j) => (j === i ? next : p)))}
            />
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                disabled={policies.length <= MIN_COMPARE}
                onClick={() => onChange(policies.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
                Remove column {i + 1}
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Button
        variant="secondary"
        size="sm"
        disabled={policies.length >= MAX_COMPARE}
        onClick={() => onChange([...policies, { kind: 'rr', quantum: 4 }])}
      >
        <Plus aria-hidden="true" className="size-3.5" />
        Add a policy
      </Button>
    </div>
  );
}
