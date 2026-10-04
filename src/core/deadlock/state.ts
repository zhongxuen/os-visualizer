import * as z from 'zod/mini';

import { defineShareState } from '../state/schema';
import {
  BANKERS_SCHEMA,
  bankersIssues,
  GRAPH_SCHEMA,
  graphIssues,
  LIMITS,
  RECOVERY_SCHEMA,
  recoveryIssues,
  requestIssues,
  type BankersState,
  type Graph,
  type Recovery,
  type ValidationIssue,
} from './model';
import {
  DEFAULT_BANKERS_PRESET,
  DEFAULT_GRAPH_PRESET,
  type BankersQuery,
} from './presets';
import { METHODS, type Method } from './recover';

export const VIEWS = ['graph', 'bankers'] as const;

export type DlView = (typeof VIEWS)[number];

/** Everything `/deadlock` needs to reproduce both tabs. */
export interface DlInput {
  view: DlView;
  graph: Graph;
  method: Method;
  recovery: Recovery[];
  bankers: BankersState;
  query: BankersQuery;
}

const QUERY_SCHEMA = z.object({
  run: z.enum(['safety', 'request']),
  t: z.int().check(z.gte(0), z.lte(LIMITS.maxProcesses - 1)),
  request: z
    .array(z.int().check(z.gte(0), z.lte(LIMITS.maxBankerValue)))
    .check(z.maxLength(LIMITS.maxResources)),
});

/** The recovery fits the graph and the request fits the Banker's state. */
export function inputIssues(input: DlInput): ValidationIssue[] {
  // Each part's own checks run first; the cross-checks assume well-formed parts.
  if (graphIssues(input.graph).length > 0 || bankersIssues(input.bankers).length > 0) {
    return [];
  }
  return [
    ...recoveryIssues(input.graph, input.recovery),
    ...requestIssues(input.bankers, input.query).map((issue) => ({
      ...issue,
      path: ['query', ...issue.path],
    })),
  ];
}

export const DL_INPUT_SCHEMA = z
  .object({
    view: z.enum(VIEWS),
    graph: GRAPH_SCHEMA,
    method: z.enum(METHODS),
    recovery: z.array(RECOVERY_SCHEMA).check(z.maxLength(LIMITS.maxRecovery)),
    bankers: BANKERS_SCHEMA,
    query: QUERY_SCHEMA,
  })
  .check(
    z.superRefine<DlInput>((value, ctx) => {
      for (const issue of inputIssues(value)) {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
          input: value,
        });
      }
    }),
  );

export const DEFAULT_INPUT: DlInput = {
  view: 'graph',
  graph: DEFAULT_GRAPH_PRESET.graph,
  method: DEFAULT_GRAPH_PRESET.method,
  recovery: [],
  bankers: DEFAULT_BANKERS_PRESET.state,
  query: DEFAULT_BANKERS_PRESET.query,
};

/**
 * Share state for `/deadlock`: the tab on screen, the graph with its method and recovery
 * steps, the Banker's state with its query, and the step of the run on screen. Keep the
 * export name; `src/core/state/modules.ts` imports it.
 */
export const DEADLOCK_SHARE_STATE = defineShareState({
  m: 'deadlock',
  v: 1,
  input: DL_INPUT_SCHEMA as unknown as z.ZodMiniType<DlInput>,
  defaults: { step: 0, input: DEFAULT_INPUT },
});
