'use client';

import { createContext, useContext, useEffect } from 'react';

import type { RunUnit } from '@/core/events/builder';

import type { PlaybackStore } from '../timeline/hooks/usePlayback';

/**
 * How the transport bar tells the workspace which run it is playing.
 *
 * `ModuleLayout` receives the transport as an opaque `timeline` node, but needs the
 * playback store for three things: pressing Play from the phone's Setup tab switches to
 * Watch, the end-of-run card appears when the run ends, and forward steps animate while
 * every other step change is instant (`StepTransitionProvider`). `PlaybackBar` registers
 * its store here, so no module has to pass the store twice.
 *
 * Internal: the timeline's public API is unchanged, and a `PlaybackBar` outside a
 * workspace registers with nothing.
 */

export interface WorkspaceTimeline {
  store: PlaybackStore;
  unit: RunUnit;
}

export interface WorkspaceContextValue {
  register(timeline: WorkspaceTimeline): () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/** Register `store` with the surrounding workspace, if there is one. */
export function useRegisterWithWorkspace(store: PlaybackStore, unit: RunUnit): void {
  const workspace = useContext(WorkspaceContext);
  useEffect(() => {
    if (!workspace) return;
    return workspace.register({ store, unit });
  }, [workspace, store, unit]);
}
