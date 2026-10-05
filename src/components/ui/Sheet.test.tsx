import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Button } from './index';
import { Sheet, type SheetSide } from './Sheet';

/** jsdom has no `showModal()`, so this runs the non-modal fallback path. */

function Harness({ side }: { side?: SheetSide }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Menu</Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Menu"
        description="Modules and lessons"
        side={side}
      >
        <nav aria-label="Main">
          <a href="#start">Start here</a>
          <a href="#lessons">Lessons</a>
        </nav>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('is a named, described dialog that keeps its links mounted while closed', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="#start"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu' });
    expect(sheet).toHaveAccessibleDescription('Modules and lessons');
    expect(sheet).toContainElement(screen.getByRole('link', { name: 'Start here' }));
  });

  it('moves focus in, reaches its links by keyboard, and Escape returns focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Menu' });

    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toContainElement(
      document.activeElement as HTMLElement,
    );

    await user.tab();
    expect(screen.getByRole('link', { name: 'Start here' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes from its close button and returns focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Menu' });

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('is a bottom sheet on a phone, and a side sheet on its edge from sm up', async () => {
    const user = userEvent.setup();
    for (const side of ['left', 'right', 'bottom'] as const) {
      const { unmount } = render(<Harness side={side} />);
      await user.click(screen.getByRole('button', { name: 'Menu' }));
      const sheet = screen.getByRole('dialog');
      expect(sheet).toHaveClass('bottom-0');
      expect(sheet).toHaveAttribute('data-side', side);
      if (side === 'bottom') expect(sheet.className).not.toMatch(/sm:(left|right)-0/);
      else expect(sheet).toHaveClass(`sm:${side}-0`);
      unmount();
    }
  });
});
