/** Shared polling helpers for sync integration tests. */

import { createIndexedDBRoomStore } from "@slisync/sync-sdk";

/** Longer waits on CI runners where socket/IDB hydration can be slower. */
export function integrationTimeoutMs(localMs = 12_000) {
  return process.env.CI ? Math.max(localMs, 25_000) : localMs;
}

export function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function waitFor(
  predicate: () => boolean,
  timeoutMs = integrationTimeoutMs(),
  intervalMs = 50,
  label = "condition",
): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`waitFor timeout: ${label}`));
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Wait until CRDT shared-memory root is initialized on the doc. */
export function waitForDocReady(getDoc: () => import("yjs").Doc | null) {
  return waitFor(() => {
    const doc = getDoc();
    if (!doc) return false;
    return doc.getMap("root").has("message");
  });
}

/** Poll IndexedDB until the room record matches `predicate`. */
export async function waitForIdbRecord(
  roomId: string,
  predicate: (record: { outbox: string[] } | null) => boolean,
  timeoutMs = 12_000,
) {
  const store = createIndexedDBRoomStore();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const record = await store.get(roomId);
    if (predicate(record)) return record;
    await delay(50);
  }
  throw new Error("waitForIdbRecord timeout");
}

/** Clear fake/browser IndexedDB database between tests. */
export async function clearSlisyncDb() {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("slisync");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
