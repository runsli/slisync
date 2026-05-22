import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as Y from "yjs";
import { encodeUpdate } from "@slisync/sync-sdk/crdt";
import {
  buildScopedMemoryOps,
  applyGraphOps,
  initMemoryGraphDoc,
  readMemoryGraphSnapshot,
} from "@slisync/sync-sdk/graph";
import { createCrdtPostgresPersistence } from "@slisync/sync-server";

const POSTGRES_URL = process.env.SYNC_CRDT_POSTGRES_URL?.trim();
const skipPostgres =
  !POSTGRES_URL || process.env.SKIP_POSTGRES === "1";

function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSampleUpdate(): Uint8Array {
  const doc = new Y.Doc();
  initMemoryGraphDoc(doc, "pg-test");
  applyGraphOps(doc, buildScopedMemoryOps("pg-actor"), "pg-actor");
  const snap = readMemoryGraphSnapshot(doc);
  assert.ok(snap && snap.nodes.some((n) => n.kind === "memory_chunk"));
  return encodeUpdate(Y.encodeStateAsUpdate(doc));
}

describe("CRDT postgres persistence", { skip: skipPostgres }, () => {
  it("save/load roundtrip preserves update bytes", async () => {
    const persistence = createCrdtPostgresPersistence(POSTGRES_URL!);
    assert.equal(persistence.backend, "postgres");

    const roomId = uniqueRoom("pg-roundtrip");
    const update = buildSampleUpdate();

    await persistence.save(roomId, update);
    const loaded = await persistence.load(roomId);

    assert.ok(loaded);
    assert.equal(encodeUpdate(loaded), encodeUpdate(update));
  });

  it("second persistence instance reloads after simulated restart", async () => {
    const roomId = uniqueRoom("pg-restart");
    const update = buildSampleUpdate();

    const writer = createCrdtPostgresPersistence(POSTGRES_URL!);
    await writer.save(roomId, update);

    const reader = createCrdtPostgresPersistence(POSTGRES_URL!);
    const loaded = await reader.load(roomId);

    assert.ok(loaded);
    assert.equal(encodeUpdate(loaded), encodeUpdate(update));
  });
});
