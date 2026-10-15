import { EASING } from './useStepMotion';

/**
 * The VPN's ghost copy (docs/UIUX.md §7.2.3): on a TLB lookup, a copy of the virtual
 * address's VPN bits travels from the bit field to the page number the TLB is looking
 * up, and fades as it lands. It says where the TLB's key comes from: the address's high
 * bits, with the offset left behind.
 *
 * Called from `useStepMotion`, so it runs on forward steps only and never under reduced
 * motion, at speeds 4-5, on a step back or a jump (§6.1 rules 2, 3 and 5). The ghost is
 * a decoration over the page: `aria-hidden`, `inert`, never under the pointer, and
 * removed when its animation ends or is cancelled. It moves with `transform` and
 * `opacity` only (rule 7), and the landing spot, the "VPN n" chip, is the static frame
 * that says the same thing (rule 4).
 *
 * The source is every field of the element marked `data-vpn-source` except the offset:
 * the VPN for one level, the directory and table indexes for two. Nothing is drawn when
 * either end is not on screen (a phone tab, a hidden panel).
 */

/** Marks the virtual address's bit field, the ghost's source. */
export const VPN_SOURCE = 'data-vpn-source';
/** Marks the ghost itself, for tests. */
export const VPN_GHOST = 'data-vpn-ghost';

function union(rects: DOMRect[]): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, width: right - left, height: bottom - top };
}

export function flyVpnGhost(target: HTMLElement, duration: number): Animation | null {
  const doc = target.ownerDocument;
  const scope = target.closest('[data-workspace]') ?? doc;
  const rows = [...scope.querySelectorAll<HTMLElement>(`[${VPN_SOURCE}] [data-field]`)]
    .filter((field) => field.dataset.field !== 'offset')
    // Each field's row of bit cells (aria-hidden: the field's text says the same).
    .map((field) => field.querySelector<HTMLElement>(':scope > div[aria-hidden="true"]'))
    .filter((row): row is HTMLElement => row !== null);
  if (rows.length === 0) return null;
  const from = union(rows.map((row) => row.getBoundingClientRect()));
  const to = target.getBoundingClientRect();
  if (from.width === 0 || to.width === 0) return null;

  const ghost = doc.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute(VPN_GHOST, '');
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    display: 'flex',
    gap: '0.5rem',
    margin: '0',
    padding: '0',
    pointerEvents: 'none',
    zIndex: '60',
    background: 'var(--surface)',
    outline: '2px solid var(--accent)',
    borderRadius: '4px',
  } satisfies Partial<CSSStyleDeclaration>);
  ghost.append(...rows.map((row) => row.cloneNode(true)));
  doc.body.append(ghost);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = Math.min(1, Math.max(0.4, to.height / Math.max(1, from.height)));
  const animation = ghost.animate(
    [
      { transform: 'none', opacity: 0.9 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
    ],
    { duration, easing: EASING, fill: 'forwards' },
  );
  const remove = () => ghost.remove();
  animation.addEventListener('finish', remove);
  animation.addEventListener('cancel', remove);
  return animation;
}
