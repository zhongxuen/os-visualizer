export {
  geometry,
  LIMITS,
  PTE_BYTES,
  validateVmInput,
  type Access,
  type DirectoryEntry,
  type Geometry,
  type Levels,
  type Op,
  type PageMapping,
  type Prot,
  type TlbPolicy,
  type ValidationIssue,
  type VmConfig,
  type VmInput,
} from './config';
export { vmCitations } from './citations';
export type {
  AccessResult,
  FaultKind,
  VmCounters,
  VmEvent,
  VmEventKind,
  VmSnapshot,
  VmStep,
} from './events';
export {
  buildTables,
  directoryFor,
  pdeAddress,
  physicalAddress,
  pteAddress,
  splitVa,
  type PageTables,
  type Pde,
  type Pte,
  type VaFields,
} from './memory';
export {
  DEFAULT_PRESET,
  presetById,
  regionsFor,
  VM_PRESETS,
  type VmPreset,
} from './presets';
export { VM_RULES, type VmRule } from './rules';
export {
  pageTableSizes,
  SIZING_LIMITS,
  validateSizing,
  type Region,
  type SizingInput,
  type SizingResult,
} from './sizing';
export { VM_SHARE_STATE } from './state';
export { createTlb, tlbOccupancy, type Tlb, type TlbEntry } from './tlb';
export { bin, runVm, translate, type VmRun } from './translate';
