import type { GraphOp } from "./ops";
import type { EdgeRelation, MemoryNodeKind } from "./types";

export type GraphOpName = GraphOp["op"];

export interface AgentGraphPolicy {
  /** Allowed edge relations for agent pushes. */
  allowedRelations: EdgeRelation[];
  /** Allowed node kinds for upsertNode. */
  allowedNodeKinds: MemoryNodeKind[];
  /** Allowed op types (delete* off by default for agents). */
  allowedOps: GraphOpName[];
  maxOpsPerPush: number;
  /** Reject legacy demo memory patch on agent push. */
  denyMemoryPatch: boolean;
}

export const DEFAULT_AGENT_GRAPH_POLICY: AgentGraphPolicy = {
  allowedRelations: [
    "related_to",
    "derived_from",
    "references",
    "contains",
    "depends_on",
    "assigned_to",
  ],
  allowedNodeKinds: [
    "project",
    "memory",
    "task",
    "file",
    "custom",
    "agent_run",
    "workspace",
    "session",
    "memory_chunk",
  ],
  allowedOps: ["upsertNode", "upsertEdge", "addTag", "addRef"],
  maxOpsPerPush: 50,
  denyMemoryPatch: true,
};

export type GraphOpsValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateGraphOps(
  ops: GraphOp[],
  policy: AgentGraphPolicy,
): GraphOpsValidationResult {
  if (ops.length === 0) {
    return { ok: false, error: "graphOps must not be empty" };
  }

  if (ops.length > policy.maxOpsPerPush) {
    return {
      ok: false,
      error: `graphOps exceeds maxOpsPerPush (${policy.maxOpsPerPush})`,
    };
  }

  for (const op of ops) {
    if (!policy.allowedOps.includes(op.op)) {
      return { ok: false, error: `op not allowed for agents: ${op.op}` };
    }

    switch (op.op) {
      case "upsertNode":
        if (!policy.allowedNodeKinds.includes(op.node.kind)) {
          return {
            ok: false,
            error: `node kind not allowed: ${op.node.kind}`,
          };
        }
        break;
      case "upsertEdge":
        if (!policy.allowedRelations.includes(op.edge.relation)) {
          return {
            ok: false,
            error: `relation not allowed: ${op.edge.relation}`,
          };
        }
        break;
      case "deleteNode":
      case "deleteEdge":
      case "removeTag":
      case "removeRef":
        break;
      default:
        break;
    }
  }

  return { ok: true };
}
