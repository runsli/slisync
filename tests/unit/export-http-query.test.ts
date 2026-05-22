import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseExportChunksQueryParams } from "@slisync/sync-server";

describe("parseExportChunksQueryParams", () => {
  it("parses workspaceId and sessionId", () => {
    const params = new URLSearchParams({
      workspaceId: "ws-demo",
      sessionId: "sess-demo",
    });
    assert.deepEqual(parseExportChunksQueryParams(params), {
      workspaceId: "ws-demo",
      sessionId: "sess-demo",
    });
  });

  it("parses finite minImportance", () => {
    const params = new URLSearchParams({ minImportance: "0.75" });
    assert.deepEqual(parseExportChunksQueryParams(params), {
      minImportance: 0.75,
    });
  });

  it("omits non-finite minImportance", () => {
    assert.deepEqual(
      parseExportChunksQueryParams(new URLSearchParams({ minImportance: "abc" })),
      {},
    );
    assert.deepEqual(
      parseExportChunksQueryParams(new URLSearchParams({ minImportance: "" })),
      {},
    );
  });

  it("parses includeDeleted booleans", () => {
    assert.deepEqual(
      parseExportChunksQueryParams(new URLSearchParams({ includeDeleted: "true" })),
      { includeDeleted: true },
    );
    assert.deepEqual(
      parseExportChunksQueryParams(new URLSearchParams({ includeDeleted: "0" })),
      { includeDeleted: false },
    );
  });
});
