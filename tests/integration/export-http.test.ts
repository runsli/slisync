import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ExportChunksHttpResponse } from "@slisync/sync-schema";
import {
  buildScopedMemoryOps,
  pushGraphOpsHttp,
} from "@slisync/sync-sdk/graph";
import { withSyncProtocolHeaders } from "@slisync/sync-sdk";
import { startTestSyncServer } from "./helpers/test-server";

const AGENT_KEY = "test-agent-key";

function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchExportChunks(
  baseUrl: string,
  roomId: string,
  token?: string,
): Promise<{ status: number; body: ExportChunksHttpResponse }> {
  const headers = withSyncProtocolHeaders(
    token ? { "X-Sync-Agent-Key": token } : {},
  );
  const res = await fetch(
    `${baseUrl}/v1/rooms/${encodeURIComponent(roomId)}/export/chunks`,
    { method: "GET", headers },
  );
  const body = (await res.json()) as ExportChunksHttpResponse;
  return { status: res.status, body };
}

describe("export HTTP integration", () => {
  let baseUrl = "";
  let closeServer: () => Promise<void> = async () => {};

  before(async () => {
    const server = await startTestSyncServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  after(async () => {
    await closeServer();
  });

  it("GET export returns memory_chunk markdown after HTTP seed", async () => {
    const roomId = uniqueRoom("export-http");
    const seed = await pushGraphOpsHttp({
      baseUrl,
      roomId,
      agentId: "export-agent",
      action: "seed_scoped_memory",
      graphOps: buildScopedMemoryOps("export-agent"),
    });
    assert.equal(seed.ok, true);

    const { status, body } = await fetchExportChunks(baseUrl, roomId);
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    if (!body.ok) return;

    assert.equal(body.roomId, roomId);
    assert.ok(body.count >= 1);
    assert.ok(body.files.length >= 1);
    assert.match(body.files[0]!.markdown, /kind:\s*memory_chunk/);
    assert.ok(body.exportedAt);
  });

  it("GET export returns count 0 for empty room", async () => {
    const roomId = uniqueRoom("export-empty");
    const { status, body } = await fetchExportChunks(baseUrl, roomId);
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    if (!body.ok) return;
    assert.equal(body.count, 0);
    assert.deepEqual(body.files, []);
  });

  describe("auth", () => {
    const auth = { required: true, agentApiKey: AGENT_KEY };

    let authBaseUrl = "";
    let closeAuthServer: () => Promise<void> = async () => {};

    before(async () => {
      const server = await startTestSyncServer(auth);
      authBaseUrl = server.baseUrl;
      closeAuthServer = server.close;
    });

    after(async () => {
      await closeAuthServer();
    });

    it("rejects GET export without token when SYNC_AUTH_REQUIRED", async () => {
      const roomId = uniqueRoom("export-auth");
      const { status, body } = await fetchExportChunks(authBaseUrl, roomId);
      assert.equal(status, 401);
      assert.equal(body.ok, false);
    });

    it("accepts GET export with agent token after seed", async () => {
      const roomId = uniqueRoom("export-auth-ok");
      const seed = await pushGraphOpsHttp({
        baseUrl: authBaseUrl,
        roomId,
        agentId: "export-agent",
        action: "seed_scoped_memory",
        graphOps: buildScopedMemoryOps("export-agent"),
        token: AGENT_KEY,
      });
      assert.equal(seed.ok, true);

      const { status, body } = await fetchExportChunks(
        authBaseUrl,
        roomId,
        AGENT_KEY,
      );
      assert.equal(status, 200);
      assert.equal(body.ok, true);
      if (!body.ok) return;
      assert.ok(body.count >= 1);
    });
  });
});
