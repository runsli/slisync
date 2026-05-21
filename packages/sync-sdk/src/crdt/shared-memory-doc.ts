import * as Y from "yjs";
import type { AgentMemoryEntry } from "../agent/types";
import type { SharedMemoryState } from "../shared-memory-state";

export type { SharedMemoryState } from "../shared-memory-state";

export const REMOTE_ORIGIN = "remote";

const ROOT_KEY = "root";

export function readSharedMemoryState(doc: Y.Doc): SharedMemoryState {
  const root = doc.getMap(ROOT_KEY);
  const ytext = root.get("message") as Y.Text | undefined;
  const counterMap = root.get("counter") as Y.Map<number> | undefined;

  let counter = 0;
  counterMap?.forEach((value) => {
    counter += value;
  });

  const agentLog = readAgentLogArray(root);

  return {
    message: ytext?.toString() ?? "",
    counter,
    agentLog: agentLog.length > 0 ? agentLog : undefined,
  };
}

function readAgentLogArray(root: Y.Map<unknown>): AgentMemoryEntry[] {
  const log = root.get("agentLog") as Y.Array<AgentMemoryEntry> | undefined;
  if (!log) return [];
  return log.toArray().filter(isAgentEntry);
}

function isAgentEntry(value: unknown): value is AgentMemoryEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as AgentMemoryEntry;
  return (
    typeof e.agentId === "string" &&
    typeof e.action === "string" &&
    typeof e.summary === "string" &&
    typeof e.at === "number"
  );
}

export function initSharedMemoryDoc(doc: Y.Doc, initial: SharedMemoryState) {
  doc.transact(() => {
    const root = doc.getMap(ROOT_KEY);
    if (!root.has("message")) {
      const ytext = new Y.Text();
      ytext.insert(0, initial.message);
      root.set("message", ytext);
    }
    if (!root.has("counter")) {
      root.set("counter", new Y.Map<number>());
    }
  });
}

function getMessageText(doc: Y.Doc): Y.Text {
  const root = doc.getMap(ROOT_KEY);
  let ytext = root.get("message") as Y.Text | undefined;
  if (!ytext) {
    ytext = new Y.Text();
    root.set("message", ytext);
  }
  return ytext;
}

function getCounterMap(doc: Y.Doc): Y.Map<number> {
  const root = doc.getMap(ROOT_KEY);
  let counterMap = root.get("counter") as Y.Map<number> | undefined;
  if (!counterMap) {
    counterMap = new Y.Map<number>();
    root.set("counter", counterMap);
  }
  return counterMap;
}

/** CRDT text merge via minimal insert/delete diff. */
export function updateMessage(doc: Y.Doc, prev: string, next: string) {
  const ytext = getMessageText(doc);
  doc.transact(() => {
    let i = 0;
    while (i < prev.length && i < next.length && prev[i] === next[i]) i++;

    let prevEnd = prev.length;
    let nextEnd = next.length;
    while (
      prevEnd > i &&
      nextEnd > i &&
      prev[prevEnd - 1] === next[nextEnd - 1]
    ) {
      prevEnd--;
      nextEnd--;
    }

    const delCount = prevEnd - i;
    const ins = next.slice(i, nextEnd);
    if (delCount > 0) ytext.delete(i, delCount);
    if (ins.length > 0) ytext.insert(i, ins);
  });
}

/** Per-client counter map entry (state-based CRDT counter). */
export function adjustCounter(doc: Y.Doc, clientId: string, delta: number) {
  const counterMap = getCounterMap(doc);
  doc.transact(() => {
    counterMap.set(clientId, (counterMap.get(clientId) ?? 0) + delta);
  });
}

export function observeSharedMemory(
  doc: Y.Doc,
  onChange: (state: SharedMemoryState) => void,
) {
  const root = doc.getMap(ROOT_KEY);
  const handler = () => onChange(readSharedMemoryState(doc));
  root.observeDeep(handler);
  onChange(readSharedMemoryState(doc));
  return () => root.unobserveDeep(handler);
}

export function onDocumentUpdate(
  doc: Y.Doc,
  emit: (update: Uint8Array) => void,
) {
  const handler = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return;
    emit(update);
  };
  doc.on("update", handler);
  return () => doc.off("update", handler);
}

export function applyRemoteUpdate(doc: Y.Doc, update: Uint8Array) {
  Y.applyUpdate(doc, update, REMOTE_ORIGIN);
}

export function encodeDocumentSnapshot(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

