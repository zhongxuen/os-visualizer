'use client';

import { Info, PanelLeft, PanelLeftClose, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { isGlyphSlug, ModuleGlyph } from '@/components/ModuleGlyph';
import { StepTransitionProvider } from '@/components/motion/useStepTransition';
import {
  PlaybackContext,
  type PlaybackStoreState,
} from '@/components/timeline/hooks/usePlayback';
import {
  isTypingTarget,
  matchWorkspaceKey,
  type ModuleShortcut,
} from '@/components/timeline/keymap';
import { unitIndex } from '@/components/timeline/time';
import { buttonClasses } from '@/components/timeline/ui/Button';
import { Kbd } from '@/components/timeline/ui/Kbd';
import { focusRing } from '@/components/timeline/ui/styles';
import { UNIT_MS } from '@/core/events/builder';
import { cn } from '@/lib/cn';

import { EndOfRunCard, type EndOfRunContent } from './EndOfRunCard';
import { sharedPrefsStore, usePreference, type StoredMode } from './prefs';
import { ShareControl, type ShareControlProps } from './ShareControl';
import { useModuleShortcuts } from './ShortcutsSheet';
import {
  WorkspaceContext,
  type WorkspaceContextValue,
  type WorkspaceTimeline,
} from './workspace';

/**
 * The module workspace (docs/UIUX.md §4.3). Modules compose; they do not lay themselves
 * out.
 *
 * - **Header:** the module's glyph and title, the intro, the one-line honesty note
 *   linking to /about#model (G8), the Guided / Sandbox switch with a line saying what
 *   each is (G12), "Saved in this link · Copy link" (G15), and the Setup controls below.
 * - **Desktop (>= 1024 px):** three columns, Setup | Watch | Inspector, with the results
 *   and the end-of-run card under the visual. The Setup column collapses ("Focus mode",
 *   the button or `F`) to give the visual the width.
 * - **Tablet (640-1023 px):** Setup is a drawer opened from the header; the Inspector
 *   sits under the visual.
 * - **Phone (< 640 px):** three tabs, Setup / Watch / Results. Pressing Play from Setup
 *   or Results switches to Watch. The transport bar is pinned only on Watch.
 * - **Transport:** pinned to the bottom, and hidden below desktop while a text field,
 *   select or editable element has focus, so the on-screen keyboard never puts it over
 *   the field being edited (B11).
 *
 * Every region is rendered once and placed by CSS per breakpoint, so an editor never
 * remounts (and loses what was typed) when the window is resized.
 *
 * The workspace follows the run through the `PlaybackBar` in `timeline`, which registers
 * its store (`workspace.ts`): that is how Play switches tabs, how the end-of-run card
 * knows the run ended, and how forward steps animate while back, jump and scrub are
 * instant (`StepTransitionProvider`, §6.1).
 *
 * The first visit to each module opens in Guided; after that the module opens in the
 * mode it was left in (G1, stored in `osv:v1` prefs as `moduleModes`).
 *
 * The page's `<main id="main">` comes from here, which is where the skip link lands.
 */

/** `'walkthrough'` is shown as Guided and `'free'` as Sandbox (G12). */
export type ModuleMode = StoredMode;

export const MODE_LABELS: Record<ModuleMode, string> = {
  walkthrough: 'Guided',
  free: 'Sandbox',
};

export const MODE_DESCRIPTIONS: Record<ModuleMode, string> = {
  walkthrough: 'A short lesson walks you through a prepared example, step by step.',
  free: 'Build your own input, then play or step through it at your own pace.',
};

/** The mode a module opens in on its first visit (G1). */
export const FIRST_VISIT_MODE: ModuleMode = 'walkthrough';

export type WorkspaceTab = 'setup' | 'watch' | 'results';

const TAB_LABELS: Record<WorkspaceTab, string> = {
  setup: 'Setup',
  watch: 'Watch',
  results: 'Results',
};
const TABS: readonly WorkspaceTab[] = ['setup', 'watch', 'results'];

export interface ModuleLayoutProps {
  title: string;
  intro: ReactNode;
  mode: ModuleMode;
  onModeChange: (mode: ModuleMode) => void;
  /**
   * The module's id, for remembering its mode and finding the next module. Defaults to
   * the route's first segment (`/scheduling` -> `scheduling`).
   */
  moduleId?: string;
  /** Setup: presets, the editor, the policy. */
  inputs?: ReactNode;
  /** Watch: the visual (Gantt chart, bit field, frame strip, graph). */
  children: ReactNode;
  /** What the current step means: `StepInspector`, `RulesPanel`, phases. */
  inspector?: ReactNode;
  /** Results: metrics. Under the visual on wider screens, its own tab on a phone. */
  results?: ReactNode;
  /**
   * The end-of-run card's content (G16), shown when the run ends. Omitted, the card
   * still offers "Play again" and the next module; `false` turns it off.
   */
  endOfRun?: EndOfRunContent | false;
  /** The share control's wiring (G15); `false` hides it. Defaults to the address bar. */
  share?: ShareControlProps | false;
  /** The module's own keys, listed in the shortcuts sheet (B6). */
  shortcuts?: readonly ModuleShortcut[];
  /** The playback bar (`PlaybackBar`), pinned to the bottom. */
  timeline?: ReactNode;
  className?: string;
}

/* --- Small hooks ----------------------------------------------------------- */

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  };
}

