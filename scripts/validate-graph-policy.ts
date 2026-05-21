import {
  summarizeAgentGraphPolicy,
  validateGraphOps,
  DEFAULT_AGENT_GRAPH_POLICY,
} from "@slisync/sync-schema";
import { buildDemoGraphOps, buildScopedMemoryOps } from "@slisync/sync-sdk/graph";

const summary = summarizeAgentGraphPolicy(DEFAULT_AGENT_GRAPH_POLICY);
console.log("[policy] default agent policy:", JSON.stringify(summary, null, 2));

for (const [label, ops] of [
  ["demo", buildDemoGraphOps("test-agent")],
  ["scoped", buildScopedMemoryOps("test-agent")],
] as const) {
  const result = validateGraphOps(ops, DEFAULT_AGENT_GRAPH_POLICY);
  if (!result.ok) {
    console.error(`[policy] FAIL (${label}):`, result.error);
    process.exit(1);
  }
  console.log(`[policy] ${label} graph ops pass`);
}
