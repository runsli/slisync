import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { summarizeAgentGraphPolicy } from "@slisync/sync-schema";
import { fetchSyncCapabilities } from "@slisync/sync-sdk";
import { startTestSyncServer } from "./helpers/test-server";

describe("sync capabilities API", () => {
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

  it("GET /v1/sync/capabilities returns protocol and agent policy", async () => {
    const res = await fetchSyncCapabilities(baseUrl);
    assert.equal(res.ok, true);
    if (!res.ok) return;

    assert.equal(res.data.protocolVersion, 1);
    assert.equal(res.data.crdtAuthority, true);
    assert.equal(res.data.features.scopedMemory, true);
    assert.equal(res.data.features.exportChunks, true);

    const summary = summarizeAgentGraphPolicy();
    assert.ok(res.data.agentGraphPolicy.allowedOps.length > 0);
    assert.deepEqual(
      res.data.agentGraphPolicy.allowedOps.sort(),
      summary.allowedOps.sort(),
    );
  });
});
