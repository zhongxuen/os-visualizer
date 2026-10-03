import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/components/testing/axe';
import { compare, COMPARE_PRESETS } from '@/core/sched/compare';

import { CompareView, tableAt } from './CompareView';
import { PolicyColumns } from './PolicyColumns';

// Each view reads and writes `?s=`; start every test from a clean URL.
beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('tableAt', () => {
  it('at the end of every run equals the final compare table', () => {
    const preset = COMPARE_PRESETS[1]!;
    const result = compare(preset.workload, preset.policies);
    expect(tableAt(result.table, result.metrics)).toEqual(result.table);
  });
});

describe('CompareView', { timeout: 30_000 }, () => {
  it('draws one chart per policy and fills the table at the end', async () => {
    const user = userEvent.setup();
    render(<CompareView />);

    await user.selectOptions(screen.getByLabelText('Preset'), 'rr-sweep');
    await user.click(screen.getByRole('button', { name: 'Load preset' }));
    for (const q of [1, 2, 4, 8]) {
      expect(
        screen.getByRole('group', { name: `Gantt chart, RR q=${q}` }),
      ).toBeInTheDocument();
    }

    await act(async () => {
      await user.keyboard('{End}');
    });
    const table = screen.getByRole('table', { name: /Side by side/ });
    const row = within(table).getByRole('row', { name: /Context switches/ });
    const cells = within(row)
      .getAllByRole('cell')
      .map((c) => parseInt(c.textContent!, 10));
    expect(cells).toEqual([17, 10, 5, 3]);
    expect(screen.getByTestId('why-line')).toHaveTextContent(
      'RR q=1 has the lowest average response time',
    );
  });

  it('adds and removes policy columns within 2 to 4', async () => {
    const user = userEvent.setup();
    render(<CompareView />);
    expect(screen.getAllByRole('button', { name: /^Remove column/ })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Add a policy' }));
    expect(screen.getByRole('button', { name: 'Add a policy' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove column 4' }));
    await user.click(screen.getByRole('button', { name: 'Remove column 3' }));
    for (const button of screen.getAllByRole('button', { name: /^Remove column/ })) {
      expect(button).toBeDisabled();
    }
  });

  it('policy columns are axe clean', async () => {
    const preset = COMPARE_PRESETS[0]!;
    const { container } = render(
      <PolicyColumns
        policies={preset.policies}
        names={['FCFS', 'SJF', 'SRTF']}
        onChange={() => {}}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
