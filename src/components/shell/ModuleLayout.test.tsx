import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlaybackStore } from '@/components/timeline/hooks/usePlayback';
import { PlaybackBar } from '@/components/timeline/PlaybackBar';
import type { PlaybackShortcut } from '@/components/timeline/keymap';
import { timelineFrom } from '@/core/sim/playback';
import type { SimResult } from '@/core/sim/result';

import { nextModuleAfter } from './EndOfRunCard';
import { ModuleLayout, type ModuleLayoutProps, type ModuleMode } from './ModuleLayout';
import { sharedPrefsStore } from './prefs';
import { ShortcutsSheet } from './ShortcutsSheet';
import { STORAGE_KEY } from './themeScript';

vi.mock('next/navigation', () => ({ usePathname: () => '/scheduling' }));

const RUN: SimResult = {
  events: [
    { at: 0, phase: 0 },
    { at: 1000, phase: 0 },
    { at: 2000, phase: 1 },
  ],
  phases: [
    { id: 'p0', index: 0, title: 'First', description: 'One', startMs: 0, endMs: 2000 },
    {
      id: 'p1',
      index: 1,
      title: 'Second',
      description: 'Two',
      startMs: 2000,
      endMs: 3000,
    },
  ],
  durationMs: 3000,
} as unknown as SimResult;

