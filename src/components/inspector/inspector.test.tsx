import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { createRegistry } from '@/core/citations/registry';
import { expectNoAxeViolations } from '@/components/testing/axe';

import { CitationLink, citationPlace } from './CitationLink';
import { CitationsProvider } from './CitationsContext';
import { RulesPanel } from './RulesPanel';
import { StepInspector } from './StepInspector';

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

function withCitations(children: ReactNode) {
  return <CitationsProvider citations={registry}>{children}</CitationsProvider>;
}

describe('CitationLink', () => {
  it('names the chapter or the section', () => {
    expect(citationPlace(registry.get('ostep.7')!)).toBe('OSTEP ch. 7');
    expect(citationPlace(registry.get('osc10.8.6.3')!)).toBe('OSC 10e §8.6.3');
  });

  it('links an OSTEP chapter in a new tab and says so', () => {
    render(withCitations(<CitationLink id="ostep.7" />));
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'href',
      'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAccessibleName(
      'OSTEP ch. 7: Scheduling: Introduction (opens in a new tab)',
    );
  });

  it('cites OSC10 as text, with no link', () => {
    render(withCitations(<CitationLink id="osc10.8.6.3" />));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText("Banker's Algorithm")).toBeInTheDocument();
  });

  it('renders an unknown id as plain text, and has no provider by default', () => {
    render(<CitationLink id="ostep.7" />);
    expect(screen.getByText('Source: ostep.7')).toBeInTheDocument();
  });
});

describe('StepInspector', () => {
  it('shows the label, the detail and the citation', async () => {
    const { container } = render(
      withCitations(
        <StepInspector
          heading="This tick"
          event={{
            label: 'P2 preempts P1: its remaining 2 is shorter than 5.',
            detail: 'SRTF compares remaining time at every arrival.',
            citation: 'ostep.7',
          }}
        >
          <p>module extra</p>
        </StepInspector>,
      ),
    );
    const section = screen.getByRole('region', { name: 'This tick' });
    expect(section).toHaveTextContent('P2 preempts P1');
    expect(section).toHaveTextContent('SRTF compares');
    expect(section).toHaveTextContent('module extra');
    expect(screen.getByRole('link')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('says when there is no event yet', () => {
    render(<StepInspector event={undefined} />);
    expect(screen.getByText('Nothing has happened yet.')).toBeInTheDocument();
  });
});

describe('RulesPanel', () => {
  const rules = [
    { id: 'tie.arrival', text: 'Ties go to the earlier arrival, then the lower PID.' },
    {
      id: 'same.tick',
      text: 'A new arrival joins the queue before a preempted process.',
      detail: 'OSTEP and OSC differ here; this follows OSC.',
    },
  ];

  it('is collapsed by default and opens from the keyboard', async () => {
    const user = userEvent.setup();
    const { container } = render(<RulesPanel rules={rules} />);
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(screen.getByText('Rules used (2)')).toBeInTheDocument();

    // jsdom does not toggle <details> on Enter; a browser does. A click is the same toggle.
    await user.click(screen.getByText('Rules used (2)'));
    expect(details.open).toBe(true);
    expect(container.querySelectorAll('[data-rule]')).toHaveLength(2);
    expect(
      screen.getByText('OSTEP and OSC differ here; this follows OSC.'),
    ).toBeVisible();
    await expectNoAxeViolations(container);
  });

  it('says when a module has no special rules', () => {
    render(<RulesPanel rules={[]} defaultOpen />);
    expect(screen.getByText('No special rules.')).toBeInTheDocument();
  });
});
