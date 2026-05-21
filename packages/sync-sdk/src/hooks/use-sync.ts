"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useClientMounted } from "./use-client-mounted";
import { useStore } from "zustand";
import { createCrdtSyncClient } from "../client/create-crdt-sync-client";
import { createSyncClient, type SyncClientOptions } from "../client/create-sync-client";
import type { SharedMemoryState } from "../crdt/shared-memory-doc";
import type { PatchOptions, SyncStrategy } from "../protocol";
import type { LocalRoomStore } from "../offline/local-room-store";
import { bindCrdtActions } from "../store/create-crdt-actions";
import { createSyncStore, type SyncStoreHook } from "../store/create-sync-store";

export type UseSyncOptions<T extends Record<string, unknown>> = Omit<
  SyncClientOptions<T>,
  "store"
> & {
  /** Reuse an existing store instance across components. */
  store?: SyncStoreHook<T>;
  /** `crdt` uses Yjs merge; `lww` uses versioned JSON Patch with baseVersion. */
  strategy?: SyncStrategy;
  /** CRDT local-first persistence (default: browser with IndexedDB when available). */
  localPersistence?: boolean | LocalRoomStore;
};

export function useSync<T extends SharedMemoryState>(
  options: UseSyncOptions<T>,
) {
  const strategy = options.strategy ?? "crdt";
  const store = useMemo(
    () => options.store ?? createSyncStore(options.defaultState),
    [options.store],
  );

  const crdtActionsRef = useRef<ReturnType<typeof bindCrdtActions<T>> | null>(null);
  const crdtClientRef = useRef<ReturnType<typeof createCrdtSyncClient<T>> | null>(null);
  const mounted = useClientMounted();

  const lwwPatchData = useStore(store, (s) => s.patchData);
  const setData = useStore(store, (s) => s.setData);

  useEffect(() => {
    if (!mounted) return;

    if (strategy === "crdt") {
      const client = createCrdtSyncClient({ ...options, store });
      crdtClientRef.current = client;
      crdtActionsRef.current = bindCrdtActions(
        store,
        () => client.getDocument(),
        () => client.isSynced(),
      );
      client.connect();

      return () => {
        client.disconnect();
        crdtActionsRef.current = null;
        crdtClientRef.current = null;
      };
    }

    const client = createSyncClient({ ...options, store });
    client.connect();
    return () => client.disconnect();
  }, [mounted, strategy, options.roomId, options.url, options.localPersistence, store]);

  const data = useStore(store, (s) => s.data);
  const version = useStore(store, (s) => s.version);
  const status = useStore(store, (s) => s.status);
  const clientId = useStore(store, (s) => s.clientId);
  const lastConflict = useStore(store, (s) => s.lastConflict);
  const connectionError = useStore(store, (s) => s.connectionError);
  const syncReady = useStore(store, (s) => s.syncReady);
  const lastAgentActivity = useStore(store, (s) => s.lastAgentActivity);
  const lastGraphActivity = useStore(store, (s) => s.lastGraphActivity);
  const presenceMembers = useStore(store, (s) => s.presenceMembers);
  const outboxSize = useStore(store, (s) => s.outboxSize);
  const localRestored = useStore(store, (s) => s.localRestored);
  const lastSyncedAt = useStore(store, (s) => s.lastSyncedAt);

  useEffect(() => {
    if (!lastConflict || strategy === "crdt") return;
    const timer = setTimeout(() => store.getState().clearConflict(), 4000);
    return () => clearTimeout(timer);
  }, [store, lastConflict?.at, strategy]);

  const getCrdtDocument = useCallback(() => {
    return crdtClientRef.current?.getDocument() ?? null;
  }, []);

  const notifyGraphActivity = useCallback((summary: string) => {
    crdtClientRef.current?.notifyGraphActivity(summary);
  }, []);

  const patchData = useCallback(
    (partial: Partial<T>, opts?: PatchOptions) => {
      if (strategy === "crdt") {
        crdtActionsRef.current?.patchData(partial, opts);
        return;
      }
      lwwPatchData(partial, opts);
    },
    [strategy, lwwPatchData],
  );

  return {
    store,
    strategy,
    mounted,
    syncReady: strategy === "crdt" ? syncReady : mounted,
    data,
    version,
    status,
    clientId,
    lastConflict: strategy === "crdt" ? null : lastConflict,
    connectionError,
    lastAgentActivity,
    lastGraphActivity: strategy === "crdt" ? lastGraphActivity : null,
    presenceMembers: strategy === "crdt" ? presenceMembers : [],
    outboxSize: strategy === "crdt" ? outboxSize : 0,
    localRestored: strategy === "crdt" ? localRestored : null,
    lastSyncedAt: strategy === "crdt" ? lastSyncedAt : null,
    getCrdtDocument: strategy === "crdt" ? getCrdtDocument : () => null,
    notifyGraphActivity:
      strategy === "crdt" ? notifyGraphActivity : () => undefined,
    setData,
    patchData,
  };
}
