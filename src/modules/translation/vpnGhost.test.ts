import { afterEach, describe, expect, it, vi } from 'vitest';

import { flyVpnGhost, VPN_GHOST } from './vpnGhost';

/** A fake Web Animation: jsdom has no `element.animate`. */
class FakeAnimation extends EventTarget {
  constructor(
    public keyframes: Keyframe[],
    public options: KeyframeAnimationOptions,
  ) {
    super();
  }
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function field(id: string, bits: string, at: DOMRect): string {
  return `<div data-field="${id}"><p>${id}</p><div aria-hidden="true" data-at="${at.left},${at.top},${at.width},${at.height}">${[
    ...bits,
  ]
    .map((b) => `<span>${b}</span>`)
    .join('')}</div></div>`;
}

function mount(fields: string, chipAt: DOMRect | null) {
  const root = document.createElement('div');
  root.setAttribute('data-workspace', '');
  root.innerHTML = `<div data-vpn-source="">${fields}</div><p><span id="chip">VPN 6</span></p>`;
  document.body.append(root);
  const chip = root.querySelector<HTMLElement>('#chip')!;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this === chip) return chipAt ?? rect(0, 0, 0, 0);
    const at = this.getAttribute('data-at');
    if (!at) return rect(0, 0, 0, 0);
    const [l, t, w, h] = at.split(',').map(Number) as [number, number, number, number];
    return rect(l, t, w, h);
  });
  const animate = vi.fn(
    (keyframes: Keyframe[], options: KeyframeAnimationOptions) =>
      new FakeAnimation(keyframes, options) as unknown as Animation,
  );
  (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
  return { root, chip, animate };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  document.body.innerHTML = '';
});

describe('flyVpnGhost (§7.2.3)', () => {
  it('copies the VPN bits, not the offset, and flies them to the chip', () => {
    const { chip, animate } = mount(
      field('vpn', '0110', rect(100, 50, 80, 20)) +
        field('offset', '1111', rect(200, 50, 80, 20)),
      rect(130, 300, 60, 20),
    );
    const animation = flyVpnGhost(chip, 360);
    expect(animation).not.toBeNull();

    const ghost = document.querySelector<HTMLElement>(`[${VPN_GHOST}]`)!;
    expect(ghost).toHaveAttribute('aria-hidden', 'true');
    expect(ghost.inert).toBe(true);
    expect(ghost.textContent).toBe('0110');
    expect(ghost.style.left).toBe('100px');
    expect(ghost.style.top).toBe('50px');

    const [keyframes, options] = animate.mock.calls[0]!;
    expect(options).toMatchObject({ duration: 360 });
    // Centre to centre: (140, 60) to (160, 310). Only transform and opacity move.
    expect(keyframes.at(-1)).toEqual({
      transform: 'translate(20px, 250px) scale(1)',
      opacity: 0,
    });
    for (const frame of keyframes) {
      expect(Object.keys(frame).sort()).toEqual(['opacity', 'transform']);
    }

    // Gone when the animation ends (or is cancelled by a step back).
    animation!.dispatchEvent(new Event('cancel'));
    expect(document.querySelector(`[${VPN_GHOST}]`)).toBeNull();
  });

  it('carries both indexes for a two-level address', () => {
    const { chip } = mount(
      field('pd', '01', rect(100, 50, 40, 20)) +
        field('pt', '10', rect(150, 50, 40, 20)) +
        field('offset', '1111', rect(200, 50, 80, 20)),
      rect(130, 300, 60, 20),
    );
    flyVpnGhost(chip, 360);
    expect(document.querySelector(`[${VPN_GHOST}]`)!.textContent).toBe('0110');
  });

  it('draws nothing when an end is off screen (a hidden tab)', () => {
    const { chip, animate } = mount(field('vpn', '0110', rect(100, 50, 80, 20)), null);
    expect(flyVpnGhost(chip, 360)).toBeNull();
    expect(animate).not.toHaveBeenCalled();
    expect(document.querySelector(`[${VPN_GHOST}]`)).toBeNull();
  });
});
