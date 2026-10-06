'use client';

import { Wand2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/timeline/ui/Button';
import {
  generate,
  GENERATE_LIMITS,
  GENERATE_SCHEMA,
  WORKLOAD_NAMES,
  WORKLOADS,
  type GenerateOptions,
  type WorkloadKind,
} from '@/core/replace/generate';
import { formatRefString, LIMITS, type ReplInput } from '@/core/replace/input';
import { cn } from '@/lib/cn';

import { Disclosure, parseNumber, SelectField, TextField } from './fields';
import {
  generatorMessage,
  refMessages,
  refTokens,
  validRefString,
  type RefToken,
} from './messages';

/**
 * The inputs: type a reference string and pick the frame count; the generator waits
 * under "More options" (G10). The string keeps what you type and is read back as chips
 * underneath, one per reference, with each bad token marked and named in words (R5,
 * G11). Only a valid input leaves the panel. Remount (change `key`) to load a different
 * input.
 */

const FRAME_OPTIONS = Array.from({ length: LIMITS.maxFrames }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export const DEFAULT_GENERATOR: GenerateOptions = {
  kind: 'hotcold',
  length: 30,
  pages: 8,
  seed: 1,
};

export interface InputPanelProps {
  input: ReplInput;
  /** The generator's starting settings. */
  generator?: GenerateOptions;
  onChange: (input: ReplInput) => void;
  /** Called after a string is generated, for a status line. */
  onGenerated?: (options: GenerateOptions) => void;
}

/** Messages for the reference string, in words, each naming its position (G11). */
export function refStringMessages(text: string): string[] {
  return refMessages(refTokens(text));
}

/** The typed references as chips (R5): a page each, or the token that is not one. */
export function RefChips({ tokens }: { tokens: readonly RefToken[] }) {
  if (tokens.length === 0) return null;
  return (
    <ol aria-label="References as read" className="flex flex-wrap gap-1">
      {tokens.map((token, i) => (
        <li
          key={i}
          data-bad={token.problem ? '' : undefined}
          className={cn(
            'text-caption min-w-6 rounded border px-1 text-center font-mono',
            token.problem
              ? 'border-state-error text-state-error border-2 border-dashed font-semibold'
              : 'border-border bg-surface',
          )}
        >
          {token.problem ? (
            <>
              <span aria-hidden="true">!</span>
              {token.text}
              <span className="sr-only">, not a page</span>
            </>
          ) : (
            token.page
          )}
        </li>
      ))}
    </ol>
  );
}

export function InputPanel({
  input,
  generator = DEFAULT_GENERATOR,
  onChange,
  onGenerated,
}: InputPanelProps) {
  const [text, setText] = useState(formatRefString(input.refString));
  const [gen, setGen] = useState({
    kind: generator.kind,
    length: String(generator.length),
    pages: String(generator.pages),
    seed: String(generator.seed),
  });

  const tokens = refTokens(text);
  const messages = refMessages(tokens);

  const options = {
    kind: gen.kind,
    length: parseNumber(gen.length),
    pages: parseNumber(gen.pages),
    seed: parseNumber(gen.seed),
  };
  const genResult = GENERATE_SCHEMA.safeParse(options);
  const genMessages = (field: Exclude<keyof GenerateOptions, 'kind'>) =>
    !genResult.success && genResult.error.issues.some((i) => i.path[0] === field)
      ? [generatorMessage(field)]
      : [];

  return (
    <>
      <div className="flex flex-col gap-3">
        <TextField
          label={`Pages referenced (0–${LIMITS.maxPage}, up to ${LIMITS.maxRefs})`}
          value={text}
          multiline
          hint={`${tokens.length} ${tokens.length === 1 ? 'reference' : 'references'}. Separate with commas or spaces.`}
          messages={messages}
          onChange={(next) => {
            setText(next);
            const refString = validRefString(refTokens(next));
            if (refString) onChange({ ...input, refString });
          }}
        />
        <RefChips tokens={tokens} />
        <SelectField
          label="Frames"
          value={String(input.frames)}
          options={FRAME_OPTIONS}
          onChange={(frames) => onChange({ ...input, frames: Number(frames) })}
        />
      </div>
      <Disclosure summary="More options: generate a string">
        <SelectField<WorkloadKind>
          label="Workload"
          value={gen.kind}
          options={WORKLOADS.map((kind) => ({
            value: kind,
            label: WORKLOAD_NAMES[kind],
          }))}
          onChange={(kind) => setGen({ ...gen, kind })}
        />
        <div className="grid grid-cols-3 gap-2">
          <TextField
            label={`Length (≤${GENERATE_LIMITS.maxLength})`}
            value={gen.length}
            onChange={(length) => setGen({ ...gen, length })}
            messages={genMessages('length')}
          />
          <TextField
            label={`Pages (≤${GENERATE_LIMITS.maxPages})`}
            value={gen.pages}
            onChange={(pages) => setGen({ ...gen, pages })}
            messages={genMessages('pages')}
          />
          <TextField
            label="Seed"
            value={gen.seed}
            onChange={(seed) => setGen({ ...gen, seed })}
            messages={genMessages('seed')}
          />
        </div>
        <p className="text-caption text-fg-muted">
          {gen.kind === 'uniform'
            ? 'Every reference picks a page at random: no locality.'
            : gen.kind === 'hotcold'
              ? '80% of references go to the hottest 20% of pages.'
              : 'Pages 0 to N−1 in order, repeated: the seed is not used.'}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={!genResult.success}
          onClick={() => {
            if (!genResult.success) return;
            const refString = generate(genResult.data);
            setText(formatRefString(refString));
            onChange({ ...input, refString });
            onGenerated?.(genResult.data);
          }}
        >
          <Wand2 aria-hidden="true" className="size-4" />
          Generate
        </Button>
      </Disclosure>
    </>
  );
}
