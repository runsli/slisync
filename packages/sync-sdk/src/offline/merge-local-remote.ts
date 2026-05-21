import type * as Y from "yjs";
import { decodeUpdate } from "../crdt/codec";
import { applyRemoteUpdate } from "../crdt/shared-memory-doc";

/** Apply server CRDT snapshot on join; local outbox replays after `markSynced`. */
export function applyServerSnapshotToDoc(doc: Y.Doc, encodedSnapshot: string) {
  applyRemoteUpdate(doc, decodeUpdate(encodedSnapshot));
}
