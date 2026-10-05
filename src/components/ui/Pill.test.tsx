import { render, screen } from '@testing-library/react';
import { Check } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { Kbd, Pill, Popover, Switch } from './index';

describe('Pill', () => {
  it('says its status in words, with the icon hidden', () => {
    const { container } = render(
      <Pill tone="ok" icon={<Check />}>
        Ready
      </Pill>,
    );
    const pill = screen.getByText('Ready');
    expect(pill).toHaveAttribute('data-tone', 'ok');
    expect(pill).toHaveClass('text-state-ok', 'border-state-ok');
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });

  it('defaults to neutral and is exempt from dimming', () => {
    render(<Pill>Coming soon</Pill>);
    const pill = screen.getByText('Coming soon');
    expect(pill).toHaveAttribute('data-tone', 'neutral');
    expect(pill).toHaveAttribute('data-no-dim');
  });
});

describe('ui barrel', () => {
  it('re-exports the vendored timeline primitives', () => {
    expect([Kbd, Popover, Switch].every((c) => typeof c === 'function')).toBe(true);
  });
});
