import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_AGENT_GRAPH_POLICY,
  validateGraphOps,
  type GraphOp,
} from "@slisync/sync-schema";
import { buildDemoTaskOps } from "@slisync/sync-sdk/graph";
import { loadAgentGraphPolicy } from "@slisync/sync-server";

const POLICY_ENV_KEYS = [
  "SYNC_AGENT_GRAPH_KINDS",
  "SYNC_AGENT_GRAPH_RELATIONS",
  "SYNC_AGENT_GRAPH_OPS",
  "SYNC_AGENT_MAX_GRAPH_OPS",
  "SYNC_AGENT_DENY_MEMORY",
] as const;

function savePolicyEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of POLICY_ENV_KEYS) {
    saved[key] = process.env[key];
  }
  return saved;
}

function restorePolicyEnv(saved: Record<string, string | undefined>): void {
  for (const key of POLICY_ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function forbiddenKindOps(): GraphOp[] {
  return [
    {
      op: "upsertNode",
      node: {
        id: "pref-1",
        kind: "user_preference",
        title: "blocked kind",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        createdBy: "test",
        updatedBy: "test",
        tags: [],
        refs: [],
      },
    },
  ];
}

describe("loadAgentGraphPolicy", () => {
  let savedEnv: Record<string, string | undefined>;

  afterEach(() => {
    restorePolicyEnv(savedEnv);
  });

  it("default policy allows demo task seed ops", () => {
    savedEnv = savePolicyEnv();
    for (const key of POLICY_ENV_KEYS) {
      delete process.env[key];
    }

    const policy = loadAgentGraphPolicy();
    const ops = buildDemoTaskOps("test-agent", "ws-demo", "sess-demo");
    const result = validateGraphOps(ops, policy);

    assert.equal(result.ok, true);
    assert.ok(policy.allowedNodeKinds.includes("task"));
    assert.ok(policy.allowedRelations.includes("depends_on"));
    assert.ok(policy.allowedRelations.includes("assigned_to"));
  });

  it("rejects disallowed node kinds with a readable error", () => {
    savedEnv = savePolicyEnv();
    process.env.SYNC_AGENT_GRAPH_KINDS = "workspace,session,memory_chunk";

    const policy = loadAgentGraphPolicy();
    const result = validateGraphOps(forbiddenKindOps(), policy);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /node kind not allowed: user_preference/);
  });

  it("falls back to schema default when env lists are empty", () => {
    savedEnv = savePolicyEnv();
    for (const key of POLICY_ENV_KEYS) {
      delete process.env[key];
    }

    const policy = loadAgentGraphPolicy();
    assert.deepEqual(
      [...policy.allowedNodeKinds].sort(),
      [...DEFAULT_AGENT_GRAPH_POLICY.allowedNodeKinds].sort(),
    );
    assert.deepEqual(
      [...policy.allowedRelations].sort(),
      [...DEFAULT_AGENT_GRAPH_POLICY.allowedRelations].sort(),
    );
  });
});
