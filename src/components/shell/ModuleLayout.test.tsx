import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ModuleLayout } from './ModuleLayout';

function renderLayout(onModeChange = vi.fn()) {
  render(
    <ModuleLayout
      title="CPU Scheduling"
      intro="Watch the Gantt chart form."
      mode="walkthrough"
      onModeChange={onModeChange}
      inputs={<p>the inputs</p>}
      inspector={<p>the inspector</p>}
      timeline={<p>the timeline</p>}
    >
      <p>the chart</p>
    </ModuleLayout>,
  );
  return { onModeChange };
}

describe('ModuleLayout', () => {
  it('puts the title, intro and every region on the page, inside a skip-link target', () => {
    renderLayout();

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent(
      'CPU Scheduling',
    );
    expect(screen.getByText('Watch the Gantt chart form.')).toBeInTheDocument();

    for (const [region, text] of [
      ['Inputs', 'the inputs'],
      ['Visualisation', 'the chart'],
      ['Inspector', 'the inspector'],
      ['Playback', 'the timeline'],
    ]) {
      expect(screen.getByRole('region', { name: region })).toHaveTextContent(text!);
    }
  });

  it('carries the disclaimer, linking to /about', () => {
    renderLayout();
    const disclaimer = screen.getByRole('complementary', { name: 'Disclaimer' });
    expect(disclaimer).toHaveTextContent('Textbook algorithms, not a real kernel.');
    expect(within(disclaimer).getByRole('link')).toHaveAttribute('href', '/about');
  });

  it('switches mode with radio buttons, from the keyboard', async () => {
    const user = userEvent.setup();
    const { onModeChange } = renderLayout();

    const group = screen.getByRole('group', { name: 'Mode' });
    expect(within(group).getByRole('radio', { name: 'Walkthrough' })).toBeChecked();

    within(group).getByRole('radio', { name: 'Walkthrough' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onModeChange).toHaveBeenCalledWith('free');
  });
});
