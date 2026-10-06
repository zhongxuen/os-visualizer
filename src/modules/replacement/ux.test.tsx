import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { FrameStrip, type FrameColumn } from '@/components/blocks/FrameStrip';
import { MiniLineChart } from '@/components/blocks/MiniLineChart';
import { StepTransitionProvider } from '@/components/motion/useStepTransition';
import { expectNoAxeViolations } from '@/components/testing/axe';
import { BELADY_STRING, OSC10_STRING, presetById } from '@/core/replace/presets';
import { replace } from '@/core/replace/replace';
import { REPL_RULES } from '@/core/replace/rules';

import {
  beladyOvertakes,
  finalColumns,
  frameNotes,
  resultSentence,
  ruleIdFor,
  stripColumns,
  tryNextFor,
  victimReason,
} from './adapters';
import { BeladyPanel } from './BeladyPanel';
import { ClockRing, frameAngle, nextHandAngle } from './ClockRing';
import { FaultSplit } from './FaultSplit';
import { RefChips } from './InputPanel';
import { generatorMessage, refMessages, refTokens, validRefString } from './messages';
import { ReplacementView } from './ReplacementView';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

describe('rules (G4)', () => {
  it('every rule has a plain sentence and why it matters', () => {
    for (const rule of REPL_RULES) {
      expect(rule.plain, rule.id).toBeTruthy();
      expect(rule.whyItMatters, rule.id).toBeTruthy();
    }
  });

  it('names the rule that decided each kind of step (G5)', () => {
    const ids = new Set(REPL_RULES.map((r) => r.id));
    for (const policy of ['fifo', 'lru', 'opt', 'clock'] as const) {
      const run = replace(OSC10_STRING, 3, policy);
      for (const event of run.events) {
        const id = ruleIdFor(event, policy);
        if (id !== null)
          expect(ids.has(id), `${policy} ${event.kind} -> ${id}`).toBe(true);
      }
    }
    const run = replace(OSC10_STRING, 3, 'fifo');
    const byKind = (kind: string) => run.events.find((e) => e.kind === kind)!;
    expect(ruleIdFor(byKind('repl.fault'), 'fifo')).toBe('repl.miss.kinds');
    expect(ruleIdFor(byKind('repl.victim'), 'fifo')).toBe('repl.fifo');
    expect(ruleIdFor(byKind('repl.evict'), 'fifo')).toBe('repl.dirty');
    expect(ruleIdFor(byKind('repl.load'), 'fifo')).toBe('repl.fill.order');
    expect(ruleIdFor(byKind('repl.hit'), 'fifo')).toBe('repl.fifo');
    expect(ruleIdFor(byKind('repl.hit'), 'opt')).toBeNull();
    expect(ruleIdFor(undefined, 'fifo')).toBeNull();
  });
});

