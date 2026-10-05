import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { glossaryEntry } from '@/content/glossary';
import { expectNoAxeViolations } from '@/components/testing/axe';

import { Term } from './Term';

const tlb = glossaryEntry('tlb')!;

function Sentence() {
  return (
    <>
      <p>
        A hit in the <Term id="tlb" /> skips the walk to the{' '}
        <Term id="pte">page table entry</Term>.
      </p>
      <button type="button">Elsewhere</button>
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Term', () => {
  it('is a named button described by the short definition', () => {
    render(<Sentence />);
    const trigger = screen.getByRole('button', { name: 'TLB' });
    expect(trigger).toHaveAccessibleDescription(tlb.short);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'page table entry' })).toBeInTheDocument();
  });

  it('renders inside a <p> without a nesting warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Sentence />);
    expect(error).not.toHaveBeenCalled();
  });

  it('opens on tap, with the term, short and long definitions', async () => {
    const user = userEvent.setup();
    render(<Sentence />);
    const trigger = screen.getByRole('button', { name: 'TLB' });

    // A tap: no hover, and the press's focus does not open it before the click does.
    await user.pointer({ keys: '[TouchA]', target: trigger });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('dialog', { name: 'TLB' });
    expect(panel).toHaveTextContent(tlb.short);
    expect(panel).toHaveTextContent(tlb.long);
    expect(panel).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    // Focus handed back to the trigger does not reopen it.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on mouse hover without taking focus, and closes on leaving', async () => {
    const user = userEvent.setup();
    render(<Sentence />);
    const trigger = screen.getByRole('button', { name: 'TLB' });

    await user.hover(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.body).toHaveFocus();

    await user.unhover(trigger);
    // A grace period first, so the pointer can cross to the panel.
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  });

  it('stays open when a hovered term is clicked', async () => {
    const user = userEvent.setup();
    render(<Sentence />);
    const trigger = screen.getByRole('button', { name: 'TLB' });

    await user.hover(trigger);
    await user.click(trigger);
    await user.unhover(trigger);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens on keyboard focus, keeps focus on the term, and closes when focus moves on', async () => {
    const user = userEvent.setup();
    render(<Sentence />);
    const trigger = screen.getByRole('button', { name: 'TLB' });

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.tab();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'page table entry' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('has no axe violations, closed or open', async () => {
    const user = userEvent.setup();
    const { container } = render(<Sentence />);
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('button', { name: 'TLB' }));
    await expectNoAxeViolations(container);
  });
});
