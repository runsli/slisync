import * as Y from "yjs";
import type { ActorId, GraphOp } from "@slisync/sync-schema";
import {
  applyLinkEdgeToDoc,
  applyUpsertNodeToDoc,
  getEdgeFromDoc,
  getNodeFromDoc,
  nowIso,
} from "./graph-doc";
import { readEdgeFromYMap, writeEdgeToYMap } from "./y-edge";
import { readNodeFromYMap, writeNodeToYMap } from "./y-node";
import { getGraphRoot, getEdgesMap, getNodesMap } from "./graph-doc";

function softDeleteNode(doc: Y.Doc, nodeId: string, actorId: ActorId) {
  const root = getGraphRoot(doc);
  const nodesMap = getNodesMap(root);
  const ymap = nodesMap.get(nodeId);
  if (!ymap) return;
  const node = readNodeFromYMap(ymap);
  if (!node) return;
  node.deletedAt = nowIso();
  node.updatedAt = node.deletedAt;
  node.updatedBy = actorId;
  writeNodeToYMap(ymap, node);
}

function softDeleteEdge(doc: Y.Doc, edgeId: string, actorId: ActorId) {
  const root = getGraphRoot(doc);
  const edgesMap = getEdgesMap(root);
  const ymap = edgesMap.get(edgeId);
  if (!ymap) return;
  const edge = readEdgeFromYMap(ymap);
  if (!edge) return;
  edge.deletedAt = nowIso();
  edge.updatedAt = edge.deletedAt;
  edge.updatedBy = actorId;
  writeEdgeToYMap(ymap, edge);
}

/** Apply batch graph operations inside one Yjs transaction. */
export function applyGraphOps(
  doc: Y.Doc,
  ops: GraphOp[],
  actorId: ActorId = "system",
) {
  if (ops.length === 0) return;

  doc.transact(() => {
    for (const op of ops) {
      switch (op.op) {
        case "upsertNode":
          applyUpsertNodeToDoc(doc, {
            ...op.node,
            updatedBy: op.node.updatedBy || actorId,
          });
          break;
        case "deleteNode":
          softDeleteNode(doc, op.nodeId, actorId);
          break;
        case "upsertEdge":
          applyLinkEdgeToDoc(doc, {
            ...op.edge,
            updatedBy: op.edge.updatedBy || actorId,
          });
          break;
        case "deleteEdge":
          softDeleteEdge(doc, op.edgeId, actorId);
          break;
        case "addTag": {
          const node =
            op.scope === "node"
              ? getNodeFromDoc(doc, op.targetId, true)
              : null;
          const edge =
            op.scope === "edge"
              ? getEdgeFromDoc(doc, op.targetId, true)
              : null;
          const entity = node ?? edge;
          if (!entity) break;
          if (!entity.tags.includes(op.tag)) {
            entity.tags = [...entity.tags, op.tag];
            entity.updatedAt = nowIso();
            entity.updatedBy = actorId;
            if (node) applyUpsertNodeToDoc(doc, node);
            else if (edge) applyLinkEdgeToDoc(doc, edge);
          }
          break;
        }
        case "removeTag": {
          const node =
            op.scope === "node"
              ? getNodeFromDoc(doc, op.targetId, true)
              : null;
          const edge =
            op.scope === "edge"
              ? getEdgeFromDoc(doc, op.targetId, true)
              : null;
          const entity = node ?? edge;
          if (!entity) break;
          entity.tags = entity.tags.filter((t) => t !== op.tag);
          entity.updatedAt = nowIso();
          entity.updatedBy = actorId;
          if (node) applyUpsertNodeToDoc(doc, node);
          else if (edge) applyLinkEdgeToDoc(doc, edge);
          break;
        }
        default:
          break;
      }
    }
  });
}

export function summarizeGraphOps(ops: GraphOp[]): string {
  const counts = new Map<string, number>();
  for (const op of ops) {
    counts.set(op.op, (counts.get(op.op) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([k, n]) => `${k}×${n}`)
    .join(", ");
}
