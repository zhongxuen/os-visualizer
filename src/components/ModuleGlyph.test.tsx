import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MODULES } from '@/modules/registry';

import { isGlyphSlug, ModuleGlyph } from './ModuleGlyph';

describe('ModuleGlyph', () => {
  it('has a picture for every registry module', () => {
    for (const m of MODULES) expect(isGlyphSlug(m.slug), m.slug).toBe(true);
  });

  it('is decorative, and every glyph has a part that moves', () => {
    for (const m of MODULES) {
      if (!isGlyphSlug(m.slug)) continue;
      const { container, unmount } = render(<ModuleGlyph slug={m.slug} />);
      const svg = container.querySelector('svg')!;
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg.querySelector('[data-anim]'), m.slug).not.toBeNull();
      unmount();
    }
  });
});
