import type {
  EdgeRelation,
  MemoryEdge,
  MemoryNode,
  MemoryReference,
} from "./types";

export type GraphOp =
  | { op: "upsertNode"; node: MemoryNode }
  | { op: "deleteNode"; nodeId: string }
  | { op: "upsertEdge"; edge: MemoryEdge }
  | { op: "deleteEdge"; edgeId: string }
  | { op: "addTag"; scope: "node" | "edge"; targetId: string; tag: string }
  | { op: "removeTag"; scope: "node" | "edge"; targetId: string; tag: string }
  | { op: "addRef"; targetId: string; ref: MemoryReference }
  | { op: "removeRef"; targetId: string; refId: string };

export type GraphPatch = {
  ops: GraphOp[];
};

export function edgeIdFor(
  from: string,
  relation: EdgeRelation,
  to: string,
): string {
  return `${from}:${relation}:${to}`;
}
