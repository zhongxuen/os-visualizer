'use client';

import { X } from 'lucide-react';
import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import { cn } from '@/lib/cn';

import { focusRing } from '../timeline/ui/styles';
import { restoreFocus, supportsModalDialog } from '../timeline/ui/topLayer';

/**
 * A modal panel that slides in from an edge: the phone menu, the shortcuts sheet, the
 * Setup drawer on a tablet, the Inspector as a bottom sheet on a phone (docs/UIUX.md
 * §4.2, §4.3).
 *
 * Vendored from Internet Visualizer's `Dialog` + `Drawer` (one component here, since this
 * product has no centred dialog), on the native `<dialog>` opened with `showModal()`. The
 * platform does the hard parts: the top layer, the backdrop, making everything behind
 * inert (the focus trap), and Escape. This adds:
 *
 * - **`open` is controlled.** Every way of closing it (Escape, the close button, a
 *   click on the backdrop) calls `onClose` and the parent decides.
 * - **Focus goes back to the opener** when it closes.
 * - **Focus lands on the body,** not on "Close", so the sheet is read from the top.
 *
 * `side="bottom"` is a bottom sheet everywhere; `left` and `right` are side sheets from
 * `sm` up and bottom sheets below it, where the thumb already is.
 *
 * The slide is the `translate` transition (`--dur-3`, `--ease-out`), collapsed by the
 * global reduced-motion rule. Without `showModal()` (jsdom) it opens non-modally with the
 * `open` attribute and handles Escape itself.
 */

export type SheetSide = 'left' | 'right' | 'bottom';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Actions pinned under the body. */
  footer?: ReactNode;
  side?: SheetSide;
  /** The close button's accessible name. */
  closeLabel?: string;
  /** Receives focus on open. Defaults to the body. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  bodyClassName?: string;
}

const PHONE =
  'inset-x-0 top-auto bottom-0 max-h-[85dvh] w-full rounded-t-[var(--radius-panel)] border-x-0 border-b-0 [--sheet-from:0_100%]';

const SIDE: Record<SheetSide, string> = {
  left: cn(
    PHONE,
    'sm:inset-y-0 sm:right-auto sm:left-0 sm:h-dvh sm:max-h-none sm:w-[min(22rem,calc(100vw_-_3rem))] sm:rounded-none sm:border-y-0 sm:border-r sm:[--sheet-from:-100%_0]',
  ),
  right: cn(
    PHONE,
    'sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-none sm:w-[min(22rem,calc(100vw_-_3rem))] sm:rounded-none sm:border-y-0 sm:border-l sm:[--sheet-from:100%_0]',
  ),
  bottom: PHONE,
};

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = 'right',
  closeLabel = 'Close',
  initialFocusRef,
  className,
  bodyClassName,
}: SheetProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    openRef.current = open;
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement ? active : null;

      if (supportsModalDialog()) dialog.showModal();
      else dialog.setAttribute('open', '');

      (initialFocusRef?.current ?? bodyRef.current)?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      if (supportsModalDialog()) dialog.close();
      else dialog.removeAttribute('open');

      restoreFocus(openerRef.current, dialog);
      openerRef.current = null;
    }
  }, [open, initialFocusRef]);

  // Escape, as performed by the platform: the dialog is already closed when this fires.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onNativeClose = () => {
      if (!openRef.current) return;
      onCloseRef.current();
      restoreFocus(openerRef.current, dialog);
    };

    dialog.addEventListener('close', onNativeClose);
    return () => dialog.removeEventListener('close', onNativeClose);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape' && !supportsModalDialog()) {
      event.preventDefault();
      onClose();
    }
  };

  // The surface fills the dialog box, so a click on the `<dialog>` itself is the backdrop.
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    // Both handlers have keyboard routes: the close button, and Escape.
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-side={side}
      onKeyDown={onKeyDown}
      onClick={onClick}
      className={cn(
        'text-fg bg-surface-raised border-border fixed m-0 max-w-none overflow-hidden border p-0',
        'backdrop:bg-surface/80',
        SIDE[side],
        // An arbitrary property: `--sheet-from` already holds both axes.
        '[translate:var(--sheet-from)] open:[translate:none] starting:open:[translate:var(--sheet-from)]',
        'transition-[translate,display,overlay] transition-discrete duration-(--dur-3) ease-out',
        className,
      )}
    >
      <div className="flex h-full max-h-[inherit] min-h-0 flex-col">
        <header className="border-rule flex items-start gap-3 border-b py-2 pr-2 pl-5">
          <div className="min-w-0 flex-1 py-2.5">
            <h2 id={titleId} className="text-fg text-lead font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-fg-muted text-small mt-1">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className={cn(
              'text-fg-secondary hover:bg-surface-overlay hover:text-fg size-target inline-flex shrink-0 items-center justify-center rounded-md transition-colors',
              focusRing,
            )}
          >
            <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>
        </header>

        <div
          ref={bodyRef}
          // The body scrolls, so it is a tab stop of its own; it is also where focus lands.
          tabIndex={0}
          className={cn(
            'text-fg-secondary min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4',
            'focus-visible:outline-focus focus-visible:outline-2 focus-visible:-outline-offset-2',
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer ? (
          <footer className="border-rule flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
