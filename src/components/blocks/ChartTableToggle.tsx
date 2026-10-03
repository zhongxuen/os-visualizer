'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/components/timeline/ui/Button';
import { cn } from '@/lib/cn';

/**
 * Every chart's "Show as table" switch. The chart and the table carry the same data;
 * the table is the view a screen reader, a keyboard user or someone copying numbers
 * wants. Only the view on screen is mounted, so the hidden one costs nothing.
 *
 * The toggle sits above the view and keeps its place when the view changes, so focus
 * stays on it and the next press switches back.
 */

export type ChartView = 'chart' | 'table';

export interface ChartTableToggleProps {
  /** What the data is, e.g. "Gantt chart". Names the group and the button. */
  label: string;
  chart: ReactNode;
  table: ReactNode;
  defaultView?: ChartView;
  className?: string;
}

export function ChartTableToggle({
  label,
  chart,
  table,
  defaultView = 'chart',
  className,
}: ChartTableToggleProps) {
  const [view, setView] = useState<ChartView>(defaultView);
  const next: ChartView = view === 'chart' ? 'table' : 'chart';

  return (
    <div role="group" aria-label={label} className={cn('flex flex-col gap-2', className)}>
      <div className="flex justify-end">
        {/* No aria-label: the group names the data, and the name must match the text. */}
        <Button variant="secondary" size="sm" onClick={() => setView(next)}>
          {view === 'chart' ? 'Show as table' : 'Show as chart'}
        </Button>
      </div>
      {view === 'chart' ? chart : table}
    </div>
  );
}
