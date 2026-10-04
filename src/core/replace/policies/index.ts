import type { Policy } from '../input';
import { clock } from './clock';
import { fifo } from './fifo';
import { lru } from './lru';
import { opt } from './opt';
import type { ReplacementPolicy } from './types';

export const POLICY_IMPLS: Record<Policy, ReplacementPolicy> = { fifo, lru, opt, clock };

export { clock } from './clock';
export { fifo } from './fifo';
export { lru } from './lru';
export { nextUse, opt } from './opt';
export {
  copyMemory,
  emptyMemory,
  frameOf,
  listPages,
  type ClockScan,
  type Memory,
  type ReplacementPolicy,
  type VictimChoice,
  type VictimContext,
} from './types';
