import type { SimResult } from '../sim/result';
import type { SchedEvent } from './events';
import { runKernel } from './kernel';
import type { Policy, Workload } from './workload';

export type SchedRun = SimResult<SchedEvent>;

/**
 * Run `workload` under `policy`: one event list, one phase per dispatch or idle stretch,
 * one tick per `TICK_MS`. Pure and deterministic.
 *
 * Expects valid input (`validateWorkload`, `validatePolicy`); the page validates before
 * it calls this.
 */
export function schedule(workload: Workload, policy: Policy): SchedRun {
  return runKernel(workload, policy);
}
