import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PLAYBACK_SHORTCUTS, WORKSPACE_SHORTCUTS } from '@/components/timeline/keymap';

import { requestShortcuts, ShortcutsSheet } from './ShortcutsSheet';
import { KeyboardHelp } from './SiteHeaderMenus';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('ShortcutsSheet (G6)', () => {
  it('opens from the header button, lists playback and workspace keys, and closes', async () => {
    const user = userEvent.setup();
    render(
      <>
        <KeyboardHelp />
        <ShortcutsSheet />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Keyboard shortcuts' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    for (const shortcut of [...PLAYBACK_SHORTCUTS, ...WORKSPACE_SHORTCUTS]) {
      expect(sheet).toHaveTextContent(shortcut.action);
    }

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on ? and on the shared action, but not while typing', async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Name" />
        <KeyboardHelp />
        <ShortcutsSheet />
      </>,
    );
    const button = screen.getByRole('button', { name: 'Keyboard shortcuts' });
    await user.click(screen.getByRole('textbox', { name: 'Name' }));
    await user.keyboard('?');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    act(() => requestShortcuts());
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
