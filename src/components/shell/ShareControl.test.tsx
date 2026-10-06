import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ShareControl } from './ShareControl';

describe('ShareControl (G15)', () => {
  it('says the input is in the link and copies the address bar by default', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<ShareControl />);
    expect(screen.getByText('Saved in this link')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy link to this page' }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole('status')).toHaveTextContent('Link copied.');
  });

  it('uses the module link when given, and says when the input is too large', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ShareControl link={() => 'https://x.test/?s=abc'} />);
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copy link to this page' }));
    expect(writeText).toHaveBeenLastCalledWith('https://x.test/?s=abc');

    rerender(<ShareControl link={() => null} shareable={false} />);
    expect(screen.getByText('Too large for a link')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy link to this page' }));
    expect(screen.getByRole('status')).toHaveTextContent('too large for a link');
  });
});
