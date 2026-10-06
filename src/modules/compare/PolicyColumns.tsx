'use client';

import { Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Flip } from '@/components/motion/Flip';
import { StepTransitionProvider } from '@/components/motion/useStepTransition';
import { Button } from '@/components/timeline/ui/Button';
import { Popover } from '@/components/timeline/ui/Popover';
import { MAX_COMPARE, MIN_COMPARE } from '@/core/sched/compare';
import { policyName, type Policy } from '@/core/sched/workload';
import { defaultPolicy, POLICY_OPTIONS, PolicyPicker } from '@/modules/scheduling';

import { variantOf } from './summary';

/**
 * The policy columns: 2-4 pickers, each with its own parameters, so the same policy can
 * appear twice with different settings (RR q = 1 vs q = 4).
 *
 * "Add a policy" is a menu (C4) whose first group is "Same policy, other settings": a
 * copy of a column with one setting changed, focused so it can be tuned at once. The
 * columns reflow with `<Flip>`: each add or remove counts as one forward step for the
 * columns alone, so they glide (and are instant under reduced motion), while the
 * timeline's own step transition is left alone.
 *
 * Each column has a stable key, so removing column 2 moves column 3 up rather than
 * relabelling it. The parent remounts this component when a preset loads.
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
  const [stored, setKeys] = useState<number[]>(() => policies.map((_, i) => i));
  const keys = stored.length === policies.length ? stored : policies.map((_, i) => i);
  const [edits, setEdits] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState('');
  const pendingFocus = useRef<{ key: number; settings: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const full = policies.length >= MAX_COMPARE;
  const least = policies.length <= MIN_COMPARE;

  // Focus the new column: its first setting for a variant, its policy otherwise.
  useEffect(() => {
    const focus = pendingFocus.current;
    if (!focus) return;
    pendingFocus.current = null;
    const column = rootRef.current?.querySelector(`[data-column-key="${focus.key}"]`);
    const target =
      (focus.settings ? column?.querySelector<HTMLElement>('input') : null) ??
      column?.querySelector<HTMLElement>('select');
    target?.focus();
  });

  const add = (policy: Policy, message: string, settings: boolean) => {
    const key = Math.max(-1, ...keys) + 1;
    onChange([...policies, policy]);
    setKeys([...keys, key]);
    setEdits((n) => n + 1);
    setStatus(message);
    pendingFocus.current = { key, settings };
  };

  const remove = (i: number) => {
    onChange(policies.filter((_, j) => j !== i));
    setKeys(keys.filter((_, j) => j !== i));
    setEdits((n) => n + 1);
    setStatus(`Removed column ${i + 1} (${names[i]}).`);
    // The button pressed is gone; the menu's trigger is the nearest control that stays.
    addRef.current?.querySelector<HTMLElement>('button')?.focus();
  };

  const variants = policies.map((policy) => variantOf(policy));

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <StepTransitionProvider step={edits}>
        <Flip className="flex flex-col gap-3">
          {policies.map((policy, i) => (
            <fieldset
              key={keys[i]}
              data-column-key={keys[i]}
              className="border-border rounded-md border p-3"
            >
              <legend className="text-small px-1 font-semibold">
                Column {i + 1}: {names[i]}
              </legend>
              <PolicyPicker
                label={`Column ${i + 1}`}
                policy={policy}
                disclose
                onChange={(next) =>
                  onChange(policies.map((p, j) => (j === i ? next : p)))
                }
              />
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={least}
                  onClick={() => remove(i)}
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  Remove column {i + 1}
                </Button>
              </div>
            </fieldset>
          ))}
        </Flip>
      </StepTransitionProvider>

      <div ref={addRef} className="flex flex-col gap-1">
        <Popover
          trigger={
            <>
              <Plus aria-hidden="true" className="size-3.5" />
              Add a policy
            </>
          }
          label="Add a policy"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          side="top"
          align="start"
          triggerProps={{ disabled: full }}
          triggerClassName="self-start"
          className="w-72"
        >
          {({ close }) => (
            <span className="flex flex-col gap-3 p-1">
              <span className="flex flex-col gap-1">
                <span className="text-caption text-fg-muted block font-semibold tracking-wide uppercase">
                  Same policy, other settings
                </span>
                {variants.some(Boolean) ? (
                  policies.map((policy, i) => {
                    const variant = variants[i];
                    if (!variant) return null;
                    return (
                      <Button
                        key={keys[i]}
                        variant="ghost"
                        size="sm"
                        className="justify-start text-left"
                        onClick={() => {
                          close();
                          add(
                            variant.policy,
                            `Added column ${policies.length + 1}: a copy of column ${i + 1} (${names[i]}) with ${variant.change}. Change its settings in column ${policies.length + 1}.`,
                            true,
                          );
                        }}
                      >
                        <Copy aria-hidden="true" className="size-3.5 shrink-0" />
                        Copy column {i + 1} ({names[i]}), {variant.change}
                      </Button>
                    );
                  })
                ) : (
                  <span className="text-small text-fg-secondary block">
                    FCFS, SJF and SRTF have no settings to change. Add a round robin,
                    priority or MLFQ column first.
                  </span>
                )}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-caption text-fg-muted block font-semibold tracking-wide uppercase">
                  Another policy
                </span>
                {POLICY_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    size="sm"
                    className="justify-start text-left"
                    onClick={() => {
                      close();
                      const policy = defaultPolicy(option.value);
                      add(
                        policy,
                        `Added column ${policies.length + 1}: ${policyName(policy)}.`,
                        false,
                      );
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </span>
            </span>
          )}
        </Popover>
        <p className="text-caption text-fg-muted">
          {full
            ? 'Four columns is the most Compare shows at once. Remove one to add another.'
            : least
              ? 'Compare needs at least two columns, so neither can be removed.'
              : 'Compare shows two to four columns.'}
        </p>
      </div>
      <p role="status" className="text-caption text-fg-muted min-h-4">
        {status}
      </p>
    </div>
  );
}