/** A media query, `false` on the server and until hydration. */
function useMediaQuery(query: string): boolean {
  const subscribe = useMemo(() => subscribeMedia(query), [query]);
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia?.(query).matches) || false,
    () => false,
  );
}

const PHONE_QUERY = '(max-width: 639.98px)';
const DESKTOP_QUERY = '(min-width: 1024px)';

const noSubscribe = () => () => {};

/** A slice of the registered playback store, or `fallback` while none is registered. */
function useTimelineSlice<T>(
  timeline: WorkspaceTimeline | null,
  select: (state: PlaybackStoreState, unit: WorkspaceTimeline['unit']) => T,
  fallback: T,
): T {
  const store = timeline?.store;
  const unit = timeline?.unit ?? 'tick';
  return useSyncExternalStore(
    store ? store.subscribe : noSubscribe,
    () => (store ? select(store.getState(), unit) : fallback),
    () => fallback,
  );
}

/** Inputs that never bring up an on-screen keyboard or picker. */
const NO_KEYBOARD = new Set(['radio', 'checkbox', 'button', 'submit', 'reset', 'range']);

/** Would focusing this bring up the phone's keyboard or picker over the page? */
function bringsUpKeyboard(target: EventTarget | null): boolean {
  if (!isTypingTarget(target)) return false;
  return !(target instanceof HTMLInputElement && NO_KEYBOARD.has(target.type));
}

/** Whether a text field, select or editable element has focus, anywhere on the page. */
function useTypingFocus(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => setTyping(bringsUpKeyboard(event.target));
    const onFocusOut = (event: FocusEvent) => {
      if (!event.relatedTarget) setTyping(false);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);
  return typing;
}

/**
 * The module's mode across visits (G1). On the first render after hydration, a module
 * that has been visited switches to the mode it was left in; one that has not opens in
 * Guided and is recorded as visited.
 */
function useRememberedMode(
  moduleId: string,
  mode: ModuleMode,
  onModeChange: (mode: ModuleMode) => void,
): (mode: ModuleMode) => void {
  const [, setModes] = usePreference('moduleModes');
  const restored = useRef(false);

  const remember = useCallback(
    (next: ModuleMode) => {
      const current = sharedPrefsStore().getSnapshot().moduleModes;
      if (current[moduleId] !== next) setModes({ ...current, [moduleId]: next });
    },
    [moduleId, setModes],
  );

  useEffect(() => {
    if (restored.current || !moduleId) return;
    restored.current = true;
    const stored = sharedPrefsStore().getSnapshot().moduleModes[moduleId];
    const target = stored ?? FIRST_VISIT_MODE;
    if (target !== mode) onModeChange(target);
    if (!stored) remember(target);
  }, [moduleId, mode, onModeChange, remember]);

  return useCallback(
    (next: ModuleMode) => {
      remember(next);
      onModeChange(next);
    },
    [remember, onModeChange],
  );
}

/* --- Parts ----------------------------------------------------------------- */

