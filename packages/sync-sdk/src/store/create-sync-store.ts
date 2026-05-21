import { create, type StoreApi, type UseBoundStore } from "zustand";
import { diffState, tryApplyStatePatch, type Operation } from "../patch";
import type { AgentActivityPayload } from "../agent/types";
import type { GraphActivityPayload, PresenceMember } from "../protocol";
import type {
  ConflictReason,
  ConnectionStatus,
  PatchOptions,
} from "../protocol";

export interface SyncConflict {
  reason: ConflictReason;
  at: number;
}

export interface SyncStoreState<T> {
  data: T;
  version: number;
  status: ConnectionStatus;
  clientId: string;
  /** CRDT: true after first sync:crdt-sync snapshot applied. */
  syncReady: boolean;
  lastConflict: SyncConflict | null;
  connectionError: string | null;
  /** Latest agent write broadcast (for toast UI). */
  lastAgentActivity: AgentActivityPayload | null;
  /** Graph change broadcast (for toast UI). */
  lastGraphActivity: GraphActivityPayload | null;
  /** Peers currently in the room (presence). */
  presenceMembers: PresenceMember[];
  /** Queued CRDT updates while offline or before first sync. */
  outboxSize: number;
}

export interface SyncStoreActions<T> {
  /** Replace full shared state and push to server. */
  setData: (data: T, options?: PatchOptions) => void;
  /** Shallow-merge partial state and push patch (optional debounce). */
  patchData: (partial: Partial<T>, options?: PatchOptions) => void;
  /** Internal: apply authoritative full snapshot from server. */
  applyRemote: (payload: { state: T; version: number }) => void;
  /** Internal: apply incremental patch from server. */
  applyRemotePatch: (payload: { patch: Operation[]; version: number }) => void;
  /** Internal: server rejected local LWW write. */
  applyConflict: (payload: {
    state: T;
    version: number;
    reason: ConflictReason;
  }) => void;
  clearConflict: () => void;
  setStatus: (status: ConnectionStatus) => void;
  setSyncReady: (syncReady: boolean) => void;
  setConnectionError: (message: string | null) => void;
  setLastAgentActivity: (payload: AgentActivityPayload | null) => void;
  setLastGraphActivity: (payload: GraphActivityPayload | null) => void;
  setPresenceMembers: (members: PresenceMember[]) => void;
  setOutboxSize: (size: number) => void;
  /** Internal: wire socket emitters after local mutation. */
  bindEmitter: (handlers: {
    emitPatch: (patch: Operation[], baseVersion: number) => void;
    emitFull: (state: T, baseVersion: number) => void;
  }) => void;
}

export type SyncStore<T> = SyncStoreState<T> & SyncStoreActions<T>;
export type SyncStoreHook<T> = UseBoundStore<StoreApi<SyncStore<T>>>;

export function createSyncStore<T extends Record<string, unknown>>(
  initialState: T,
): SyncStoreHook<T> {
  let emitPatch: ((patch: Operation[], baseVersion: number) => void) | null =
    null;
  let emitFull: ((state: T, baseVersion: number) => void) | null = null;
  let lastEmitted: T = structuredClone(initialState);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const syncLastEmitted = (get: () => SyncStore<T>) => {
    lastEmitted = structuredClone(get().data);
  };

  const flushToServer = (get: () => SyncStore<T>) => {
    debounceTimer = null;
    const current = get().data;
    const patch = diffState(lastEmitted, current);
    if (patch.length === 0) return;
    emitPatch?.(patch, get().version);
  };

  const scheduleFlush = (get: () => SyncStore<T>, debounceMs: number) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => flushToServer(get), debounceMs);
  };

  const cancelDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const emitImmediate = (get: () => SyncStore<T>, next: T) => {
    const patch = diffState(lastEmitted, next);
    if (patch.length === 0) return;
    emitPatch?.(patch, get().version);
  };

  return create<SyncStore<T>>((set, get) => ({
    data: initialState,
    version: 0,
    status: "disconnected",
    syncReady: false,
    lastConflict: null,
    connectionError: null,
    lastAgentActivity: null,
    lastGraphActivity: null,
    presenceMembers: [],
    outboxSize: 0,
    /** Assigned on client after mount (avoids SSR hydration mismatch). */
    clientId: "",

    setData: (data, options) => {
      cancelDebounce();
      set({ data });
      if (options?.debounceMs) {
        scheduleFlush(get, options.debounceMs);
        return;
      }
      emitImmediate(get, data);
    },

    patchData: (partial, options) => {
      const next = { ...get().data, ...partial } as T;
      set({ data: next });

      if (options?.debounceMs) {
        scheduleFlush(get, options.debounceMs);
        return;
      }

      cancelDebounce();
      emitImmediate(get, next);
    },

    applyRemote: ({ state, version }) => {
      set({ data: state, version, lastConflict: null });
      syncLastEmitted(get);
    },

    applyRemotePatch: ({ patch, version }) => {
      if (version < get().version) return;

      if (patch.length === 0) {
        set({ version, lastConflict: null });
        syncLastEmitted(get);
        return;
      }

      const next = tryApplyStatePatch(get().data, patch);
      if (next === null) {
        emitFull?.(get().data, get().version);
        return;
      }
      set({ data: next, version, lastConflict: null });
      syncLastEmitted(get);
    },

    applyConflict: ({ state, version, reason }) => {
      set({
        data: state,
        version,
        lastConflict: { reason, at: Date.now() },
      });
      syncLastEmitted(get);
    },

    clearConflict: () => set({ lastConflict: null }),

    setStatus: (status) => set({ status }),
    setSyncReady: (syncReady) => set({ syncReady }),
    setConnectionError: (connectionError) => set({ connectionError }),
    setLastAgentActivity: (lastAgentActivity) => set({ lastAgentActivity }),
    setLastGraphActivity: (lastGraphActivity) => set({ lastGraphActivity }),
    setPresenceMembers: (presenceMembers) => set({ presenceMembers }),
    setOutboxSize: (outboxSize) => set({ outboxSize }),

    bindEmitter: (handlers) => {
      emitPatch = handlers.emitPatch;
      emitFull = handlers.emitFull;
    },
  }));
}
