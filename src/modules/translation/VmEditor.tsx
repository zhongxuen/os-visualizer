'use client';

import { Plus, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/timeline/ui/Button';
import { LIMITS, type ValidationIssue, type VmInput } from '@/core/vm/config';
import { cn } from '@/lib/cn';

import { parseAccesses } from './adapters';
import {
  autoDirectory,
  draftKey,
  issuesAt,
  nextVpn,
  toDraft,
  type ConfigDraft,
  type DirectoryDraft,
  type PageDraft,
  type VmDraft,
} from './draft';
import { validateDraft } from './draft.schema';
import { INPUT, Messages, Panel, SelectField, TextField } from './fields';
import { humanIssues } from './messages';

/**
 * The input editors: the machine, the page table (and directory, for two levels) and the
 * access list. One working copy behind all three, because the checks cross them (a PFN
 * must fit the physical address bits, a VA the virtual ones). Remount (change `key`) to
 * load a different input.
 */

const PAGE_SIZES = Array.from({ length: 14 }, (_, i) => String(2 ** (i + 2)));
const TLB_SIZES = Array.from({ length: LIMITS.maxTlb + 1 }, (_, i) => String(i));

type Update = (next: VmDraft) => void;

interface PartProps {
  draft: VmDraft;
  issues: readonly ValidationIssue[];
  update: Update;
}

export function ConfigPanel({ draft, issues, update }: PartProps) {
  const at = (field: keyof ConfigDraft) =>
    issuesAt(issues, (p) => p[0] === 'config' && p[1] === field);
  const set = (patch: Partial<ConfigDraft>) => {
    const next = { ...draft, config: { ...draft.config, ...patch } };
    // Switching to two levels: give every valid page a page-table page.
    if (patch.levels === '2' && draft.directory.length === 0) {
      next.directory = autoDirectory(next) ?? [];
    }
    update(next);
  };
  const c = draft.config;
  const ptbrIssues = at('ptbr');
  return (
    <Panel title="Machine">
      <div className="grid grid-cols-2 gap-2">
        <TextField
          label={`VA bits (${LIMITS.minVaBits}–${LIMITS.maxVaBits})`}
          value={c.vaBits}
          onChange={(vaBits) => set({ vaBits })}
          messages={at('vaBits')}
        />
        <TextField
          label={`PA bits (${LIMITS.minPaBits}–${LIMITS.maxPaBits})`}
          value={c.paBits}
          onChange={(paBits) => set({ paBits })}
          messages={at('paBits')}
        />
        <span className="flex flex-col gap-1">
          <SelectField
            label="Page size (bytes)"
            value={c.pageSize}
            options={PAGE_SIZES.map((s) => ({ value: s, label: s }))}
            onChange={(pageSize) => set({ pageSize })}
          />
          <Messages id="vm-page-size-errors" messages={at('pageSize')} />
        </span>
        <SelectField
          label="Page table"
          value={c.levels}
          options={[
            { value: '1', label: 'Linear (1 level)' },
            { value: '2', label: 'Two levels' },
          ]}
          onChange={(levels) => set({ levels })}
        />
        <SelectField
          label="TLB entries"
          value={c.tlbSize}
          options={TLB_SIZES.map((s) => ({
            value: s,
            label: s === '0' ? '0 (no TLB)' : s,
          }))}
          onChange={(tlbSize) => set({ tlbSize })}
        />
      </div>
      <MoreOptions open={ptbrIssues.length > 0}>
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="TLB replacement"
            value={c.tlbPolicy}
            options={[
              { value: 'lru', label: 'LRU (least recently used)' },
              { value: 'fifo', label: 'FIFO (first in, first out)' },
            ]}
            onChange={(tlbPolicy) => set({ tlbPolicy })}
            className="col-span-2"
          />
          <TextField
            label={
              c.levels === '2'
                ? 'PDBR (page-directory base register)'
                : 'PTBR (page-table base register)'
            }
            value={c.ptbr}
            hint="Where the table starts in physical memory; decimal or 0x hex"
            onChange={(ptbr) => set({ ptbr })}
            messages={ptbrIssues}
            className="col-span-2"
          />
        </div>
      </MoreOptions>
    </Panel>
  );
}

/**
 * "More options" (G10): the settings a first run doesn't need. Opens by itself when one
 * of them has a problem, so a message is never hidden.
 */
function MoreOptions({ open, children }: { open: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (open && ref.current) ref.current.open = true;
  }, [open]);
  return (
    <details ref={ref} className="border-border border-t pt-2">
      <summary className="text-small cursor-pointer font-semibold">More options</summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

function RowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="px-2">
      <Trash2 aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

const CELL = 'px-1 py-1 align-top';

export function PageTableEditor({ draft, issues, update }: PartProps) {
  const captionId = useId();
  const setPage = (index: number, patch: Partial<PageDraft>) =>
    update({
      ...draft,
      pages: draft.pages.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });
  const setDir = (index: number, patch: Partial<DirectoryDraft>) =>
    update({
      ...draft,
      directory: draft.directory.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    });
  const vpn = nextVpn(draft.pages);
  const twoLevel = draft.config.levels === '2';
  const listIssues = issuesAt(issues, (p) => p[0] === 'pages' && p.length === 1);

  return (
    <Panel title="Page table">
      <p id={captionId} className="text-caption text-fg-muted">
        One row per mapped page. VPNs that are not listed are invalid.
      </p>
      <table aria-describedby={captionId} className="text-small w-full">
        <thead>
          <tr className="text-caption text-fg-muted text-left">
            <th scope="col" className={CELL}>
              VPN
            </th>
            <th scope="col" className={CELL}>
              Valid
            </th>
            <th scope="col" className={CELL}>
              PFN
            </th>
            <th scope="col" className={CELL}>
              Prot
            </th>
            <th scope="col" className={CELL}>
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {draft.pages.map((page, i) => {
            const at = (field: string) =>
              issuesAt(issues, (p) => p[0] === 'pages' && p[1] === i && p[2] === field);
            return (
              <tr key={page.key}>
                <td className={CELL}>
                  <TextField
                    label={`Row ${i + 1} VPN`}
                    hideLabel
                    value={page.vpn}
                    onChange={(v) => setPage(i, { vpn: v })}
                    messages={at('vpn')}
                  />
                </td>
                <td className={cn(CELL, 'pt-2')}>
                  <input
                    type="checkbox"
                    aria-label={`Row ${i + 1} valid`}
                    checked={page.valid}
                    onChange={(event) => setPage(i, { valid: event.target.checked })}
                    className="accent-accent size-4"
                  />
                </td>
                <td className={CELL}>
                  <TextField
                    label={`Row ${i + 1} PFN`}
                    hideLabel
                    value={page.pfn}
                    onChange={(v) => setPage(i, { pfn: v })}
                    messages={at('pfn')}
                  />
                </td>
                <td className={CELL}>
                  <SelectField
                    label={`Row ${i + 1} protection`}
                    hideLabel
                    value={page.prot}
                    options={[
                      { value: 'r', label: 'r' },
                      { value: 'rw', label: 'rw' },
                    ]}
                    onChange={(prot) => setPage(i, { prot })}
                  />
                </td>
                <td className={CELL}>
                  <RowButton
                    label={`Remove row ${i + 1}`}
                    onClick={() =>
                      update({ ...draft, pages: draft.pages.filter((_, j) => j !== i) })
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Messages id="vm-pages-errors" messages={listIssues} />
      <Button
        variant="secondary"
        size="sm"
        disabled={vpn === null}
        onClick={() => {
          if (vpn === null) return;
          update({
            ...draft,
            pages: [
              ...draft.pages,
              { key: draftKey(), vpn, valid: true, pfn: '0', prot: 'rw' },
            ],
          });
        }}
      >
        <Plus aria-hidden="true" className="size-3.5" />
        Add page
      </Button>

      {twoLevel ? (
        <div className="border-border flex flex-col gap-2 border-t pt-3">
          <h3 className="text-small font-semibold">Page directory</h3>
          <p className="text-caption text-fg-muted">
            Directory index → the frame holding that page-table page. Indexes not listed
            are invalid.
          </p>
          <ul aria-label="Directory entries" className="flex flex-col gap-2">
            {draft.directory.map((entry, i) => {
              const at = (field: string) =>
                issuesAt(
                  issues,
                  (p) => p[0] === 'directory' && p[1] === i && p[2] === field,
                );
              return (
                <li key={entry.key} className="flex items-start gap-2">
                  <TextField
                    label={`Directory row ${i + 1} index`}
                    value={entry.index}
                    onChange={(v) => setDir(i, { index: v })}
                    messages={at('index')}
                  />
                  <TextField
                    label={`Directory row ${i + 1} PFN`}
                    value={entry.pfn}
                    onChange={(v) => setDir(i, { pfn: v })}
                    messages={at('pfn')}
                  />
                  <span className="pt-5">
                    <RowButton
                      label={`Remove directory row ${i + 1}`}
                      onClick={() =>
                        update({
                          ...draft,
                          directory: draft.directory.filter((_, j) => j !== i),
                        })
                      }
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={draft.directory.length >= LIMITS.maxPages}
              onClick={() =>
                update({
                  ...draft,
                  directory: [
                    ...draft.directory,
                    { key: draftKey(), index: String(draft.directory.length), pfn: '0' },
                  ],
                })
              }
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Add directory entry
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const directory = autoDirectory(draft);
                if (directory) update({ ...draft, directory });
              }}
            >
              <Wand2 aria-hidden="true" className="size-3.5" />
              Fill automatically
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

export function AccessEditor({ draft, issues, update }: PartProps) {
  const id = useId();
  // Already in words with the access number in front (`humanIssues`).
  const unique = issuesAt(issues, (p) => p[0] === 'accesses');
  return (
    <Panel title="Accesses">
      <label htmlFor={id} className="text-caption text-fg-muted">
        Virtual addresses, in order (up to {LIMITS.maxAccesses})
      </label>
      <textarea
        id={id}
        rows={4}
        spellCheck={false}
        value={draft.accesses}
        aria-invalid={unique.length > 0 || undefined}
        aria-describedby={`${id}-hint${unique.length > 0 ? ` ${id}-err` : ''}`}
        onChange={(event) => update({ ...draft, accesses: event.target.value })}
        className={cn(
          INPUT,
          'w-full',
          unique.length > 0 && 'border-state-error border-2',
        )}
      />
      <p id={`${id}-hint`} className="text-caption text-fg-muted">
        Comma-separated, decimal or 0x hex. Add <span className="font-mono">w</span> for a
        write: <span className="font-mono">100, 104 w, 0x3F80</span>.
      </p>
      <AccessChips draft={draft} />
      <Messages id={`${id}-err`} messages={unique} />
    </Panel>
  );
}

/**
 * What the access list parses to, live under the box: one chip per access, so a typo
 * shows up where it is.
 */
function AccessChips({ draft }: { draft: VmDraft }) {
  const parsed = parseAccesses(draft.accesses);
  if (parsed.length === 0) return null;
  return (
    <ol aria-label="Accesses as read" className="flex flex-wrap gap-1">
      {parsed.map((access, i) => {
        const bad = Number.isNaN(access.va) || access.op === 'invalid';
        return (
          <li
            key={i}
            className={cn(
              'text-caption rounded border px-1.5 font-mono',
              bad ? 'border-state-error text-state-error font-semibold' : 'border-border',
            )}
          >
            {bad ? `${i + 1}: ?` : `${access.va}${access.op === 'write' ? ' w' : ''}`}
          </li>
        );
      })}
    </ol>
  );
}

export interface VmEditorProps {
  input: VmInput;
  onChange: (input: VmInput) => void;
}

export function VmEditor({ input, onChange }: VmEditorProps) {
  const [draft, setDraft] = useState<VmDraft>(() => toDraft(input));
  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  const update: Update = (next) => {
    setDraft(next);
    const result = validateDraft(next);
    if (result.ok) {
      setIssues([]);
      onChange(result.value);
    } else {
      setIssues(humanIssues(result.issues, next));
    }
  };

  const props = { draft, issues, update };
  return (
    <>
      <ConfigPanel {...props} />
      <PageTableEditor {...props} />
      <AccessEditor {...props} />
      {issues.length > 0 ? (
        <p role="status" className="text-caption text-state-error">
          The run shows the last valid input until these are fixed.
        </p>
      ) : null}
    </>
  );
}
