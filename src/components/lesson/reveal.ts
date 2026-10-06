/**
 * "Try it" and a checkpoint's "Show the next step" bring the module's picture into view
 * (docs/UIUX.md §7.3). The lesson does not know the module's layout, so it looks for, in
 * order:
 *
 * 1. an element marked `data-lesson-visual` inside the same workspace (a module may mark
 *    its main picture to be precise);
 * 2. the first visible element after the lesson in its column (in every module today
 *    that is the caption or the picture itself);
 * 3. the lesson's own column.
 *
 * The page scrolls only when the target's top is not already on screen, and the sticky
 * header is allowed for. Reduced motion jumps instead of gliding.
 */

/** Room left for the sticky site header above the target. */
const HEADER_ALLOWANCE = 88;

function visible(element: Element): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    !element.hidden &&
    (element.offsetWidth > 0 ||
      element.offsetHeight > 0 ||
      element.getClientRects().length > 0)
  );
}

export function findVisual(from: HTMLElement): HTMLElement | null {
  const scope = from.closest('[data-workspace]') ?? document;
  const marked = scope.querySelector<HTMLElement>('[data-lesson-visual]');
  if (marked) return marked;
  for (let next = from.nextElementSibling; next; next = next.nextElementSibling) {
    if (visible(next)) return next;
  }
  return from.parentElement;
}

export function revealVisual(from: HTMLElement | null): void {
  if (!from || typeof window === 'undefined') return;
  const target = findVisual(from);
  if (!target) return;
  const top = target.getBoundingClientRect().top;
  if (top >= HEADER_ALLOWANCE && top < window.innerHeight * 0.5) return;
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    window.scrollTo({
      top: Math.max(0, window.scrollY + top - HEADER_ALLOWANCE),
      behavior: reduced ? 'auto' : 'smooth',
    });
  } catch {
    // jsdom and very old engines: scrolling is a convenience, never required.
  }
}
