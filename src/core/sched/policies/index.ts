import type { Policy } from '../workload';
import { fcfsPolicy } from './fcfs';
import { mlfqPolicy } from './mlfq';
import { priorityPolicy } from './priority';
import { rrPolicy } from './rr';
import { sjfPolicy } from './sjf';
import { srtfPolicy } from './srtf';
import type { SchedPolicy } from './types';

export function policyImpl(policy: Policy): SchedPolicy {
  switch (policy.kind) {
    case 'fcfs':
      return fcfsPolicy();
    case 'sjf':
      return sjfPolicy();
    case 'srtf':
      return srtfPolicy();
    case 'priority':
      return priorityPolicy(policy.preemptive);
    case 'rr':
      return rrPolicy(policy.quantum);
    case 'mlfq':
      return mlfqPolicy(policy.levels);
  }
}

export type { ProcState, SchedPolicy } from './types';
