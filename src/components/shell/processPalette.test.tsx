import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProcessChip } from './ProcessChip';
import { PROCESS_PALETTE, processPatternId, processSlot } from './processPalette';
import { ProcessPatternDefs } from './ProcessPatternDefs';

describe('processSlot', () => {
  it('folds any PID into 0..9', () => {
    expect(processSlot(3)).toBe(3);
    expect(processSlot(13)).toBe(3);
    expect(processSlot(-1)).toBe(9);
    expect(processSlot(Number.NaN)).toBe(0);
  });
});

describe('PROCESS_PALETTE', () => {
  it('gives ten slots ten different patterns', () => {
    expect(PROCESS_PALETTE).toHaveLength(10);
    expect(new Set(PROCESS_PALETTE.map((s) => s.pattern)).size).toBe(10);
    expect(PROCESS_PALETTE.map((s) => s.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('has a CSS pattern rule for every slot in process.css', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/process.css'), 'utf8');
    for (const { slot, cssVar } of PROCESS_PALETTE) {
      expect(css).toContain(`.proc-fill[data-proc='${slot}']`);
      expect(css).toContain(`--proc-fill: var(${cssVar})`);
    }
  });
});

describe('ProcessPatternDefs', () => {
  it('defines one SVG pattern per slot, filled with the slot colour', () => {
    const { container } = render(
      <svg>
        <ProcessPatternDefs />
      </svg>,
    );
    const patterns = container.querySelectorAll('pattern');
    expect(patterns).toHaveLength(10);
    for (const { slot, cssVar, pattern } of PROCESS_PALETTE) {
      const el = container.querySelector(`#${processPatternId(slot)}`);
      expect(el?.getAttribute('data-pattern')).toBe(pattern);
      expect(el?.querySelector('rect')?.getAttribute('fill')).toBe(`var(${cssVar})`);
    }
  });
});

describe('ProcessChip', () => {
  it('always prints the PID as text, on its slot fill', () => {
    const { container } = render(<ProcessChip pid={12} detail="3 left" />);
    expect(screen.getByText('P12')).toBeInTheDocument();
    expect(screen.getByText('3 left')).toBeInTheDocument();
    expect(container.querySelector('.proc-fill')).toHaveAttribute('data-proc', '2');
  });
});
