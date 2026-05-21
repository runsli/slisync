import * as Y from "yjs";
import type { SharedMemoryState } from "../shared-memory-state";
import {
  adjustCounter,
  readSharedMemoryState,
  updateMessage,
} from "./shared-memory-doc";

const LWW_CLIENT_ID = "lww-sync";

/** Apply a full shared-memory snapshot into the Y.Doc (LWW → CRDT bridge). */
export function applySharedMemoryStateToDoc(
  doc: Y.Doc,
  next: SharedMemoryState,
) {
  const prev = readSharedMemoryState(doc);
  doc.transact(() => {
    if (next.message !== prev.message) {
      updateMessage(doc, prev.message, next.message);
    }
    if (next.counter !== prev.counter) {
      adjustCounter(doc, LWW_CLIENT_ID, next.counter - prev.counter);
    }
  });
}
