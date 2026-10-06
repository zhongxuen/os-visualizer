'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { KeyboardLegend } from '@/components/timeline/KeyboardLegend';
import {
  isTypingTarget,
  matchWorkspaceKey,
  WORKSPACE_SHORTCUTS,
  type ModuleShortcut,
} from '@/components/timeline/keymap';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';

/**
 * The shortcuts sheet (docs/UIUX.md §4.2, G6): every key the current page answers to, in
 * a `Sheet`. Opened by `?`, by the header's keyboard button, by the transport's keyboard
 * button, or by anything that calls `requestShortcuts()`.
 *
 * Three groups: playback (`KeyboardLegend`, generated from `keymap.ts`), the workspace's
 * own keys (`WORKSPACE_SHORTCUTS`), and the current module's keys, which a module page
 * registers through `ModuleLayout`'s `shortcuts` prop (`useModuleShortcuts`). Every list
 * is checked for collisions by `keymap.test.ts` (B6).
 *
 * One sheet per page, mounted by the site header, so the module's keys and the open
 * state live in a small store here rather than in React context: the header sits
 * outside every module's tree.
 */

/** The "show keyboard shortcuts" action, as a window event. */
export const SHORTCUTS_EVENT = 'osv:shortcuts';

export function requestShortcuts(): void {
  window.dispatchEvent(new Event(SHORTCUTS_EVENT));
}

interface ShortcutsState {
  open: boolean;
  module: readonly ModuleShortcut[];
}

let state: ShortcutsState = { open: false, module: [] };
const listeners = new Set<() => void>();

function setState(next: Partial<ShortcutsState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const SERVER: ShortcutsState = { open: false, module: [] };

function useShortcutsState(): ShortcutsState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER,
  );
}

/** Whether the sheet is open, for the button that opens it (`aria-expanded`). */
export function useShortcutsOpen(): boolean {
  return useShortcutsState().open;
}

/**
 * Register the current page's module keys with the sheet, for as long as the caller is
 * mounted. `ModuleLayout` calls this with its `shortcuts` prop; a module never needs to.
 */
export function useModuleShortcuts(shortcuts: readonly ModuleShortcut[] | undefined) {
  useEffect(() => {
    if (!shortcuts?.length) return;
    setState({ module: shortcuts });
    return () => {
      if (state.module === shortcuts) setState({ module: [] });
    };
  }, [shortcuts]);
}

function Group({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h3 className="text-fg text-small font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function ShortcutsSheet() {
  const { open, module } = useShortcutsState();

  useEffect(() => {
    const show = () => setState({ open: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if (matchWorkspaceKey(event)?.type !== 'shortcuts') return;
      event.preventDefault();
      show();
    };
    window.addEventListener(SHORTCUTS_EVENT, show);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener(SHORTCUTS_EVENT, show);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <Sheet
      open={open}
      onClose={() => setState({ open: false })}
      title="Keyboard shortcuts"
      description="On every module page, while focus is not in a text field."
      side="right"
    >
      {open ? (
        <div className="flex flex-col gap-6">
          <Group title="Playback">
            <KeyboardLegend />
          </Group>
          <Group title="Workspace">
            <KeyboardLegend shortcuts={WORKSPACE_SHORTCUTS} />
          </Group>
          {module.length > 0 ? (
            <Group title="This module">
              <KeyboardLegend shortcuts={module} />
            </Group>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
