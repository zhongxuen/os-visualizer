import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';
import { geometry } from '@/core/vm/config';
import { presetById } from '@/core/vm/presets';
import { runVm } from '@/core/vm/translate';

import {
  eventAt,
  formatAccesses,
  hitRate,
  parseAccesses,
  pdeFocus,
  pteAddressOf,
  pteFocus,
  pteRows,
  vaHighlight,
  vaParts,
} from './adapters';
import { autoDirectory, toDraft, validateDraft } from './draft';
import { parseNumber } from './fields';
import { PageTableView } from './PageTableView';
import { formatBytes } from './SizingPanel';
import { TlbView } from './TlbView';
import { TranslationView } from './TranslationView';
import { VmEditor } from './VmEditor';

const ARRAY = presetById('ostep-array')!;
const TWO = presetById('two-level')!;
const INVALID = presetById('invalid-page')!;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('adapters', () => {
  it('parses access lists, keeping bad tokens in place for the schema', () => {
    expect(parseAccesses('100, 104 w, 0x3F80 r\n8 write')).toEqual([
      { va: 100, op: 'read' },
      { va: 104, op: 'write' },
      { va: 0x3f80, op: 'read' },
      { va: 8, op: 'write' },
    ]);
    const bad = parseAccesses('abc, 4 x');
    expect(bad[0]!.va).toBeNaN();
    expect(bad[1]).toEqual({ va: 4, op: 'invalid' });
  });

  it('round-trips an access list through its text form', () => {
    for (const preset of [ARRAY, TWO, INVALID]) {
      const text = formatAccesses(preset.input.accesses, preset.input.config.vaBits);
      expect(parseAccesses(text)).toEqual(preset.input.accesses);
    }
    expect(formatAccesses(TWO.input.accesses, 14)).toMatch(/^0x3F80, /);
  });

  it('parses decimal and hex numbers and nothing else', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('0x1f')).toBe(31);
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('1.5')).toBeNaN();
  });

  it('reads the OSTEP array walk to a 70% hit rate at the end', () => {
    const run = runVm(ARRAY.input);
    const last = eventAt(run, 10_000)!;
    expect(last.state.counters).toMatchObject({ hits: 7, misses: 3, memRefs: 13 });
    expect(hitRate(last.state.counters)).toBe('70%');
    expect(hitRate({ accesses: 0, hits: 0, misses: 0, faults: 0, memRefs: 0 })).toBe('—');
    expect(eventAt(run, 0)!.kind).toBe('vm.split');
  });

  it('highlights the field and table row each step reads', () => {
    const g1 = geometry(ARRAY.input.config);
    const run1 = runVm(ARRAY.input);
    const readPte = run1.events.find((e) => e.kind === 'vm.readPte')!;
    expect(vaHighlight(readPte, g1)).toBe('vpn');
    expect(pteFocus(readPte)).toBe(6);
    expect(vaParts(g1).map((p) => p.bits)).toEqual([4, 4]);

    const g2 = geometry(TWO.input.config);
    const run2 = runVm(TWO.input);
    const readPde = run2.events.find((e) => e.kind === 'vm.readPde')!;
    expect(vaHighlight(readPde, g2)).toBe('pd');
    expect(pdeFocus(readPde, g2)).toBe(15);
    const pte2 = run2.events.find((e) => e.kind === 'vm.readPte')!;
    expect(vaHighlight(pte2, g2)).toBe('pt');
    expect(pteAddressOf(g2, TWO.input.config.ptbr, TWO.input.directory, pte2.vpn)).toBe(
      pte2.address,
    );
  });

  it('adds the unmapped VPN a fault reads as a row', () => {
    const g = geometry(INVALID.input.config);
    const run = runVm(INVALID.input);
    const fault = run.events.find((e) => e.kind === 'vm.fault' && e.vpn === 5)!;
    const rows = pteRows(g, 0, fault.state.ptes, [], pteFocus(fault));
    expect(rows.map((r) => r.vpn)).toEqual([0, 1, 2, 5]);
    expect(rows.find((r) => r.vpn === 5)).toMatchObject({ pte: null, address: 20 });
  });

  it('formats byte counts', () => {
    expect(formatBytes(64)).toBe('64 bytes');
    expect(formatBytes(4 * 2 ** 20)).toBe('4,194,304 bytes (4 MB)');
    expect(formatBytes(-1024)).toBe('−1,024 bytes (1 KB)');
  });
});

describe('draft', () => {
  it('validates a preset draft back to the preset', () => {
    for (const preset of [ARRAY, TWO, INVALID]) {
      const result = validateDraft(toDraft(preset.input));
      expect(result.ok && result.value.accesses).toEqual(preset.input.accesses);
    }
  });

  it('reports a PFN that does not fit physical memory against its row', () => {
    const draft = toDraft(ARRAY.input);
    draft.pages[1]!.pfn = '9999';
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.path).toEqual(['pages', 1, 'pfn']);
  });

  it('builds a directory for two levels', () => {
    const draft = toDraft(TWO.input);
    draft.directory = [];
    const directory = autoDirectory(draft)!;
    expect(directory.map((d) => d.index)).toEqual(['0', '15']);
    expect(validateDraft({ ...draft, directory }).ok).toBe(true);
  });
});

