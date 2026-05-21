import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as Y from "yjs";
import { encodeUpdate } from "@slisync/sync-sdk/crdt";
import {
  encodeDocumentSnapshot,
  initSharedMemoryDoc,
  readSharedMemoryState,
  updateMessage,
} from "@slisync/sync-sdk/crdt/shared-memory-doc";
import { applyServerSnapshotToDoc } from "@slisync/sync-sdk";

const DEFAULT_STATE = {
  message: "Hello from shared memory",
  counter: 0,
};

describe("applyServerSnapshotToDoc", () => {
  it("applies a remote-encoded snapshot into a local Y.Doc", () => {
    const local = new Y.Doc();
    initSharedMemoryDoc(local, DEFAULT_STATE);

    const remote = new Y.Doc();
    initSharedMemoryDoc(remote, DEFAULT_STATE);
    updateMessage(remote, DEFAULT_STATE.message, "from-server");

    applyServerSnapshotToDoc(
      local,
      encodeUpdate(encodeDocumentSnapshot(remote)),
    );

    assert.equal(readSharedMemoryState(local).message, "from-server");
    local.destroy();
    remote.destroy();
  });
});
