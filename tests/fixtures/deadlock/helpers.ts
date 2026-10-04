import { addVec, leq, needOf, type BankersState, type DlRun } from '@/core/deadlock';

/** The state after the last event: the finished run. */
export function final(run: DlRun) {
  const last = run.events.at(-1);
  if (!last) throw new Error('empty run');
  return last.state;
}

export function kinds(run: DlRun): string[] {
  return run.events.map((e) => e.kind);
}

/**
 * True when `order` lets each thread in turn get its row (Need or Request) from Work and
 * release its Allocation. Validates a sequence instead of comparing it with the book's.
 */
export function isValidOrder(
  rows: readonly (readonly number[])[],
  allocation: readonly (readonly number[])[],
  available: readonly number[],
  order: readonly number[],
): boolean {
  if (new Set(order).size !== order.length) return false;
  let work = [...available];
  for (const t of order) {
    if (!leq(rows[t]!, work)) return false;
    work = addVec(work, allocation[t]!);
  }
  return true;
}

/** A complete safe sequence for a Banker's state. */
export function isSafeSequence(state: BankersState, order: readonly number[]): boolean {
  return (
    order.length === state.max.length &&
    isValidOrder(needOf(state), state.allocation, state.available, order)
  );
}
