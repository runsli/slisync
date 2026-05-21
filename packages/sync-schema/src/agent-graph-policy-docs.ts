import type { AgentGraphPolicy } from "./agent-graph-policy";
import { DEFAULT_AGENT_GRAPH_POLICY } from "./agent-graph-policy";
import type { GraphOpName } from "./agent-graph-policy";
import type { EdgeRelation, MemoryNodeKind } from "./types";

export const ALL_AGENT_GRAPH_OPS: GraphOpName[] = [
  "upsertNode",
  "upsertEdge",
  "deleteNode",
  "deleteEdge",
  "addTag",
  "removeTag",
  "addRef",
  "removeRef",
];

export const ALL_MEMORY_NODE_KINDS: MemoryNodeKind[] = [
  "workspace",
  "session",
  "memory_chunk",
  "project",
  "task",
  "file",
  "memory",
  "user_preference",
  "agent_run",
  "custom",
];

export const ALL_EDGE_RELATIONS: EdgeRelation[] = [
  "contains",
  "depends_on",
  "references",
  "derived_from",
  "related_to",
  "assigned_to",
  "prefers",
  "custom",
];

export type AgentGraphPolicySummary = {
  allowedRelations: string[];
  allowedNodeKinds: string[];
  allowedOps: string[];
  maxOpsPerPush: number;
  denyMemoryPatch: boolean;
  deniedOps: string[];
  deniedNodeKinds: string[];
  deniedRelations: string[];
};

export function summarizeAgentGraphPolicy(
  policy: AgentGraphPolicy = DEFAULT_AGENT_GRAPH_POLICY,
): AgentGraphPolicySummary {
  const allowedOps = new Set(policy.allowedOps);
  const allowedKinds = new Set(policy.allowedNodeKinds);
  const allowedRelations = new Set(policy.allowedRelations);

  return {
    allowedRelations: [...policy.allowedRelations],
    allowedNodeKinds: [...policy.allowedNodeKinds],
    allowedOps: [...policy.allowedOps],
    maxOpsPerPush: policy.maxOpsPerPush,
    denyMemoryPatch: policy.denyMemoryPatch,
    deniedOps: ALL_AGENT_GRAPH_OPS.filter((op) => !allowedOps.has(op)),
    deniedNodeKinds: ALL_MEMORY_NODE_KINDS.filter((k) => !allowedKinds.has(k)),
    deniedRelations: ALL_EDGE_RELATIONS.filter((r) => !allowedRelations.has(r)),
  };
}
