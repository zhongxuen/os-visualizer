import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { BitField } from '@/components/blocks/BitField';
import { expectNoAxeViolations } from '@/components/testing/axe';
import { renderLinked } from '@/components/testing/linked';
import { VM_SHARE_STATE } from '@/core/vm/state';
import { REPLACE_SHARE_STATE } from '@/core/replace/state';
import { shareStateFromSearch } from '@/core/state/shareState';
import { geometry } from '@/core/vm/config';
import { presetById, type VmPreset } from '@/core/vm/presets';
import { VM_RULES } from '@/core/vm/rules';
import { runVm } from '@/core/vm/translate';

import { ruleIdFor, splitExplainer, vaParts } from './adapters';
import { toDraft } from './draft';
import { resultSentence, tryNextFor } from './endOfRun';
import { replacementHandoff } from './handoff';
import { humanMessage } from './messages';
import { isBaseKey, MODULE_SHORTCUTS } from './shortcuts';
import { stageStates } from './stages';
import { nextBase } from './BaseSwitch';
import { TranslationView } from './TranslationView';
import { walkAt } from './WalkPath';

/** The U3.3 behaviours: T1-T5, G4, G5, G10, G11 and G16 (docs/UIUX.md). */

const ARRAY = presetById('ostep-array')!;
const TWO = presetById('two-level')!;
const INVALID = presetById('invalid-page')!;
const PAGING = presetById('ostep-paging')!;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

/** The text a reader sees: without the glossary terms' hidden definitions. */
function shownText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('[hidden]').forEach((node) => node.remove());
  return copy.textContent ?? '';
}

function statuses(preset: VmPreset, kind: string, nth = 0): string[] {
  const run = runVm(preset.input);
  let seen = -1;
  const index = run.events.findIndex((e) => e.kind === kind && ++seen === nth);
  return stageStates(run, index, preset.input.config.tlbSize)!.map((s) => s.status);
}

