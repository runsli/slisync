import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAcceptsZipExport } from "@slisync/sync-server";

describe("parseAcceptsZipExport", () => {
  it("accepts application/zip", () => {
    assert.equal(parseAcceptsZipExport("application/zip"), true);
  });

  it("accepts zip with parameters", () => {
    assert.equal(parseAcceptsZipExport("application/zip;q=1"), true);
  });

  it("accepts zip among mixed types", () => {
    assert.equal(
      parseAcceptsZipExport("application/json, application/zip"),
      true,
    );
  });

  it("rejects json-only Accept", () => {
    assert.equal(parseAcceptsZipExport("application/json"), false);
  });

  it("rejects missing Accept", () => {
    assert.equal(parseAcceptsZipExport(undefined), false);
  });
});