describe('views', () => {
  it('marks the TLB slot in use and names an eviction', async () => {
    const { container } = render(
      <TlbView
        slots={[{ vpn: 3, pfn: 7, prot: 'rw', loadedAt: 0, lastUsed: 2 }, null]}
        policy="lru"
        focus={0}
        action="fill"
        evicted={{ vpn: 1, pfn: 2, prot: 'r', loadedAt: 0, lastUsed: 0 }}
      />,
    );
    expect(container.querySelector('[data-slot="0"]')).toHaveAttribute('data-active');
    expect(screen.getByText('filled')).toBeInTheDocument();
    expect(screen.getByText('empty')).toBeInTheDocument();
    expect(screen.getByText('Evicted: VPN 1 → PFN 2.')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('says when there is no TLB', () => {
    render(<TlbView slots={[]} policy="lru" focus={null} />);
    expect(screen.getByText(/No TLB/)).toBeInTheDocument();
  });

  it('shows the PTE being read and its physical address', async () => {
    const g = geometry(ARRAY.input.config);
    const run = runVm(ARRAY.input);
    const read = run.events.find((e) => e.kind === 'vm.readPte')!;
    const { container } = render(
      <PageTableView
        g={g}
        ptbr={0}
        ptes={read.state.ptes}
        directory={[]}
        pteFocus={pteFocus(read)}
        pdeFocus={null}
        marked={null}
      />,
    );
    expect(container.querySelector('[data-vpn="6"]')).toHaveAttribute('data-active');
    expect(screen.getByTestId('pte-read')).toHaveTextContent(
      'Reading the PTE for VPN 6 at physical address 0x018 (24).',
    );
    await expectNoAxeViolations(container);
  });
});

describe('VmEditor', { timeout: 30_000 }, () => {
  it('labels every field and is axe clean, two levels included', async () => {
    const { container } = render(<VmEditor input={TWO.input} onChange={() => {}} />);
    expect(screen.getByLabelText('Row 1 PFN')).toHaveValue('10');
    expect(screen.getByLabelText('Directory row 2 index')).toHaveValue('15');
    await expectNoAxeViolations(container);
  });
});

describe('TranslationView', { timeout: 30_000 }, () => {
  it('renders the OSTEP array walk and steps to the end with the keyboard', async () => {
    const user = userEvent.setup();
    render(<TranslationView />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Address Translation' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('hit-rate')).toHaveTextContent('—');
    expect(screen.getByRole('heading', { name: /Access 1, step 1/ })).toBeInTheDocument();

    await act(async () => {
      await user.keyboard('{End}');
    });
    expect(screen.getByTestId('hit-rate')).toHaveTextContent('70%');
    expect(screen.getByTestId('mem-refs')).toHaveTextContent('13');
    expect(screen.getByTestId('accesses-done')).toHaveTextContent('10 / 10');
  });

  it('links a fault step to Page Replacement', async () => {
    const user = userEvent.setup();
    render(<TranslationView />);
    await user.selectOptions(screen.getByLabelText('Preset'), 'invalid-page');
    await user.click(screen.getByRole('button', { name: 'Load preset' }));

    const run = runVm(INVALID.input);
    const fault = run.events.findIndex((e) => e.kind === 'vm.fault');
    // Step to the fault with the arrow key.
    await act(async () => {
      for (let i = 0; i < fault; i += 1) await user.keyboard('{ArrowRight}');
    });
    const inspector = screen.getByRole('region', { name: 'Inspector' });
    expect(
      within(inspector).getByRole('link', { name: /Page Replacement/ }),
    ).toHaveAttribute('href', '/replacement');
  });

  it('runs an edited access list', async () => {
    const user = userEvent.setup();
    render(<TranslationView />);
    const box = screen.getByLabelText(/Virtual addresses, in order/);
    await user.clear(box);
    await user.type(box, '100, 100');
    await act(async () => {
      await user.keyboard('{End}');
    });
    // Focus is in the text box, so End stays there; step from the body instead.
    (document.activeElement as HTMLElement).blur();
    await act(async () => {
      await user.keyboard('{End}');
    });
    expect(screen.getByTestId('hit-rate')).toHaveTextContent('50%');
    expect(screen.getByTestId('accesses-done')).toHaveTextContent('2 / 2');
  });

  it('shows a schema message for an address too big for the VA', async () => {
    const user = userEvent.setup();
    render(<TranslationView />);
    const box = screen.getByLabelText(/Virtual addresses, in order/);
    await user.clear(box);
    await user.type(box, '300');
    expect(screen.getByText('Access 1: Address must be below 256')).toBeInTheDocument();
  });
});
