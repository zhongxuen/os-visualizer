export { replaceCitations } from './citations';
export {
  allCurves,
  beladyPoints,
  CURVE_FRAMES,
  faultsByFrames,
  type Anomaly,
} from './curve';
export type { ReplCounters, ReplEvent, ReplEventKind, ReplSnapshot } from './events';
export {
  generate,
  GENERATE_LIMITS,
  GENERATE_SCHEMA,
  hotPages,
  WORKLOAD_NAMES,
  WORKLOADS,
  type GenerateOptions,
  type WorkloadKind,
} from './generate';
export {
  distinctPages,
  formatRefString,
  LIMITS,
  parseRefString,
  POLICIES,
  POLICY_NAMES,
  validateReplInput,
  type Policy,
  type ReplInput,
  type Validation,
  type ValidationIssue,
} from './input';
export { nextUse } from './policies';
export {
  BELADY_STRING,
  DEFAULT_PRESET,
  OSC10_STRING,
  OSTEP_STRING,
  presetById,
  REPL_PRESETS,
  type ReplPreset,
} from './presets';
export {
  countFaults,
  refResults,
  replace,
  runReplace,
  serve,
  totals,
  type Outcome,
  type RefResult,
  type ReplRun,
} from './replace';
export { REPL_RULES, type ReplRule } from './rules';
export { REPLACE_SHARE_STATE } from './state';