describe('typing a reference string (R5, G11)', () => {
  it('splits on spaces and commas and judges each token', () => {
    const tokens = refTokens('7 0,1 ;x 99');
    expect(tokens.map((t) => t.page)).toEqual([7, 0, 1, null, null]);
    expect(refMessages(tokens)).toEqual([
      'Reference 4: “x” is not a page. Pages are whole numbers from 0 to 15.',
      'Reference 5: Page 99 is too big. Pages are whole numbers from 0 to 15.',
    ]);
    expect(validRefString(tokens)).toBeNull();
    expect(validRefString(refTokens('1 2 3'))).toEqual([1, 2, 3]);
  });

  it('says how many to remove past the limit, and asks for one when empty', () => {
    const many = refTokens(Array.from({ length: 43 }, () => '1').join(' '));
    expect(refMessages(many)).toEqual([
      'That is 43 references; the most is 40. Remove 3.',
    ]);
    expect(validRefString(many)).toBeNull();
    expect(validRefString(refTokens('  '))).toBeNull();
  });

  it('has one human message per generator field', () => {
    expect(generatorMessage('length')).toMatch(/from 1 to 40/);
    expect(generatorMessage('pages')).toMatch(/from 1 to 16/);
    expect(generatorMessage('seed')).toMatch(/same seed/);
  });

  it('draws a chip per reference and marks the bad ones in words', async () => {
    const { container } = render(<RefChips tokens={refTokens('1 2 x')} />);
    const list = screen.getByRole('list', { name: 'References as read' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(container.querySelectorAll('[data-bad]')).toHaveLength(1);
    expect(screen.getByText(', not a page')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('shows the chips and the messages live in the editor', async () => {
    const user = userEvent.setup();
    render(<ReplacementView />);
    const box = screen.getByLabelText(/Pages referenced/);
    await user.clear(box);
    await user.type(box, '3 4 q');
    expect(
      within(screen.getByRole('list', { name: 'References as read' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(3);
    expect(screen.getByText(/Reference 3: “q” is not a page/)).toBeInTheDocument();
    expect(box).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('the strip on the current step (R2, §7.2.4)', () => {
  it('marks the hit, the victim with its reason, and the page leaving', () => {
    const run = replace(OSC10_STRING, 3, 'fifo');
    const at = (kind: string, index: number) =>
      run.events.find((e) => e.kind === kind && e.state.index === index)!;
    const victim = at('repl.victim', 3);
    expect(victimReason(victim)).toBe('loaded first');
    expect(stripColumns(run, OSC10_STRING, victim, 'fifo')[3]!.victim).toEqual({
      frame: 0,
      reason: 'loaded first',
    });
    expect(
      stripColumns(run, OSC10_STRING, at('repl.evict', 3), 'fifo')[3]!.leaving,
    ).toEqual({ frame: 0, page: 7 });
    expect(stripColumns(run, OSC10_STRING, at('repl.hit', 4), 'fifo')[4]!.hitFrame).toBe(
      1,
    );
  });

  it('labels each frame with OPT’s next use and LRU’s last use, and nothing else', () => {
    const opt = replace([1, 2, 3, 1, 4, 2], 3, 'opt');
    const fault = opt.events.find((e) => e.kind === 'repl.fault' && e.state.index === 4)!;
    // Frames hold 1, 2, 3 at reference 5 (index 4): 1 is never used again, 2 in 1.
    expect(frameNotes(fault, 'opt')).toEqual([
      'not needed again',
      'next in 1',
      'not needed again',
    ]);
    const lru = replace([1, 2, 3, 1], 3, 'lru');
    expect(frameNotes(lru.events.at(-1)!, 'lru')).toEqual([
      'used now',
      'used 2 ago',
      'used 1 ago',
    ]);
    expect(frameNotes(lru.events.at(-1)!, 'fifo')).toBeUndefined();
  });

  it('FrameStrip draws the optional marks in words', async () => {
    const columns: FrameColumn[] = [
      { ref: 1, frames: [1, null], fault: true, loaded: 0 },
      {
        ref: 1,
        frames: [1, null],
        fault: false,
        hitFrame: 0,
        notes: ['next in 2', null],
      },
      {
        ref: 2,
        frames: [1, 2],
        fault: true,
        victim: { frame: 0, reason: 'loaded first' },
      },
    ];
    const { container, rerender } = render(
      <FrameStrip columns={columns} step={2} refMarks fit animate />,
    );
    expect(screen.getByText('victim: loaded first')).toBeInTheDocument();
    expect(screen.getByText('next in 2')).toBeInTheDocument();
    expect(container.querySelector('td[data-hit]')).toHaveTextContent('1Hhitnext in 2');
    // Past references carry H or F.
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveTextContent('1Ffault');
    expect(headers[1]).toHaveTextContent('1Hhit');
    expect(container.querySelector('thead th[scope="row"]')).toHaveClass('sticky');
    await expectNoAxeViolations(container);
    rerender(
      <FrameStrip
        columns={[
          { ref: 2, frames: [null, 2], fault: true, leaving: { frame: 0, page: 1 } },
        ]}
        step={0}
      />,
    );
    expect(screen.getByText('1 out')).toBeInTheDocument();
  });
});

describe('faults split (R1)', () => {
  it('says the split in words', () => {
    render(<FaultSplit cold={6} capacity={9} label="FIFO" />);
    expect(screen.getByText(/FIFO/).closest('p')).toHaveTextContent(
      'FIFO: 6 cold + 9 capacity = 15 faults',
    );
  });
});

describe('Clock ring', () => {
  it('points the hand where the snapshot says, on every step, turning clockwise', () => {
    const preset = presetById('clock')!;
    const run = replace(preset.input.refString, preset.input.frames, 'clock');
    const ring = (i: number) => (
      <StepTransitionProvider step={i}>
        <ClockRing state={run.events[i]!.state} focus={run.events[i]!.frame} />
      </StepTransitionProvider>
    );
    const { container, rerender } = render(ring(0));
    let last = -Infinity;
    run.events.forEach((event, i) => {
      rerender(ring(i));
      const n = event.state.frames.length;
      const hand = container.querySelector('[data-hand]')!;
      expect(hand.getAttribute('data-hand')).toBe(String(event.state.hand));
      const angle = Number(hand.getAttribute('data-angle'));
      expect(((angle % 360) + 360) % 360).toBeCloseTo(frameAngle(event.state.hand!, n));
      expect(angle).toBeGreaterThanOrEqual(last);
      last = angle;
      const bits = [...container.querySelectorAll('[data-frame]')].map((g) =>
        Number(g.getAttribute('data-bit')),
      );
      expect(bits).toEqual(event.state.useBits);
      expect(
        screen.getByText(new RegExp(`Hand at frame ${event.state.hand}`)),
      ).toBeTruthy();
    });
  });

  it('wraps forward but jumps straight back', () => {
    expect(nextHandAngle({ hand: 2, angle: 240 }, 0, 3, true)).toBe(360);
    expect(nextHandAngle({ hand: 2, angle: 240 }, 0, 3, false)).toBe(0);
    expect(nextHandAngle({ hand: 0, angle: 360 }, 0, 3, true)).toBe(360);
  });
});

describe('Belady callout (R3)', { timeout: 30_000 }, () => {
  it('appears exactly when the 4-frame count passes the 3-frame count', async () => {
    const user = userEvent.setup();
    render(<BeladyPanel refString={BELADY_STRING} frames={3} />);
    const small = replace(BELADY_STRING, 3, 'fifo');
    const large = replace(BELADY_STRING, 4, 'fifo');
    const smallCols = finalColumns(small, BELADY_STRING);
    const largeCols = finalColumns(large, BELADY_STRING);
    const seen: boolean[] = [];
    for (let i = 0; i < BELADY_STRING.length; i += 1) {
      if (i > 0) await user.click(screen.getByRole('button', { name: 'Next' }));
      const s = smallCols.slice(0, i + 1).filter((c) => c.fault).length;
      const l = largeCols.slice(0, i + 1).filter((c) => c.fault).length;
      expect(screen.getByTestId('belady-faults-small')).toHaveTextContent(String(s));
      expect(screen.getByTestId('belady-faults-large')).toHaveTextContent(String(l));
      const shown = screen.queryByTestId('belady-callout') !== null;
      expect(shown, `reference ${i + 1}: ${l} vs ${s}`).toBe(beladyOvertakes(s, l));
      seen.push(shown);
    }
    // On this string, 4 frames only pass 3 at the last reference: 10 against 9.
    expect(seen.lastIndexOf(false)).toBe(BELADY_STRING.length - 2);
    expect(screen.getByTestId('belady-callout')).toHaveTextContent(
      '4 frames, more faults than 3: 10 against 9.',
    );
    // Back a step: gone again.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByTestId('belady-callout')).toBeNull();
  });

  it('never appears for LRU', async () => {
    const user = userEvent.setup();
    render(<BeladyPanel refString={BELADY_STRING} frames={3} policy="lru" />);
    for (let i = 1; i < BELADY_STRING.length; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.queryByTestId('belady-callout')).toBeNull();
    }
  });
});

describe('MiniLineChart extras', () => {
  it('rings a marked point and says so in its description', () => {
    render(
      <MiniLineChart
        title="Faults"
        xLabel="Frames"
        yLabel="Faults"
        x={[3, 4]}
        series={[{ id: 'fifo', label: 'FIFO', values: [9, 10] }]}
        marks={[{ seriesId: 'fifo', index: 1, label: 'FIFO: 9 → 10' }]}
        drawIn
      />,
    );
    const chart = screen.getByRole('img');
    expect(chart).toHaveAccessibleName(/FIFO: 9 → 10\.$/);
    expect(chart.querySelector('[data-mark="fifo"] circle')).not.toBeNull();
    // No IntersectionObserver here: the lines are simply drawn.
    expect(chart.querySelector('clipPath')).toBeNull();
  });
});

describe('end of the run (G16)', { timeout: 30_000 }, () => {
  it('sums the run up and offers a contrasting run', () => {
    expect(resultSentence('fifo', 3, { faults: 15, cold: 6, hits: 5 }, 20)).toBe(
      'FIFO with 3 frames: 15 faults (6 cold, 9 capacity) and 5 hits in 20 references, a hit rate of 25%.',
    );
    expect(tryNextFor('fifo', BELADY_STRING, BELADY_STRING).presetId).toBe('belady-lru');
    expect(tryNextFor('fifo', OSC10_STRING, BELADY_STRING).policy).toBe('lru');
    expect(tryNextFor('lru', OSC10_STRING, BELADY_STRING).policy).toBe('opt');
    expect(tryNextFor('opt', OSC10_STRING, BELADY_STRING).policy).toBe('clock');
    expect(tryNextFor('clock', OSC10_STRING, BELADY_STRING).presetId).toBe('belady');
    for (const id of ['belady', 'belady-lru']) expect(presetById(id)).toBeDefined();
  });

  it('shows the rule used, then the card at the end, and Try this next switches policy', async () => {
    const user = userEvent.setup();
    const { container } = render(<ReplacementView />);
    // Step 1 is a cold fault: decided by the cold/capacity rule.
    expect(container.querySelector('[data-rule-chip="repl.miss.kinds"]')).not.toBeNull();
    await act(async () => {
      await user.keyboard('{End}');
    });
    const card = await screen.findByRole('region', { name: 'End of the run' });
    expect(card).toHaveTextContent('FIFO with 3 frames: 15 faults (6 cold, 9 capacity)');
    await user.click(
      within(card).getByRole('button', { name: /LRU on the same string/ }),
    );
    expect(screen.getByRole('tab', { name: /LRU/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('says OPT is the yardstick, only on the OPT tab', async () => {
    const user = userEvent.setup();
    render(<ReplacementView />);
    expect(screen.queryByTestId('opt-note')).toBeNull();
    await user.click(screen.getByRole('tab', { name: /OPT/ }));
    expect(screen.getByTestId('opt-note')).toHaveTextContent(/no real system can run it/);
  });
});
