import {
  DEFAULT_AGENT_GRAPH_POLICY,
  type AgentGraphPolicy,
  type EdgeRelation,
  type GraphOpName,
  type MemoryNodeKind,
} from "@slisync/sync-schema";

function splitList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadAgentGraphPolicy(): AgentGraphPolicy {
  const relations = splitList(process.env.SYNC_AGENT_GRAPH_RELATIONS);
  const kinds = splitList(process.env.SYNC_AGENT_GRAPH_KINDS);
  const ops = splitList(process.env.SYNC_AGENT_GRAPH_OPS);
  const maxOps = Number(process.env.SYNC_AGENT_MAX_GRAPH_OPS ?? "");
  const denyMemory =
    process.env.SYNC_AGENT_DENY_MEMORY === "1" ||
    process.env.SYNC_AGENT_DENY_MEMORY === "true";

  return {
    allowedRelations: (relations.length > 0
      ? relations
      : DEFAULT_AGENT_GRAPH_POLICY.allowedRelations) as EdgeRelation[],
    allowedNodeKinds: (kinds.length > 0
      ? kinds
      : DEFAULT_AGENT_GRAPH_POLICY.allowedNodeKinds) as MemoryNodeKind[],
    allowedOps: (ops.length > 0
      ? ops
      : DEFAULT_AGENT_GRAPH_POLICY.allowedOps) as GraphOpName[],
    maxOpsPerPush:
      Number.isFinite(maxOps) && maxOps > 0
        ? maxOps
        : DEFAULT_AGENT_GRAPH_POLICY.maxOpsPerPush,
    denyMemoryPatch: denyMemory || DEFAULT_AGENT_GRAPH_POLICY.denyMemoryPatch,
  };
}