function ModeSwitch({
  mode,
  onModeChange,
}: Pick<ModuleLayoutProps, 'mode' | 'onModeChange'>) {
  const name = useId();
  const descriptionId = useId();
  return (
    <div className="flex max-w-xs flex-col gap-1 sm:items-end">
      <fieldset
        aria-describedby={descriptionId}
        className="border-border inline-flex self-start rounded-md border p-0.5 sm:self-end"
      >
        <legend className="sr-only">Mode</legend>
        {(Object.keys(MODE_LABELS) as ModuleMode[]).map((value) => (
          <label
            key={value}
            className={cn(
              'min-h-target-floor text-small inline-flex cursor-pointer items-center rounded px-3 font-medium transition-colors',
              'has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
              mode === value
                ? 'bg-accent text-accent-ink'
                : 'text-fg-secondary hover:bg-surface-overlay hover:text-fg',
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={mode === value}
              onChange={() => onModeChange(value)}
              className="sr-only"
            />
            {MODE_LABELS[value]}
          </label>
        ))}
      </fieldset>
      <p id={descriptionId} className="text-fg-muted text-caption sm:text-right">
        {MODE_DESCRIPTIONS[mode]}
      </p>
    </div>
  );
}

/** The phone's Setup / Watch / Results tabs: roving tabindex, arrows, Home and End. */
function PhoneTabs({
  tab,
  onTab,
  ids,
}: {
  tab: WorkspaceTab;
  onTab: (tab: WorkspaceTab) => void;
  ids: Record<WorkspaceTab, { tab: string; panel: string }>;
}) {
  const refs = useRef(new Map<WorkspaceTab, HTMLButtonElement | null>());
  const move = (to: WorkspaceTab) => {
    onTab(to);
    refs.current.get(to)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? TABS[index === last ? 0 : index + 1]
        : event.key === 'ArrowLeft'
          ? TABS[index === 0 ? last : index - 1]
          : event.key === 'Home'
            ? TABS[0]
            : event.key === 'End'
              ? TABS[last]
              : undefined;
    if (!target) return;
    // Taken here, so the playback shortcuts on the same keys do not also fire.
    event.preventDefault();
    move(target);
  };

  return (
    <div
      role="tablist"
      aria-label="Workspace"
      className="border-border bg-surface mt-4 grid grid-cols-3 gap-1 rounded-md border p-1 sm:hidden"
    >
      {TABS.map((value, index) => {
        const selected = value === tab;
        return (
          <button
            key={value}
            ref={(node) => {
              refs.current.set(value, node);
            }}
            type="button"
            role="tab"
            id={ids[value].tab}
            aria-controls={ids[value].panel}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onTab(value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'min-h-target text-small rounded font-medium transition-colors',
              focusRing,
              selected
                ? 'bg-accent text-accent-ink'
                : 'text-fg-secondary hover:bg-surface-overlay hover:text-fg',
            )}
          >
            {TAB_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}

/*
 * The desktop grid. Literal strings, one per layout, because Tailwind finds classes by
 * reading the source: a class built at runtime would never be generated.
 */
const GRID = {
  full: 'lg:grid-cols-[18rem_minmax(0,1fr)_20rem] lg:[grid-template-areas:"setup_visual_inspector"_"setup_results_inspector"]',
  noSetup:
    'lg:grid-cols-[minmax(0,1fr)_20rem] lg:[grid-template-areas:"visual_inspector"_"results_inspector"]',
  noInspector:
    'lg:grid-cols-[18rem_minmax(0,1fr)] lg:[grid-template-areas:"setup_visual"_"setup_results"]',
  visualOnly: 'lg:grid-cols-[minmax(0,1fr)] lg:[grid-template-areas:"visual"_"results"]',
} as const;

/* --- The workspace --------------------------------------------------------- */

export function ModuleLayout({
  title,
  intro,
  mode,
  onModeChange,
  moduleId: moduleIdProp,
  inputs,
  children,
  inspector,
  results,
  endOfRun,
  share,
  shortcuts,
  timeline,
  className,
}: ModuleLayoutProps) {
  const pathname = usePathname();
  const moduleId = moduleIdProp ?? pathname?.split('/').filter(Boolean)[0] ?? '';
  const changeMode = useRememberedMode(moduleId, mode, onModeChange);
  useModuleShortcuts(shortcuts);

  const isPhone = useMediaQuery(PHONE_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const typing = useTypingFocus();

  const [tab, setTab] = useState<WorkspaceTab>('watch');
  const [focusMode, setFocusMode] = useState(false);
  const [drawerWanted, setDrawerOpen] = useState(false);
  // Only a tablet has the drawer; past either edge it is simply not open.
  const drawerOpen = drawerWanted && !isDesktop && !isPhone;

  // The transport registers its store here (see workspace.ts).
  const [registered, setRegistered] = useState<WorkspaceTimeline | null>(null);
  const workspace = useMemo<WorkspaceContextValue>(
    () => ({
      register: (next) => {
        setRegistered(next);
        return () => setRegistered((current) => (current === next ? null : current));
      },
    }),
    [],
  );
  const outerStore = useContext(PlaybackContext);
  const status = useTimelineSlice(registered, (s) => s.status, 'idle');
  const step = useTimelineSlice(
    registered,
    (s, unit) => unitIndex(s.virtualTime, unit),
    0,
  );
  const ended = status === 'ended';

  // Play from Setup or Results: the phone goes to Watch, where the run is.
  const lastStatus = useRef(status);
  useEffect(() => {
    if (status === 'playing' && lastStatus.current !== 'playing') {
      setTab((current) => (current === 'watch' ? current : 'watch'));
    }
    lastStatus.current = status;
  }, [status]);

  // F: Focus mode.
  const hasSetup = Boolean(inputs);
  useEffect(() => {
    if (!hasSetup) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if (matchWorkspaceKey(event)?.type !== 'focus-mode') return;
      event.preventDefault();
      setFocusMode((on) => !on);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasSetup]);

  // The tablet drawer: focus goes in when it opens and back to its button when it closes.
  const setupRef = useRef<HTMLElement>(null);
  const drawerButtonRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpen = useRef(false);
  useEffect(() => {
    if (drawerOpen) setupRef.current?.focus({ preventScroll: true });
    else if (drawerWasOpen.current)
      drawerButtonRef.current?.focus({ preventScroll: true });
    drawerWasOpen.current = drawerOpen;
  }, [drawerOpen]);
  const baseId = useId();
  const ids = {
    setup: { tab: `${baseId}-tab-setup`, panel: `${baseId}-setup` },
    watch: { tab: `${baseId}-tab-watch`, panel: `${baseId}-watch` },
    results: { tab: `${baseId}-tab-results`, panel: `${baseId}-results` },
  } satisfies Record<WorkspaceTab, { tab: string; panel: string }>;

  /** Phone tab panels are tabpanels; on wider screens they are plain regions. */
  const panelProps = (which: WorkspaceTab, label: string) =>
    isPhone
      ? { role: 'tabpanel' as const, 'aria-labelledby': ids[which].tab }
      : { 'aria-label': label };

  const setupShown = hasSetup && !focusMode;
  const grid =
    hasSetup && !focusMode
      ? inspector
        ? GRID.full
        : GRID.noInspector
      : inspector
        ? GRID.noSetup
        : GRID.visualOnly;

  const showCard = ended && endOfRun !== false;
  const card = showCard ? (
    <EndOfRunCard
      {...(endOfRun || {})}
      moduleId={moduleId}
      onReplay={
        registered ? () => registered.store.getState().run({ type: 'toggle' }) : undefined
      }
    />
  ) : null;
  const hasResults = Boolean(results) || showCard;

  const glyph = isGlyphSlug(moduleId) ? (
    <ModuleGlyph slug={moduleId} className="h-8 w-16 max-sm:hidden" />
  ) : null;

  return (
    <WorkspaceContext value={workspace}>
      <PlaybackContext value={registered?.store ?? outerStore}>
        <StepTransitionProvider
          step={step}
          stepIntervalMs={registered ? UNIT_MS[registered.unit] : undefined}
        >
          <div className={cn('flex flex-1 flex-col', className)} data-workspace="">
            <main
              id="main"
              tabIndex={-1}
              className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                <div className="min-w-0 flex-1 basis-80">
                  <div className="flex items-center gap-3">
                    {glyph}
                    <h1 className="text-title font-bold tracking-tight">{title}</h1>
                  </div>
                  <div className="text-fg-secondary text-lead mt-1 max-w-3xl">
                    {intro}
                  </div>
                  <p className="text-fg-muted text-small mt-2 flex items-start gap-1.5">
                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Textbook model, not a real kernel.{' '}
                      <Link
                        href="/about#model"
                        className="text-fg font-medium underline underline-offset-2"
                      >
                        What that means
                      </Link>
                    </span>
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                  <ModeSwitch mode={mode} onModeChange={changeMode} />
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {share === false ? null : <ShareControl {...(share ?? {})} />}
                    {hasSetup ? (
                      <>
                        <button
                          ref={drawerButtonRef}
                          type="button"
                          aria-expanded={drawerOpen}
                          aria-controls={ids.setup.panel}
                          onClick={() => setDrawerOpen((open) => !open)}
                          className={buttonClasses({
                            variant: 'secondary',
                            size: 'sm',
                            className: 'hidden gap-1.5 sm:max-lg:inline-flex',
                          })}
                        >
                          <PanelLeft aria-hidden="true" className="size-4" />
                          Setup
                        </button>
                        <button
                          type="button"
                          aria-pressed={focusMode}
                          aria-controls={ids.setup.panel}
                          onClick={() => setFocusMode((on) => !on)}
                          title="Focus mode: hide the Setup column (F)"
                          className={buttonClasses({
                            variant: 'ghost',
                            size: 'sm',
                            className: 'hidden gap-1.5 lg:inline-flex',
                          })}
                        >
                          {focusMode ? (
                            <PanelLeft aria-hidden="true" className="size-4" />
                          ) : (
                            <PanelLeftClose aria-hidden="true" className="size-4" />
                          )}
                          Focus mode
                          <Kbd keys={['F']} aria-hidden="true" className="ml-1" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <PhoneTabs tab={tab} onTab={setTab} ids={ids} />

              {drawerOpen ? (
                // The drawer's backdrop; Escape and the close button are the keyboard routes.
                <div
                  aria-hidden="true"
                  onClick={() => setDrawerOpen(false)}
                  className="bg-surface/80 fixed inset-0 z-40 hidden sm:max-lg:block"
                />
              ) : null}

              <div
                className={cn('mt-4 grid gap-6 sm:mt-6 lg:grid-rows-[auto_1fr]', grid)}
              >
                {inputs ? (
                  <section
                    ref={setupRef}
                    id={ids.setup.panel}
                    {...panelProps('setup', 'Setup')}
                    tabIndex={-1}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && drawerOpen) {
                        event.preventDefault();
                        setDrawerOpen(false);
                      }
                    }}
                    className={cn(
                      'min-w-0 outline-none lg:[grid-area:setup]',
                      tab !== 'setup' && 'max-sm:hidden',
                      // Tablet: a drawer from the left, over the page.
                      'sm:max-lg:bg-surface-raised sm:max-lg:border-border sm:max-lg:fixed sm:max-lg:inset-y-0 sm:max-lg:left-0 sm:max-lg:z-50 sm:max-lg:w-[min(24rem,calc(100vw-3rem))] sm:max-lg:overflow-y-auto sm:max-lg:overscroll-contain sm:max-lg:border-r sm:max-lg:p-4 sm:max-lg:shadow-lg',
                      !drawerOpen && 'sm:max-lg:hidden',
                      !setupShown && 'lg:hidden',
                    )}
                  >
                    <div className="mb-3 hidden items-center justify-between sm:max-lg:flex">
                      <h2 className="text-lead font-semibold">Setup</h2>
                      <button
                        type="button"
                        aria-label="Close setup"
                        onClick={() => setDrawerOpen(false)}
                        className={buttonClasses({
                          variant: 'ghost',
                          className: 'size-target px-0',
                        })}
                      >
                        <X aria-hidden="true" className="size-5" />
                      </button>
                    </div>
                    {inputs}
                  </section>
                ) : null}

                <div
                  id={ids.watch.panel}
                  {...(isPhone
                    ? { role: 'tabpanel', 'aria-labelledby': ids.watch.tab }
                    : {})}
                  className={cn(
                    'flex min-w-0 flex-col gap-6 sm:contents',
                    tab !== 'watch' && 'max-sm:hidden',
                  )}
                >
                  <section
                    aria-label="Visualisation"
                    className="min-w-0 lg:[grid-area:visual]"
                  >
                    {children}
                  </section>
                  {inspector ? (
                    <section
                      aria-label="Inspector"
                      className="min-w-0 lg:[grid-area:inspector]"
                    >
                      {inspector}
                    </section>
                  ) : null}
                  {ended && hasResults ? (
                    <button
                      type="button"
                      onClick={() => setTab('results')}
                      className={buttonClasses({
                        variant: 'secondary',
                        className: 'self-start sm:hidden',
                      })}
                    >
                      Run finished: see the results
                    </button>
                  ) : null}
                </div>

                <section
                  id={ids.results.panel}
                  {...panelProps('results', 'Results')}
                  className={cn(
                    'flex min-w-0 flex-col gap-6 lg:[grid-area:results]',
                    tab !== 'results' && 'max-sm:hidden',
                    !hasResults && 'sm:hidden',
                  )}
                >
                  {results}
                  {card}
                  {!hasResults ? (
                    <p className="text-fg-muted text-small">
                      Results appear here at the end of the run. Until then, the numbers
                      are on the Watch tab, under the picture.
                    </p>
                  ) : null}
                </section>
              </div>
            </main>

            {timeline ? (
              <section
                aria-label="Playback"
                className={cn(
                  'border-border bg-surface-raised z-10 border-t sm:sticky sm:bottom-0',
                  tab === 'watch' && 'max-sm:sticky max-sm:bottom-0',
                  typing && 'max-lg:hidden',
                )}
              >
                <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
                  {timeline}
                </div>
              </section>
            ) : null}
          </div>
        </StepTransitionProvider>
      </PlaybackContext>
    </WorkspaceContext>
  );
}
