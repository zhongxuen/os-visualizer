'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { glossaryEntry, type GlossaryId } from '@/content/glossary';
import { Popover } from '@/components/ui';

/**
 * A glossary term in running text (docs/UIUX.md §2.2 G2): a dotted underline, and the
 * definition in a popover.
 *
 * Built on `Popover`, which owns the panel, light dismiss, Escape and focus. This adds the
 * three ways in:
 *
 * - **Tap or click** toggles it, and focus moves into the panel, as any popover does.
 * - **Hover** (a mouse only; touch has no hover) opens it without moving focus, and
 *   leaving closes it after a short grace period, so the pointer can cross the gap to the
 *   panel. Clicking a hovered term pins it open instead of closing it.
 * - **Keyboard focus** opens it without moving focus, so Tab goes on to the next control,
 *   and moving focus away closes it. Focus from a press doesn't count (the click
 *   decides), and nor does focus coming back to the trigger as the panel closes.
 *
 * A screen reader gets the term as the button's name and the short definition as its
 * description, so it never has to open the panel.
 *
 * Every id used in the source is checked against the glossary by
 * `tests/glossary.test.ts`; at runtime an unknown id renders the text plainly.
 */

type OpenedBy = 'pointer' | 'hover' | 'focus';

const HOVER_CLOSE_MS = 150;

export interface TermProps {
  id: GlossaryId;
  /** The text in the sentence. Defaults to the glossary term. */
  children?: ReactNode;
}

export function Term({ id, children }: TermProps) {
  const entry = glossaryEntry(id);
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const openedBy = useRef<OpenedBy>('pointer');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpenAtPointerDown = useRef(false);
  // From pointerdown to the click: the focus a press causes is not a keyboard visit. On
  // touch that focus arrives after pointerup, with the compatibility mouse events.
  const pressing = useRef(false);
  // True from a close until it has committed: Popover hands focus back to the trigger in
  // that commit, and that focus must not reopen the panel.
  const closing = useRef(false);

  // Popover focuses `initialFocusRef.current ?? panel` on open. Hover and focus opens keep
  // focus where it is (the focused element, refocused, is a no-op); a click goes in.
  const keepFocus = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        if (openedBy.current === 'pointer') return null;
        const active = document.activeElement;
        return active instanceof HTMLElement ? active : null;
      },
    }),
    [],
  );

  // Popover's effects run before this one (children first), so its focus hand-back has
  // already happened by now.
  useEffect(() => {
    if (!open) closing.current = false;
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  if (!entry) return <>{children ?? id}</>;

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const show = (by: OpenedBy) => {
    cancelClose();
    if (open) return;
    openedBy.current = by;
    setOpen(true);
  };

  const hide = () => {
    cancelClose();
    closing.current = true;
    setOpen(false);
  };

  return (
    <span
      className="inline"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') show('hover');
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse' || openedBy.current !== 'hover') return;
        cancelClose();
        closeTimer.current = setTimeout(hide, HOVER_CLOSE_MS);
      }}
      onPointerDownCapture={() => {
        pressing.current = true;
        hoverOpenAtPointerDown.current = open && openedBy.current === 'hover';
      }}
      onPointerCancelCapture={() => {
        pressing.current = false;
      }}
      onClick={() => {
        pressing.current = false;
        // The press light-dismissed a hovered panel, or the trigger toggled it shut. Pin
        // it open instead: the reader clicked because they want it to stay.
        if (!hoverOpenAtPointerDown.current) return;
        hoverOpenAtPointerDown.current = false;
        openedBy.current = 'pointer';
        setOpen(true);
      }}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          cancelClose();
          if (next) openedBy.current = 'pointer';
          else closing.current = true;
          setOpen(next);
        }}
        initialFocusRef={keepFocus}
        side="top"
        triggerVariant="unstyled"
        triggerClassName="text-inherit decoration-fg-muted hover:decoration-fg inline cursor-help rounded-sm underline decoration-dotted decoration-1 underline-offset-4"
        triggerProps={{
          'aria-describedby': descriptionId,
          onFocus: () => {
            if (!closing.current && !pressing.current) show('focus');
          },
          onBlur: (event) => {
            if (openedBy.current !== 'focus') return;
            const panel = document.getElementById(
              event.currentTarget.getAttribute('aria-controls') ?? '',
            );
            if (panel?.contains(event.relatedTarget as Node | null)) return;
            // After the focus move has landed: closing synchronously, mid-blur, made
            // Popover see focus on <body> and hand it back to this trigger, so Tab
            // could never leave a term.
            cancelClose();
            closeTimer.current = setTimeout(hide, 0);
          },
        }}
        className="max-w-[min(22rem,calc(100vw_-_1rem))]"
        trigger={children ?? entry.term}
      >
        <span className="text-fg block font-medium">{entry.term}</span>
        <span className="mt-1 block">{entry.short}</span>
        <span className="text-fg-muted mt-2 block">{entry.long}</span>
      </Popover>
      <span id={descriptionId} hidden>
        {entry.short}
      </span>
    </span>
  );
}
