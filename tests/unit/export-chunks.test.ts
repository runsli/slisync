import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as Y from "yjs";
import {
  applyGraphOps,
  buildScopedMemoryOps,
  exportMemoryChunksFromCrdtUpdate,
  exportMemoryChunksFromSnapshot,
  initMemoryGraphDoc,
  readMemoryGraphSnapshot,
  slugifyChunkFilename,
} from "@slisync/sync-sdk/graph";

describe("exportMemoryChunks", () => {
  it("slugifyChunkFilename falls back when title has no latin letters", () => {
    const slug = slugifyChunkFilename("用户提问", "node-abc123");
    assert.equal(slug, "node-abc123");
  });

  it("exports memory_chunk nodes from snapshot with front matter", () => {
    const doc = new Y.Doc();
    initMemoryGraphDoc(doc, "export-test");
    applyGraphOps(doc, buildScopedMemoryOps("test-actor"), "test-actor");
    const snapshot = readMemoryGraphSnapshot(doc);
    assert.ok(snapshot);

    const files = exportMemoryChunksFromSnapshot(snapshot, {
      roomId: "test-room",
    });
    assert.ok(files.length >= 2);

    const first = files[0]!;
    assert.match(first.relativePath, /^[\w-]+\/[\w-]+\/.+\.md$/);
    assert.match(first.markdown, /^---\n/);
    assert.match(first.markdown, /title:/);
    assert.match(first.markdown, /roomId: test-room/);
    assert.match(first.markdown, /workspaceId:/);
    assert.match(first.markdown, /nodeId:/);
    assert.ok(first.markdown.includes("---\n\n"));
  });

  it("exportMemoryChunksFromCrdtUpdate matches snapshot export", () => {
    const doc = new Y.Doc();
    initMemoryGraphDoc(doc, "crdt-export");
    applyGraphOps(doc, buildScopedMemoryOps("actor"), "actor");
    const update = Y.encodeStateAsUpdate(doc);

    const fromUpdate = exportMemoryChunksFromCrdtUpdate(update, {
      roomId: "room-1",
      minImportance: 0.8,
    });
    assert.ok(fromUpdate.length >= 1);
    assert.ok(
      fromUpdate.every((f) => f.markdown.includes("importance:")),
    );
  });
});
