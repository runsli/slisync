/** AI Memory Graph — shared schema (v1). */

import type { MemoryScope } from "./memory-model";

export const SCHEMA_VERSION = 1 as const;

export type ISOTime = string;
export type ActorId = string;

export type MemoryNodeKind =
  | "project"
  | "task"
  | "file"
  | "user_preference"
  | "memory"
  | "agent_run"
  | "workspace"
  | "session"
  | "memory_chunk"
  | "custom";

export type EdgeRelation =
  | "contains"
  | "depends_on"
  | "references"
  | "derived_from"
  | "related_to"
  | "assigned_to"
  | "prefers"
  | "custom";

export interface GraphMeta {
  schemaVersion: typeof SCHEMA_VERSION;
  graphId: string;
  title?: string;
  updatedAt: ISOTime;
}

export type ReferenceTarget =
  | { type: "node"; graphId: string; nodeId: string }
  | { type: "url"; href: string }
  | { type: "file"; path: string; revision?: string }
  | { type: "cursor_session"; sessionId: string };

export interface MemoryReference {
  id: string;
  target: ReferenceTarget;
  label?: string;
  role?: "cites" | "implements" | "see_also";
}

export interface BaseEntity {
  id: string;
  kind: string;
  createdAt: ISOTime;
  updatedAt: ISOTime;
  createdBy: ActorId;
  updatedBy: ActorId;
  tags: string[];
  refs: MemoryReference[];
  deletedAt?: ISOTime;
}

export interface MemoryNode extends BaseEntity {
  kind: MemoryNodeKind;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  rank?: number;
}

export interface MemoryEdgeSemantic {
  reason?: string;
  confidence?: number;
  declaredBy: ActorId;
}

export interface MemoryEdge extends BaseEntity {
  kind: "edge";
  relation: EdgeRelation;
  from: string;
  to: string;
  semantic?: MemoryEdgeSemantic;
  unique?: boolean;
}

export interface MemoryGraphSnapshot {
  meta: GraphMeta;
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

export type TraverseDirection = "out" | "in" | "both";

export interface TraverseQuery {
  direction: TraverseDirection;
  relations?: EdgeRelation[];
  maxDepth: number;
  maxNodes: number;
  includeDeleted?: boolean;
  tagFilter?: string[];
  kinds?: MemoryNodeKind[];
  /** Optional: filter workspace/session/chunk nodes by scope. */
  scopeFilter?: Partial<MemoryScope>;
}

export interface TraverseResult {
  rootId: string;
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  truncated: boolean;
}

export interface LinkOptions {
  edgeId?: string;
  semantic?: Omit<MemoryEdgeSemantic, "declaredBy"> & { declaredBy?: ActorId };
  unique?: boolean;
  tags?: string[];
}

export type UpsertNodeInput = {
  id?: string;
  kind: MemoryNodeKind;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  rank?: number;
  tags?: string[];
  refs?: MemoryReference[];
  createdBy?: ActorId;
};
