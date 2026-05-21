import type * as Y from "yjs";
import {
  adjustCounter,
  readSharedMemoryState,
  updateMessage,
  type SharedMemoryState,
} from "../crdt/shared-memory-doc";
import type { PatchOptions } from "../protocol";
import type { SyncStoreHook } from "./create-sync-store";

export function bindCrdtActions<T extends SharedMemoryState>(
  store: SyncStoreHook<T>,
  getDoc: () => Y.Doc | null,
  isSynced: () => boolean = () => true,
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const flushMessageToDoc = (next: string) => {
    const doc = getDoc();
    if (!doc) return;

    const prev = readSharedMemoryState(doc).message;
    if (prev === next) return;

    updateMessage(doc, prev, next);
  };

  const patchData = (partial: Partial<T>, options?: PatchOptions) => {
    const doc = getDoc();
    if (!doc) return;

    const clientId = store.getState().clientId;
    if (!clientId) return;

    if (partial.message !== undefined) {
      const next = partial.message as string;
      const synced = isSynced();

      store.setState({
        data: { ...store.getState().data, message: next } as T,
      });

      if (!synced) return;

      if (options?.debounceMs) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          flushMessageToDoc(next);
        }, options.debounceMs);
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      flushMessageToDoc(next);
    }

    if (partial.counter !== undefined) {
      if (!isSynced()) return;
      const current = store.getState().data.counter;
      const target = partial.counter as number;
      const delta = target - current;
      if (delta !== 0) adjustCounter(doc, clientId, delta);
    }
  };

  return { patchData };
}
