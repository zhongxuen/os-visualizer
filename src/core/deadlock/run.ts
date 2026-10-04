/**
 * The run on screen for a whole `/deadlock` input: the graph run or the Banker's run,
 * whichever tab is showing.
 */

import { runRequest, runSafety } from './bankers';
import type { DlRun } from './emitter';
import { runGraph } from './recover';
import type { DlInput } from './state';

export function runGraphInput(input: DlInput): DlRun {
  return runGraph(input.graph, input.method, input.recovery);
}

export function runBankersInput(input: DlInput): DlRun {
  return input.query.run === 'safety'
    ? runSafety(input.bankers)
    : runRequest(input.bankers, { t: input.query.t, request: input.query.request });
}

/** The run for the tab on screen. Expects a valid input. */
export function runInput(input: DlInput): DlRun {
  return input.view === 'graph' ? runGraphInput(input) : runBankersInput(input);
}