function Harness({
  initialMode = 'walkthrough',
  onModeChange,
  ...props
}: Partial<ModuleLayoutProps> & { initialMode?: ModuleMode }) {
  const [mode, setMode] = useState<ModuleMode>(initialMode);
  return (
    <ModuleLayout
      title="CPU Scheduling"
      intro="Watch the Gantt chart form."
      mode={mode}
      onModeChange={(next) => {
        setMode(next);
        onModeChange?.(next);
      }}
      inputs={
        <label>
          Burst <input type="text" />
        </label>
      }
      inspector={<p>the inspector</p>}
      timeline={<p>the timeline</p>}
      {...props}
    >
      <p>the chart</p>
    </ModuleLayout>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('ModuleLayout', () => {
  it('puts the title, intro and every region on the page, inside a skip-link target', () => {
    render(<Harness />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent(
      'CPU Scheduling',
    );
    expect(screen.getByText('Watch the Gantt chart form.')).toBeInTheDocument();

    for (const [region, text] of [
      ['Setup', 'Burst'],
      ['Visualisation', 'the chart'],
      ['Inspector', 'the inspector'],
      ['Playback', 'the timeline'],
    ]) {
      expect(screen.getByRole('region', { name: region })).toHaveTextContent(text!);
    }
  });

  it('carries a one-line honesty note linking to /about#model, not a banner (G8)', () => {
    render(<Harness />);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByText(/Textbook model, not a real kernel/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'What that means' })).toHaveAttribute(
      'href',
      '/about#model',
    );
  });

  it('names the modes Guided and Sandbox, says what each is, and switches from the keyboard (G12)', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<Harness onModeChange={onModeChange} />);

    const group = screen.getByRole('group', { name: 'Mode' });
    expect(within(group).getByRole('radio', { name: 'Guided' })).toBeChecked();
    expect(group).toHaveAccessibleDescription(/short lesson/);

    within(group).getByRole('radio', { name: 'Guided' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onModeChange).toHaveBeenLastCalledWith('free');
    expect(group).toHaveAccessibleDescription(/Build your own input/);
  });

  it('opens Guided on the first visit and remembers the mode after that (G1)', async () => {
    const user = userEvent.setup();
    const first = render(<Harness initialMode="free" />);
    // First visit: Guided, and the visit is recorded.
    expect(screen.getByRole('radio', { name: 'Guided' })).toBeChecked();
    expect(sharedPrefsStore().getSnapshot().moduleModes).toEqual({
      scheduling: 'walkthrough',
    });

    await user.click(screen.getByRole('radio', { name: 'Sandbox' }));
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).prefs.moduleModes,
    ).toEqual({ scheduling: 'free' });
    first.unmount();

    // Next visit: the module opens where it was left.
    render(<Harness initialMode="walkthrough" />);
    expect(screen.getByRole('radio', { name: 'Sandbox' })).toBeChecked();
  });

  it('collapses the Setup column with the Focus mode button and with F', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Focus mode' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Setup' })).toHaveClass('lg:hidden');

    await user.keyboard('f');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    // F in a text field is a letter, not a shortcut.
    await user.click(screen.getByRole('textbox', { name: 'Burst' }));
    await user.keyboard('f');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens Setup as a drawer on a tablet, closing on Escape back to its button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Setup' });
    const setup = screen.getByRole('region', { name: 'Setup' });
    expect(button).toHaveAttribute('aria-controls', setup.id);
    expect(setup).toHaveClass('sm:max-lg:hidden');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(setup).not.toHaveClass('sm:max-lg:hidden');
    expect(setup).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('has Setup / Watch / Results tabs for a phone, Watch first, moved with the arrows', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const tabs = within(screen.getByRole('tablist', { name: 'Workspace' }));
    expect(tabs.getByRole('tab', { name: 'Watch' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Setup' })).toHaveClass('max-sm:hidden');

    tabs.getByRole('tab', { name: 'Watch' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(tabs.getByRole('tab', { name: 'Setup' })).toHaveFocus();
    expect(tabs.getByRole('tab', { name: 'Setup' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Setup' })).not.toHaveClass(
      'max-sm:hidden',
    );
    // The transport is pinned only on Watch.
    expect(screen.getByRole('region', { name: 'Playback' })).not.toHaveClass(
      'max-sm:sticky',
    );
  });

  it('switches the phone to Watch when Play is pressed, and shows the end-of-run card at the end', () => {
    const store = createPlaybackStore(timelineFrom(RUN));
    render(
      <Harness
        timeline={<PlaybackBar store={store} phases={RUN.phases} unit="tick" />}
        endOfRun={{ result: 'Average waiting 7 ticks.' }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Setup' }));
    expect(screen.getByRole('tab', { name: 'Setup' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    act(() => store.getState().play());
    expect(screen.getByRole('tab', { name: 'Watch' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByText('End of the run')).toBeNull();

    act(() => store.getState().jumpTo('end'));
    const card = screen.getByRole('region', { name: 'End of the run' });
    expect(card).toHaveTextContent('Average waiting 7 ticks.');
    expect(within(card).getByRole('link', { name: /Next: Compare/ })).toHaveAttribute(
      'href',
      '/compare',
    );

    fireEvent.click(within(card).getByRole('button', { name: 'Play again' }));
    expect(store.getState().status).toBe('playing');
  });

  it('offers "Try this next" from the module', () => {
    const store = createPlaybackStore(timelineFrom(RUN));
    const onSelect = vi.fn();
    render(
      <Harness
        timeline={<PlaybackBar store={store} phases={RUN.phases} unit="tick" />}
        endOfRun={{ tryNext: { label: 'SJF on the same workload', onSelect } }}
      />,
    );
    act(() => store.getState().jumpTo('end'));
    fireEvent.click(screen.getByRole('button', { name: 'SJF on the same workload' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('hides the transport below desktop while a text field has focus (B11)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const playback = screen.getByRole('region', { name: 'Playback' });
    expect(playback).not.toHaveClass('max-lg:hidden');
    await user.click(screen.getByRole('textbox', { name: 'Burst' }));
    expect(playback).toHaveClass('max-lg:hidden');
    await user.click(document.body);
    expect(playback).not.toHaveClass('max-lg:hidden');
  });

  it('says the input is saved in the link, and lists module keys in the shortcuts sheet', async () => {
    const user = userEvent.setup();
    const keys: PlaybackShortcut[] = [
      { chords: [['A'], ['B']], action: 'Run thread A or B' },
    ];
    render(
      <>
        <ShortcutsSheet />
        <Harness shortcuts={keys} />
      </>,
    );
    expect(screen.getByText('Saved in this link')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy link to this page' }),
    ).toBeInTheDocument();

    await user.keyboard('?');
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(sheet).toHaveTextContent('Play or pause');
    expect(sheet).toHaveTextContent('Focus mode');
    expect(sheet).toHaveTextContent('Run thread A or B');
  });
});

describe('nextModuleAfter', () => {
  it('follows the learning order and ends at the learning path', () => {
    expect(nextModuleAfter('scheduling')).toEqual({ href: '/compare', title: 'Compare' });
    expect(nextModuleAfter('replacement')?.href).toBe('/deadlock');
    expect(nextModuleAfter('deadlock')).toBeNull();
    expect(nextModuleAfter('sync')).toBeNull();
    expect(nextModuleAfter(undefined)).toBeNull();
  });
});
