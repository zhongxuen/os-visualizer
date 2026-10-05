import { MessageSquareText, SlidersHorizontal, StepForward } from 'lucide-react';

/** Three panels: what a visit to any module looks like (§4.1). */
const STEPS = [
  {
    icon: SlidersHorizontal,
    title: 'Build a workload',
    body: 'Pick a preset from your textbook or type in your own processes, addresses or graph.',
  },
  {
    icon: StepForward,
    title: 'Step through',
    body: 'Move one tick at a time, forwards and back, or press play and watch it run.',
  },
  {
    icon: MessageSquareText,
    title: 'Read why',
    body: 'Every step says why it happened, which rule decided it, and where your book covers it.',
  },
] as const;

export function HowItWorks() {
  return (
    <ol className="mt-6 grid gap-4 md:grid-cols-3">
      {STEPS.map(({ icon: Icon, title, body }, i) => (
        <li key={title} className="panel p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="bg-surface-overlay text-accent flex size-9 items-center justify-center rounded-md"
            >
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <h3 className="text-lead font-semibold">
              <span className="num text-fg-muted mr-2">{i + 1}</span>
              {title}
            </h3>
          </div>
          <p className="text-small text-fg-secondary mt-3">{body}</p>
        </li>
      ))}
    </ol>
  );
}
