'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/timeline/ui/Button';
import {
  pageTableSizes,
  SIZING_LIMITS,
  SIZING_SCHEMA,
  type SizingInput,
} from '@/core/vm/sizing';

import { draftKey, issuesAt } from './draft';
import { Messages, parseNumber, TextField } from './fields';

/**
 * Page-table size calculator (OSTEP §20.3): how big a linear table is for an address
 * space, how big a two-level table is when only some regions are used, and the extra
 * memory reference per TLB miss that pays for the saving. Has its own inputs, so it can
 * be pointed at a 32-bit address space the simulator above can't run.
 */

interface RegionDraft {
  key: number;
  name: string;
  start: string;
  pages: string;
}

interface SizingDraft {
  vaBits: string;
  pageSize: string;
  regions: RegionDraft[];
}

function toDraft(input: SizingInput): SizingDraft {
  return {
    vaBits: String(input.vaBits),
    pageSize: String(input.pageSize),
    regions: input.regions.map((r) => ({
      key: draftKey(),
      name: r.name,
      start: String(r.start),
      pages: String(r.pages),
    })),
  };
}

function fromDraft(draft: SizingDraft): unknown {
  return {
    vaBits: parseNumber(draft.vaBits),
    pageSize: parseNumber(draft.pageSize),
    regions: draft.regions.map((r) => ({
      name: r.name,
      start: parseNumber(r.start),
      pages: parseNumber(r.pages),
    })),
  };
}

/** `4194304` → `4,194,304 bytes (4 MB)`. */
export function formatBytes(n: number): string {
  const exact = `${Math.abs(n).toLocaleString('en-US')} ${Math.abs(n) === 1 ? 'byte' : 'bytes'}`;
  const sign = n < 0 ? '−' : '';
  const units = [
    [2 ** 30, 'GB'],
    [2 ** 20, 'MB'],
    [2 ** 10, 'KB'],
  ] as const;
  for (const [size, unit] of units) {
    if (Math.abs(n) >= size) {
      const v = Math.round((Math.abs(n) / size) * 10) / 10;
      return `${sign}${exact} (${v} ${unit})`;
    }
  }
  return `${sign}${exact}`;
}

export interface SizingPanelProps {
  sizing: SizingInput;
  onChange: (sizing: SizingInput) => void;
  /** The simulator's own address space and used pages, for "Use the page table". */
  fromTable: SizingInput;
}