describe('pipeline stages (T2)', () => {
  it('keeps every later stage pending until the lookup decides', () => {
    expect(statuses(ARRAY, 'vm.split')).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('walks, checks, fills and accesses on a miss', () => {
    expect(statuses(ARRAY, 'vm.readPte')).toEqual([
      'done',
      'done',
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
    expect(statuses(ARRAY, 'vm.memory')).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done',
      'done',
      'current',
    ]);
  });

  it('skips the walk and the fill on a hit, from the lookup on', () => {
    expect(statuses(ARRAY, 'vm.tlbHit')).toEqual([
      'done',
      'current',
      'skipped',
      'pending',
      'skipped',
      'pending',
      'pending',
    ]);
    // Access 2 is the first hit: its physical-address step is the second one.
    expect(statuses(ARRAY, 'vm.physical', 1)).toEqual([
      'done',
      'done',
      'skipped',
      'done',
      'skipped',
      'current',
      'pending',
    ]);
  });

  it('skips only the fill with no TLB', () => {
    expect(statuses(PAGING, 'vm.memory')).toEqual([
      'done',
      'done',
      'done',
      'done',
      'skipped',
      'done',
      'current',
    ]);
  });

  it('stops at a fault', () => {
    expect(statuses(INVALID, 'vm.fault')).toEqual([
      'done',
      'done',
      'fault',
      'stopped',
      'stopped',
      'stopped',
      'stopped',
    ]);
  });
});

describe('walk, handoff, messages, rules, end of run', () => {
  it('reads a two-level walk as PDBR → PDE → PTE, one reference per hop', () => {
    const g = geometry(TWO.input.config);
    const run = runVm(TWO.input);
    const pte = run.events.findIndex((e) => e.kind === 'vm.readPte');
    const walk = walkAt(run.events, pte, g, TWO.input.config.ptbr)!;
    expect(walk.hops.map((h) => h.id)).toEqual(['root', 'pde', 'pte']);
    expect(walk.refs).toBe(2);
    expect(walk.hit).toBe(false);
  });

  it('carries the run’s pages to Page Replacement in its own share format (T5)', () => {
    const handoff = replacementHandoff(INVALID.input);
    expect(handoff.pages).toEqual([0, 2, 1, 5, 2]);
    const decoded = shareStateFromSearch(
      REPLACE_SHARE_STATE,
      handoff.href.split('?')[1]!,
    );
    expect(decoded).toEqual({
      ...REPLACE_SHARE_STATE.defaults,
      input: { ...REPLACE_SHARE_STATE.defaults.input, refString: [0, 2, 1, 5, 2] },
    });
  });

  it('says why pages above 15 can’t be carried', () => {
    const handoff = replacementHandoff(TWO.input);
    expect(handoff).toMatchObject({ href: '/replacement', pages: null });
    expect(handoff.reason).toMatch(/pages 0–15 and this run reaches page 254/);
  });

  it('maps schema issues to human words (G11)', () => {
    const draft = toDraft(ARRAY.input);
    const msg = (path: (string | number)[], message: string) =>
      humanMessage({ path, message }, draft);
    expect(msg(['config', 'vaBits'], 'x')).toBe(
      'Virtual addresses here are 6 to 16 bits wide.',
    );
    expect(msg(['pages', 0, 'vpn'], 'VPN 6 is listed twice')).toBe(
      'Page 6 is already in the table.',
    );
    expect(msg(['pages', 0, 'pfn'], 'PFN must be below 64')).toBe(
      'Frame numbers (PFNs) here are 0 to 63.',
    );
    expect(msg(['config', 'ptbr'], 'PTBR must be a multiple of 4')).toBe(
      'The table base must be a multiple of 4, because each entry is 4 bytes.',
    );
    expect(msg(['accesses', 1, 'op'], 'Invalid option')).toBe(
      'Access 2: add “w” after the address for a write; an address alone is a read.',
    );
  });

  it('suggests a contrasting preset, and one for a custom input (G16)', () => {
    const counters = (hits: number, misses: number) => ({
      accesses: hits + misses,
      hits,
      misses,
      faults: 0,
      memRefs: 0,
    });
    expect(tryNextFor(ARRAY.input, counters(7, 3)).preset.id).toBe('ostep-array-twice');
    expect(tryNextFor(INVALID.input, counters(0, 5)).preset.id).toBe('read-only-write');
    const custom = { ...ARRAY.input, accesses: [{ va: 1, op: 'read' as const }] };
    expect(tryNextFor(custom, counters(5, 1)).preset.id).toBe('tlb-thrash');
    expect(tryNextFor(custom, counters(1, 5)).preset.id).toBe('ostep-array');
    expect(resultSentence(counters(1, 0))).toBe(
      '1 access: 1 TLB hit and 0 misses (100% hit rate); 0 memory references, 0 per access; no faults.',
    );
  });

  it('names the rule behind each kind of step (G5), and every rule has plain words (G4)', () => {
    const run = runVm(TWO.input);
    const config = TWO.input.config;
    const byKind = (kind: string) => run.events.find((e) => e.kind === kind);
    expect(ruleIdFor(byKind('vm.split'), config)).toBe('vm.split.twoLevel');
    expect(ruleIdFor(byKind('vm.readPde'), config)).toBe('vm.pte.address');
    expect(ruleIdFor(byKind('vm.tlbInsert'), config)).toBe('vm.tlb.fill');
    expect(ruleIdFor(byKind('vm.memory'), config)).toBe('vm.refs.count');
    expect(ruleIdFor(runVm(ARRAY.input).events[0], ARRAY.input.config)).toBeNull();
    const ids = new Set(VM_RULES.map((r) => r.id));
    for (const event of run.events) {
      const id = ruleIdFor(event, config);
      if (id) expect(ids.has(id), id).toBe(true);
    }
    for (const rule of VM_RULES) {
      expect(rule.plain, rule.id).toBeTruthy();
      expect(rule.whyItMatters, rule.id).toBeTruthy();
    }
  });

  it('has one module key, B, which cycles the base', () => {
    expect(MODULE_SHORTCUTS.map((s) => s.chords)).toEqual([[['B']]]);
    expect(isBaseKey({ key: 'b' })).toBe(true);
    expect(isBaseKey({ key: 'b', ctrlKey: true })).toBe(false);
    expect(nextBase('binary')).toBe('hex');
    expect(nextBase('decimal')).toBe('binary');
  });
});

describe('BitField, one base at a time (T1)', () => {
  it('shows one base, with the others on hover and to screen readers', async () => {
    const { container } = render(
      <BitField
        label="Virtual address"
        value={100}
        fields={vaParts(geometry(ARRAY.input.config))}
        base="hex"
        tinted
      />,
    );
    const vpn = container.querySelector('[data-field="vpn"]')!;
    expect(vpn).toHaveTextContent('0x6');
    expect(vpn).not.toHaveTextContent('Binary');
    expect(vpn.querySelector('[title]')).toHaveAttribute(
      'title',
      'binary 0110, decimal 6',
    );
    expect(screen.getByText('0x64')).toHaveAttribute(
      'title',
      'binary 01100100, decimal 100',
    );
    await expectNoAxeViolations(container);
  });

  it('keeps the original three-base layout when no base is given', () => {
    const { container } = render(
      <BitField value={100} fields={vaParts(geometry(ARRAY.input.config))} />,
    );
    expect(container.querySelector('figure')).not.toHaveAttribute('data-base');
    expect(container.querySelector('[data-field="vpn"]')).toHaveTextContent(
      /Binary0110Hex0x6Decimal6/,
    );
  });
});

describe('TranslationView, U3.3', { timeout: 30_000 }, () => {
  it('carries the pages over from a fault and marks the entry (T5)', async () => {
    const user = userEvent.setup();
    render(<TranslationView />);
    await user.selectOptions(screen.getByLabelText('Preset'), 'invalid-page');
    await user.click(screen.getByRole('button', { name: 'Load preset' }));
    const run = runVm(INVALID.input);
    const fault = run.events.findIndex((e) => e.kind === 'vm.fault');
    await act(async () => {
      for (let i = 0; i < fault; i += 1) await user.keyboard('{ArrowRight}');
    });
    const inspector = screen.getByRole('region', { name: 'Inspector' });
    const href = within(inspector)
      .getByRole('link', { name: /Page Replacement/ })
      .getAttribute('href')!;
    const carried = shareStateFromSearch(REPLACE_SHARE_STATE, href.split('?')[1]!);
    expect(carried.input.refString).toEqual([0, 2, 1, 5, 2]);
    expect(within(inspector).getByTestId('fault-next-pages')).toHaveTextContent(
      'Page 2 is the one that faulted.',
    );
    expect(document.querySelector('[data-vpn="2"]')).toHaveAttribute(
      'data-fault',
      'invalid',
    );
    expect(within(inspector).getByRole('link', { name: /Rule used/ })).toHaveAttribute(
      'data-rule-chip',
      'vm.fault.stop',
    );
  });

  it('keeps the editor behind "Edit this input", advanced settings under More options (G10)', async () => {
    const user = userEvent.setup();
    render(<TranslationView />);
    expect(screen.queryByLabelText(/Virtual addresses, in order/)).toBeNull();
    const edit = screen.getByRole('button', { name: /Edit this input/ });
    expect(edit).toHaveAttribute('aria-expanded', 'false');
    await user.click(edit);
    expect(edit).toHaveAttribute('aria-expanded', 'true');
    expect(
      await screen.findByLabelText(
        /Virtual addresses, in order/,
        {},
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
    const more = screen.getByText('More options').closest('details')!;
    expect(more).not.toHaveAttribute('open');
    expect(within(more).getByLabelText(/PTBR/)).toBeInTheDocument();
  });

  it('reads the access list into chips and names a bad token (G11)', async () => {
    const user = userEvent.setup();
    render(<TranslationView />);
    await user.click(screen.getByRole('button', { name: /Edit this input/ }));
    const box = await screen.findByLabelText(
      /Virtual addresses, in order/,
      {},
      { timeout: 15_000 },
    );
    await user.clear(box);
    await user.type(box, '4, abc');
    const chips = screen.getByRole('list', { name: 'Accesses as read' });
    expect(within(chips).getAllByRole('listitem')).toHaveLength(2);
    expect(
      screen.getByText(
        'Access 2: “abc” isn’t an address. Use decimal (100) or hex (0x64).',
      ),
    ).toBeInTheDocument();
  });

  it('shows the walk and the fill skipped on a TLB hit (T2)', async () => {
    const user = userEvent.setup();
    renderLinked(<TranslationView />, VM_SHARE_STATE);
    const run = runVm(ARRAY.input);
    const hit = run.events.findIndex((e) => e.kind === 'vm.tlbHit');
    await act(async () => {
      for (let i = 0; i < hit; i += 1) await user.keyboard('{ArrowRight}');
    });
    const pipeline = document.querySelector<HTMLElement>('[data-pipeline]')!;
    const status = (name: string) =>
      pipeline.querySelector(`[data-stage="${name}"]`)!.getAttribute('data-status');
    expect(status('tlb')).toBe('current');
    expect(status('walk')).toBe('skipped');
    expect(status('fill')).toBe('skipped');
    expect(status('check')).toBe('pending');
    expect(within(pipeline).getAllByText('skipped: hit')).toHaveLength(2);
    expect(screen.getByTestId('tlb-lookup')).toHaveTextContent('found, a hit');
    expect(
      screen.getByText(/No walk: the TLB already had this page/),
    ).toBeInTheDocument();
  });

  it('switches the number base with the control and the B key (T1)', async () => {
    const user = userEvent.setup();
    const { container } = renderLinked(<TranslationView />, VM_SHARE_STATE);
    const figure = () => container.querySelector('figure[data-base]')!;
    expect(figure()).toHaveAttribute('data-base', 'binary');
    await user.click(screen.getByRole('radio', { name: 'Hex' }));
    expect(figure()).toHaveAttribute('data-base', 'hex');
    (document.activeElement as HTMLElement).blur();
    await user.keyboard('b');
    expect(figure()).toHaveAttribute('data-base', 'decimal');
    expect(shownText(screen.getByTestId('split-explainer'))).toBe(
      splitExplainer(geometry(ARRAY.input.config)),
    );
  });

  it('puts the sizing calculator on its own tab, tied to the walk (T4)', async () => {
    const user = userEvent.setup();
    renderLinked(<TranslationView />, VM_SHARE_STATE);
    expect(screen.queryByTestId('sizing-intro')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Why two levels?' }));
    expect(
      await screen.findByTestId('sizing-intro', {}, { timeout: 15_000 }),
    ).toBeVisible();
    expect(shownText(screen.getByTestId('sizing-intro'))).toContain(
      'a linear table needs 16 page-table entries × 4 bytes = 64 bytes',
    );
  });

  it('ends on a card with the result and a contrasting preset (G16)', async () => {
    const user = userEvent.setup();
    renderLinked(<TranslationView />, VM_SHARE_STATE);
    await act(async () => {
      await user.keyboard('{End}');
    });
    const card = await screen.findByRole('region', { name: 'End of the run' });
    expect(card).toHaveTextContent(
      '10 accesses: 7 TLB hits and 3 misses (70% hit rate); 13 memory references, 1.3 per access; no faults.',
    );
    await user.click(
      within(card).getByRole('button', { name: /Same array, second pass/ }),
    );
    expect(
      screen.getByText('Loaded preset: Same array, second pass'),
    ).toBeInTheDocument();
  });
});
