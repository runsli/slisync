import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendExportChunksQuery,
  buildExportChunksHttpUrl,
} from "@slisync/sync-sdk/graph";

describe("buildExportChunksHttpUrl", () => {
  it("builds v1 export path without query", () => {
    const url = buildExportChunksHttpUrl("http://127.0.0.1:3000", "example-room");
    assert.equal(url, "http://127.0.0.1:3000/v1/rooms/example-room/export/chunks");
  });

  it("encodes room id and appends filters", () => {
    const params = new URLSearchParams();
    appendExportChunksQuery(params, {
      workspaceId: "ws-demo",
      sessionId: "sess-demo",
      minImportance: 0.5,
      includeDeleted: false,
    });
    const url = buildExportChunksHttpUrl("http://localhost:3001/", "room/a", {
      workspaceId: "ws-demo",
      sessionId: "sess-demo",
      minImportance: 0.5,
      includeDeleted: false,
    });
    assert.equal(
      url,
      `http://localhost:3001/v1/rooms/room%2Fa/export/chunks?${params}`,
    );
  });

  it("omits empty query string", () => {
    const url = buildExportChunksHttpUrl("http://x/", "r");
    assert.ok(!url.includes("?"));
  });
});
