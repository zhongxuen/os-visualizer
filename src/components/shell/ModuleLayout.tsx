'use client';

import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { DisclaimerBanner } from './DisclaimerBanner';

/**
 * The page every module renders into. Modules compose; they do not lay themselves out.
 *
 * Top to bottom: title and one-line intro, the mode switch, the disclaimer; then the
 * input panel, the visual area and the inspector (three columns at `lg`, stacked below
 * it, in that reading order); and the timeline pinned to the bottom of the viewport, so
 * the controls are in reach wherever the page is scrolled.
 *
 * The page's `<main id="main">` comes from here, which is where the skip link lands.
 */

export type ModuleMode = 'walkthrough' | 'free';

export const MODE_LABELS: Record<ModuleMode, string> = {
  walkthrough: 'Walkthrough',
  free: 'Free play',
};

export interface ModuleLayoutProps {
  title: string;
  intro: ReactNode;
  mode: ModuleMode;
  onModeChange: (mode: ModuleMode) => void;
  /** Editable inputs: the workload, the reference string, the graph. */
  inputs?: ReactNode;
  /** The visual area: Gantt chart, bit field, frame strip, graph. */
  children: ReactNode;
  /** What the current step means: the event, its reason and its citation. */
  inspector?: ReactNode;
  /** The playback bar, pinned to the bottom. */
  timeline?: ReactNode;
  className?: string;
}

function ModeSwitch({
  mode,
  onModeChange,
}: Pick<ModuleLayoutProps, 'mode' | 'onModeChange'>) {
  const name = useId();
  return (
    <fieldset className="border-border inline-flex rounded-md border p-0.5">
      <legend className="sr-only">Mode</legend>
      {(Object.keys(MODE_LABELS) as ModuleMode[]).map((value) => (
        <label
          key={value}
          className={cn(
            'min-h-target-floor text-small inline-flex cursor-pointer items-center rounded px-3 font-medium transition-colors',
            'has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
            mode === value
              ? 'bg-accent text-accent-ink'
              : 'text-fg-secondary hover:bg-surface-overlay hover:text-fg',
          )}
        >
          <input
            type="radio"
            name={name}
            value={value}
            checked={mode === value}
            onChange={() => onModeChange(value)}
            className="sr-only"
          />
          {MODE_LABELS[value]}
        </label>
      ))}
    </fieldset>
  );
}

export function ModuleLayout({
  title,
  intro,
  mode,
  onModeChange,
  inputs,
  children,
  inspector,
  timeline,
  className,
}: ModuleLayoutProps) {
  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-title font-bold tracking-tight">{title}</h1>
            <div className="text-fg-secondary text-lead mt-1 max-w-3xl">{intro}</div>
          </div>
          <ModeSwitch mode={mode} onModeChange={onModeChange} />
        </div>

        <DisclaimerBanner className="mt-4" />

        <div
          className={cn(
            'mt-6 grid gap-6',
            inputs && inspector && 'lg:grid-cols-[18rem_minmax(0,1fr)_20rem]',
            inputs && !inspector && 'lg:grid-cols-[18rem_minmax(0,1fr)]',
            !inputs && inspector && 'lg:grid-cols-[minmax(0,1fr)_20rem]',
          )}
        >
          {inputs ? (
            <section aria-label="Inputs" className="min-w-0">
              {inputs}
            </section>
          ) : null}
          <section aria-label="Visualisation" className="min-w-0">
            {children}
          </section>
          {inspector ? (
            <section aria-label="Inspector" className="min-w-0">
              {inspector}
            </section>
          ) : null}
        </div>
      </main>

      {timeline ? (
        <section
          aria-label="Playback"
          className="border-border bg-surface-raised sticky bottom-0 z-10 border-t"
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">{timeline}</div>
        </section>
      ) : null}
    </div>
  );
}
