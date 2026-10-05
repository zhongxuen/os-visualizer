import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createRegistry } from '@/core/citations/registry';
import { expectNoAxeViolations } from '@/components/testing/axe';

import { CitationLink, fullReference } from './CitationLink';
import { CitationsProvider } from './CitationsContext';

const registry = createRegistry([
  [
    {
      id: 'ostep.7',
      source: 'OSTEP',
      chapter: 7,
      title: 'Scheduling: Introduction',
      url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf',
    },
    {
      id: 'osc10.8.6.3',
      source: 'OSC10',
      chapter: 8,
      section: '8.6.3',
      title: "Banker's Algorithm",
    },
  ],
]);

function renderIn(id: string) {
  return render(
    <CitationsProvider citations={registry}>
      <p>
        <CitationLink id={id} />
      </p>
    </CitationsProvider>,
  );
}

describe('CitationLink full reference', () => {
  it('spells out the book, the edition and the place', () => {
    expect(fullReference(registry.get('osc10.8.6.3')!)).toMatchObject({
      authors: 'Abraham Silberschatz, Peter B. Galvin and Greg Gagne',
      title: 'Operating System Concepts',
      edition: '10th edition',
      place: '§8.6.3',
    });
    expect(fullReference(registry.get('ostep.7')!)).toMatchObject({
      title: 'Operating Systems: Three Easy Pieces',
      place: 'chapter 7',
    });
  });

  it('keeps the short form inline and shows the full reference in a popover', async () => {
    const user = userEvent.setup();
    renderIn('osc10.8.6.3');
    expect(screen.getByText('OSC 10e §8.6.3')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Full reference for OSC 10e §8.6.3' }),
    );
    const panel = screen.getByRole('dialog', { name: 'Full reference: OSC 10e §8.6.3' });
    expect(panel).toHaveTextContent(
      "Abraham Silberschatz, Peter B. Galvin and Greg Gagne, Operating System Concepts, 10th edition, §8.6.3: “Banker's Algorithm”.",
    );
    expect(panel).toHaveTextContent('Other editions number their sections differently.');
  });

  it('links an OSTEP chapter from the popover too', async () => {
    const user = userEvent.setup();
    renderIn('ostep.7');
    await user.click(
      screen.getByRole('button', { name: 'Full reference for OSTEP ch. 7' }),
    );
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf',
      'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf',
    ]);
    expect(links[1]).toHaveAccessibleName(
      'Read the chapter (free PDF) (opens in a new tab)',
    );
  });

  it('sits inside a <p> without a nesting warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIn('ostep.7');
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('has no axe violations with the popover open', async () => {
    const user = userEvent.setup();
    const { container } = renderIn('osc10.8.6.3');
    await user.click(screen.getByRole('button', { name: /Full reference for/ }));
    await expectNoAxeViolations(container);
  });
});
