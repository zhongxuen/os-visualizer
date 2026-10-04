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
import {
  formatRefString,
  LIMITS,
  parseRefString,
  validateReplInput,
  type ReplInput,
} from '@/core/replace/input';

import { Panel, parseNumber, SelectField, TextField } from './fields';

/**
 * The inputs: type a reference string or generate one from a seed, and pick the frame
 * count. The string keeps what you type; only a valid input leaves the panel, and until
 * then the schema's messages show under the field. Remount (change `key`) to load a
 * different input.
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

/** Schema messages for the reference string, each naming its position. */
export function refStringMessages(input: unknown): string[] {
  const result = validateReplInput(input);
  if (result.ok) return [];
  return [
    ...new Set(
      result.issues
        .filter((i) => i.path[0] === 'refString')
        .map((i) =>
          typeof i.path[1] === 'number'
            ? `Reference ${i.path[1] + 1}: ${i.message}`
            : i.message,
        ),
    ),
  ];
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

  const parsed = { ...input, refString: parseRefString(text) };
  const messages = refStringMessages(parsed);

  const options = {
    kind: gen.kind,
    length: parseNumber(gen.length),
    pages: parseNumber(gen.pages),
    seed: parseNumber(gen.seed),
  };
  const genResult = GENERATE_SCHEMA.safeParse(options);
  const genMessages = (field: keyof GenerateOptions) =>
    genResult.success
      ? []
      : [
          ...new Set(
            genResult.error.issues
              .filter((i) => i.path[0] === field)
              .map((i) => i.message),
          ),
        ];

  return (
    <>
      <Panel title="Reference string">
        <TextField
          label={`Pages referenced (0–${LIMITS.maxPage}, up to ${LIMITS.maxRefs})`}
          value={text}
          multiline
          hint={`${parsed.refString.length} references. Separate with commas or spaces.`}
          messages={messages}
          onChange={(next) => {
            setText(next);
            const candidate = { ...input, refString: parseRefString(next) };
            if (validateReplInput(candidate).ok) onChange(candidate);
          }}
        />
        <SelectField
          label="Frames"
          value={String(input.frames)}
          options={FRAME_OPTIONS}
          onChange={(frames) => onChange({ ...input, frames: Number(frames) })}
        />
      </Panel>
      <Panel title="Generate a workload">
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
      </Panel>
    </>
  );
}
