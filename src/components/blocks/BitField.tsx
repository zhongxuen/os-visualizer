import { cn } from '@/lib/cn';

/**
 * An address as bits, split into labelled fields (VPN / offset, or PD index / PT index /
 * offset). Each field shows its bits, and its value in binary, hex and decimal; the field
 * the current step is about is highlighted, in words as well as with the accent border.
 *
 * Arithmetic is by division, not bitwise operators, so a field may sit above bit 31 (up
 * to 53-bit addresses, JavaScript's safe-integer limit).
 */

export interface BitFieldPart {
  /** Stable key, e.g. `'vpn'`; `highlight` matches it. */
  id: string;
  /** e.g. "VPN" or "PD index". */
  name: string;
  bits: number;
}

export interface BitFieldProps {
  /** The address. A non-negative integer below `2 ** width`. */
  value: number;
  /** Fields from the most significant down. Their bits must sum to the address width. */
  fields: readonly BitFieldPart[];
  /** The field id the current step reads. */
  highlight?: string;
  /** e.g. "Virtual address". */
  label?: string;
  className?: string;
}

export interface FieldValue extends BitFieldPart {
  /** Lowest bit of the field (0 is the least significant bit of the address). */
  low: number;
  value: number;
  binary: string;
  hex: string;
}

function hexDigits(bits: number): number {
  return Math.max(1, Math.ceil(bits / 4));
}

/** Split `value` into `fields`, most significant first. */
export function splitFields(
  value: number,
  fields: readonly BitFieldPart[],
): FieldValue[] {
  let low = fields.reduce((sum, field) => sum + field.bits, 0);
  return fields.map((field) => {
    low -= field.bits;
    const v = Math.floor(value / 2 ** low) % 2 ** field.bits;
    return {
      ...field,
      low,
      value: v,
      binary: v.toString(2).padStart(field.bits, '0'),
      hex: `0x${v.toString(16).toUpperCase().padStart(hexDigits(field.bits), '0')}`,
    };
  });
}

export function BitField({
  value,
  fields,
  highlight,
  label = 'Address',
  className,
}: BitFieldProps) {
  const width = fields.reduce((sum, field) => sum + field.bits, 0);
  const parts = splitFields(value, fields);
  const hex = `0x${value.toString(16).toUpperCase().padStart(hexDigits(width), '0')}`;

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <figcaption className="text-small">
        <span className="font-semibold">{label}</span>{' '}
        <span className="font-mono">{hex}</span>{' '}
        <span className="text-fg-muted">
          ({value} decimal, {width} bits)
        </span>
      </figcaption>
      <div className="flex flex-wrap gap-2">
        {parts.map((part) => {
          const active = part.id === highlight;
          const high = part.low + part.bits - 1;
          return (
            <div
              key={part.id}
              data-field={part.id}
              data-active={active || undefined}
              className={cn(
                'bg-surface-raised flex flex-col gap-1 rounded-md border p-2',
                active ? 'border-accent border-2' : 'border-border',
              )}
            >
              <p className="text-small font-semibold">
                {part.name}
                {active ? (
                  <span className="text-accent text-caption ml-1">(this step)</span>
                ) : null}
              </p>
              {/* The bits as cells: the binary line below says the same in text. */}
              <div aria-hidden="true" className="flex font-mono">
                {part.binary.split('').map((bit, i) => (
                  <span
                    key={i}
                    className={cn(
                      'border-border text-small w-5 border-y border-l text-center last:border-r',
                      bit === '1' ? 'bg-surface-overlay font-semibold' : 'text-fg-muted',
                    )}
                  >
                    {bit}
                  </span>
                ))}
              </div>
              <dl className="text-caption grid grid-cols-[auto_1fr] gap-x-2 font-mono">
                <dt className="text-fg-muted font-sans">Bits</dt>
                <dd>{high === part.low ? part.low : `${high}–${part.low}`}</dd>
                <dt className="text-fg-muted font-sans">Binary</dt>
                <dd>{part.binary}</dd>
                <dt className="text-fg-muted font-sans">Hex</dt>
                <dd>{part.hex}</dd>
                <dt className="text-fg-muted font-sans">Decimal</dt>
                <dd>{part.value}</dd>
              </dl>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