export function SizingPanel({ sizing, onChange, fromTable }: SizingPanelProps) {
  const [draft, setDraft] = useState<SizingDraft>(() => toDraft(sizing));
  const [issues, setIssues] = useState<{ path: (string | number)[]; message: string }[]>(
    [],
  );

  const update = (next: SizingDraft) => {
    setDraft(next);
    const parsed = SIZING_SCHEMA.safeParse(fromDraft(next));
    if (parsed.success) {
      setIssues([]);
      onChange(parsed.data);
    } else {
      setIssues(
        parsed.error.issues.map((i) => ({
          path: i.path.map((p) => (typeof p === 'number' ? p : String(p))),
          message: i.message,
        })),
      );
    }
  };

  const setRegion = (index: number, patch: Partial<RegionDraft>) =>
    update({
      ...draft,
      regions: draft.regions.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });

  const r = pageTableSizes(sizing);
  const at = (field: string) => issuesAt(issues, (p) => p[0] === field && p.length === 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(2,10rem)_1fr]">
        <TextField
          label={`VA bits (${SIZING_LIMITS.minVaBits}–${SIZING_LIMITS.maxVaBits})`}
          value={draft.vaBits}
          onChange={(vaBits) => update({ ...draft, vaBits })}
          messages={at('vaBits')}
        />
        <TextField
          label="Page size (bytes)"
          value={draft.pageSize}
          onChange={(pageSize) => update({ ...draft, pageSize })}
          messages={at('pageSize')}
        />
        <span className="col-span-2 flex items-end sm:col-span-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = toDraft(fromTable);
              setDraft(next);
              setIssues([]);
              onChange(fromTable);
            }}
          >
            Use the page table above
          </Button>
        </span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small mb-1 font-semibold">
          Regions in use (as pages)
        </legend>
        <ul aria-label="Regions" className="flex flex-col gap-2">
          {draft.regions.map((region, i) => {
            const rAt = (field: string) =>
              issuesAt(issues, (p) => p[0] === 'regions' && p[1] === i && p[2] === field);
            return (
              <li key={region.key} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <TextField
                  label={`Region ${i + 1} name`}
                  value={region.name}
                  onChange={(name) => setRegion(i, { name })}
                  messages={rAt('name')}
                />
                <TextField
                  label={`Region ${i + 1} first page`}
                  value={region.start}
                  onChange={(start) => setRegion(i, { start })}
                  messages={rAt('start')}
                />
                <TextField
                  label={`Region ${i + 1} pages`}
                  value={region.pages}
                  onChange={(pages) => setRegion(i, { pages })}
                  messages={rAt('pages')}
                />
                <span className="pt-5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    onClick={() =>
                      update({
                        ...draft,
                        regions: draft.regions.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">Remove region {i + 1}</span>
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
        <Messages
          id="sizing-region-errors"
          messages={issuesAt(issues, (p) => p[0] === 'regions' && p.length === 1)}
        />
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={draft.regions.length >= SIZING_LIMITS.maxRegions}
            onClick={() =>
              update({
                ...draft,
                regions: [
                  ...draft.regions,
                  {
                    key: draftKey(),
                    name: `region ${draft.regions.length + 1}`,
                    start: '0',
                    pages: '1',
                  },
                ],
              })
            }
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Add region
          </Button>
        </div>
      </fieldset>

      {issues.length > 0 ? (
        <p role="status" className="text-caption text-state-error">
          The sizes below are for the last valid input until these are fixed.
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Page-table sizes">
        <div className="border-border rounded-md border px-3 py-2">
          <dt className="text-caption text-fg-muted">Linear table</dt>
          <dd className="font-mono" data-testid="sizing-linear">
            {formatBytes(r.linearBytes)}
          </dd>
          <dd className="text-caption text-fg-muted">
            2^{r.vpnBits} entries × 4 bytes, used or not
          </dd>
        </div>
        <div className="border-border rounded-md border px-3 py-2">
          <dt className="text-caption text-fg-muted">Two-level table</dt>
          <dd className="font-mono" data-testid="sizing-two-level">
            {formatBytes(r.twoLevelBytes)}
          </dd>
          <dd className="text-caption text-fg-muted">
            directory {formatBytes(r.directoryBytes)} + {r.tablePages} of{' '}
            {r.tablePagesTotal} page-table pages
          </dd>
        </div>
        <div className="border-border rounded-md border px-3 py-2">
          <dt className="text-caption text-fg-muted">Saving</dt>
          <dd className="font-mono" data-testid="sizing-saving">
            {formatBytes(r.savingBytes)}
          </dd>
          <dd className="text-caption text-fg-muted">
            {r.usedPages.toLocaleString('en-US')} of{' '}
            {r.linearEntries.toLocaleString('en-US')} virtual pages in use
          </dd>
        </div>
        <div className="border-border rounded-md border px-3 py-2">
          <dt className="text-caption text-fg-muted">Cost per TLB miss</dt>
          <dd className="font-mono">
            {r.refsPerMiss.linear} → {r.refsPerMiss.twoLevel} page-table reads
          </dd>
          <dd className="text-caption text-fg-muted">
            The directory read is the extra memory reference two levels pay.
          </dd>
        </div>
      </dl>
      <p className="text-caption text-fg-muted">
        VPN = {r.pdIndexBits} directory-index bits + {r.ptIndexBits} table-index bits (
        {r.ptesPerPage} PTEs per page).
        {r.directoryFitsInPage
          ? ''
          : ' The directory itself is bigger than a page, so a real system would add a third level.'}
      </p>
    </div>
  );
}
