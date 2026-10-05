import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MODULES } from '@/modules/registry';

import { HeroGantt, heroCss } from './HeroGantt';
import { heroRun } from './heroRun';
import { LearningOrder } from './LearningOrder';
import { ModuleGrid } from './ModuleGrid';

describe('heroRun', () => {
  it('is the textbook Round Robin q = 2 run on three processes', () => {
    const run = heroRun();
    expect(run.ticks).toBe(12);
    expect(run.segments.map((s) => `${s.pid}:${s.start}-${s.end}`)).toEqual([
      'P1:0-2',
      'P2:2-4',
      'P3:4-6',
      'P1:6-8',
      'P2:8-9',
      'P3:9-11',
      'P1:11-12',
    ]);
  });

  it('says why each process got the CPU', () => {
    const captions = heroRun().segments.map((s) => s.caption);
    expect(captions[0]).toBe('P1 runs: the only ready process');
    expect(captions[1]).toBe('P2 runs: quantum expired for P1');
    expect(captions[5]).toBe('P3 runs: P2 finished');
    expect(heroRun().doneCaption).toBe(
      'All three done at t = 12; average wait 5.67 ticks',
    );
  });
});

describe('heroCss', () => {
  const css = heroCss(heroRun());

  it('pauses on hover, focus and the Pause checkbox', () => {
    expect(css).toContain(
      '.hero-gantt:is(:hover,:focus-within,:has(.hg-pause:checked)) .hg-anim{animation-play-state:paused}',
    );
  });

  it('draws each bar over its own ticks and rests on the finished chart', () => {
    // P2's first stretch, ticks 2-4 of 12, inside the first 75% of the loop.
    expect(css).toContain(
      '@keyframes hg-bar-1{0%,12.5%{transform:scaleX(0)}25%,100%{transform:scaleX(1)}}',
    );
    // The last keyframe of every caption hides it, except the summary's, which shows.
    expect(css).toContain('@keyframes hg-done{0%{opacity:0}75%,100%{opacity:1}}');
    expect(css).not.toMatch(/Math|random/);
  });
});

describe('HeroGantt', () => {
  it('describes the run to screen readers and offers a pause control', () => {
    render(<HeroGantt />);
    expect(
      screen.getByRole('img', {
        name: /Round Robin with a quantum of 2 ticks: P1 from 0 to 2/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Pause' })).not.toBeChecked();
    expect(
      screen.getByText(/t = 2 to 4: P2 runs: quantum expired for P1/),
    ).toBeInTheDocument();
  });
});

describe('ModuleGrid', () => {
  it('links each ready card from its heading only, with the title as the name', () => {
    render(<ModuleGrid />);
    for (const m of MODULES) {
      const heading = screen.getByRole('heading', { level: 3, name: m.title });
      const card = heading.closest('li')!;
      const links = within(card).queryAllByRole('link');
      if (m.status === 'ready') {
        expect(links).toHaveLength(1);
        expect(links[0]).toHaveAccessibleName(m.title);
        expect(links[0]).toHaveAttribute('href', m.route);
        expect(heading).toContainElement(links[0]!);
        expect(within(card).getByText('Ready')).toBeInTheDocument();
      } else {
        expect(links).toHaveLength(0);
        expect(within(card).getByText('Coming later')).toBeInTheDocument();
      }
      expect(card).not.toHaveTextContent(/phase 2/i);
      expect(card.querySelector('svg[aria-hidden="true"][data-glyph]')).not.toBeNull();
    }
  });
});

describe('LearningOrder', () => {
  it('starts with scheduling and ends with deadlock', () => {
    render(<LearningOrder />);
    const steps = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveTextContent('Step 1: CPU Scheduling');
    expect(steps[4]).toHaveTextContent('Step 5: Deadlock');
  });
});
