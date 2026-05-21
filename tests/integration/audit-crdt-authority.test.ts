import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { pushAgentMemory } from "@slisync/sync-sdk/agent";
import { buildDemoGraphOps, fetchAuditHttp, pushGraphOpsHttp } from "@slisync/sync-sdk/graph";
import { withAuthEnv } from "./helpers/env";
import { startTestSyncServer } from "./helpers/test-server";

function uniqueRoom(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("CRDT authority + audit", () => {
  let baseUrl = "";
  let closeServer: () => Promise<void> = async () => {};

  before(async () => {
    await withAuthEnv(undefined, async () => {
      process.env.SYNC_AUDIT_MEMORY = "1";
      const server = await startTestSyncServer();
      baseUrl = server.baseUrl;
      closeServer = server.close;
    });
  });

  after(async () => {
    delete process.env.SYNC_AUDIT_MEMORY;
    await closeServer();
  });

  it("records agent socket push in audit log", async () => {
    const roomId = uniqueRoom("audit-socket");
    const ack = await pushAgentMemory({
      url: baseUrl,
      roomId,
      agentId: "audit-agent",
      action: "seed_graph",
      graphOps: buildDemoGraphOps("audit-agent"),
    });
    assert.equal(ack.ok, true);

    const audit = await fetchAuditHttp({ baseUrl, roomId });
    assert.equal(audit.ok, true);
    if (!audit.ok) return;
    assert.ok(audit.entries.length >= 1);
    assert.equal(audit.entries[0]?.source, "agent");
    assert.equal(audit.entries[0]?.actorId, "audit-agent");
  });

  it("records agent HTTP push in audit log", async () => {
    const roomId = uniqueRoom("audit-http");
    const push = await pushGraphOpsHttp({
      baseUrl,
      roomId,
      agentId: "http-audit",
      action: "seed",
      graphOps: buildDemoGraphOps("http-audit"),
    });
    assert.equal(push.ok, true);

    const audit = await fetchAuditHttp({ baseUrl, roomId });
    assert.equal(audit.ok, true);
    if (!audit.ok) {
      assert.fail("audit fetch failed");
    }
    assert.ok(audit.entries.some((e) => e.actorId === "http-audit"));
  });
});
