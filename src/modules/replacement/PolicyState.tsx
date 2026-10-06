import type { ReactNode } from 'react';

import { Ticker } from '@/components/motion/Ticker';
import type { ReplEvent } from '@/core/replace/events';
import { POLICY_NAMES, type Policy } from '@/core/replace/input';
import { cn } from '@/lib/cn';

/**
 * What the policy is looking at right now, frame by frame: FIFO's queue position, LRU's
 * last use, OPT's next use, Clock's use bits and hand. The frame the event is about is
 * marked in text ("this step") as well as with the outline. OPT's next use is a count
 * down ("in 4") that rolls as the string goes by.
 */

const COLUMN: Record<Policy, string> = {
  fifo: 'Queue position',
  lru: 'Last used',
  opt: 'Next needed',
  clock: 'Use bit',
};

function cell(event: ReplEvent, policy: Policy, frame: number): ReactNode {
  const { state } = event;
  const page = state.frames[frame];
  if (page === null || page === undefined) return '—';
  switch (policy) {
    case 'fifo': {
      const at = state.queue?.indexOf(page) ?? -1;
      if (at === -1) return '—';
      return at === 0 ? '1 (oldest)' : String(at + 1);
    }
    case 'lru': {
      const at = state.lastUse?.[frame];
      return at === null || at === undefined ? '—' : `reference ${at + 1}`;
    }
    case 'opt': {
      const at = state.nextUse?.[frame];
      if (at === null || at === undefined) return 'never';
      // The look-ahead counts down as the string goes by (§7.2.4).
      return (
        <>
          in <Ticker value={at - state.index} /> (reference {at + 1})
        </>
      );
    }
    case 'clock':
      return String(state.useBits?.[frame] ?? 0);
  }
}

export function PolicyState({ event, policy }: { event: ReplEvent; policy: Policy }) {
  const { frames, hand } = event.state;
  const focus = event.frame;
  return (
    <table className="text-small w-full max-w-md border-collapse text-left">
      <caption className="text-caption text-fg-muted mb-1 text-left">
        What {POLICY_NAMES[policy]} sees after this step
      </caption>
      <thead>
        <tr>
          <th scope="col" className="px-2 py-1 font-medium">
            Frame
          </th>
          <th scope="col" className="px-2 py-1 font-medium">
            Page
          </th>
          <th scope="col" className="px-2 py-1 font-medium">
            {COLUMN[policy]}
          </th>
          {policy === 'clock' ? (
            <th scope="col" className="px-2 py-1 font-medium">
              Hand
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody className="font-mono">
        {frames.map((page, f) => (
          <tr
            key={f}
            data-focus={f === focus || undefined}
            className={cn(
              'border-border border-t',
              f === focus && 'outline-accent outline-2 -outline-offset-2',
            )}
          >
            <th scope="row" className="px-2 py-1 font-sans font-medium">
              {f}
              {f === focus ? (
                <span className="text-caption text-accent ml-1">this step</span>
              ) : null}
            </th>
            <td className="px-2 py-1">{page ?? '—'}</td>
            <td className="px-2 py-1">{cell(event, policy, f)}</td>
            {policy === 'clock' ? (
              <td className="px-2 py-1 font-sans">{hand === f ? '▶ here' : ''}</td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
