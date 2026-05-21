import * as Y from "yjs";
import type { MemoryEdge, MemoryEdgeSemantic } from "@slisync/sync-schema";

function parseSemantic(raw: unknown): MemoryEdgeSemantic | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    return JSON.parse(raw) as MemoryEdgeSemantic;
  } catch {
    return undefined;
  }
}

export function readEdgeFromYMap(ymap: Y.Map<unknown>): MemoryEdge | null {
  const id = ymap.get("id");
  const relation = ymap.get("relation");
  const from = ymap.get("from");
  const to = ymap.get("to");
  if (
    typeof id !== "string" ||
    typeof relation !== "string" ||
    typeof from !== "string" ||
    typeof to !== "string"
  ) {
    return null;
  }

  const edge: MemoryEdge = {
    id,
    kind: "edge",
    relation: relation as MemoryEdge["relation"],
    from,
    to,
    createdAt: String(ymap.get("createdAt") ?? ""),
    updatedAt: String(ymap.get("updatedAt") ?? ""),
    createdBy: String(ymap.get("createdBy") ?? ""),
    updatedBy: String(ymap.get("updatedBy") ?? ""),
    tags: [],
    refs: [],
  };

  const tagsArr = ymap.get("tags") as Y.Array<string> | undefined;
  if (tagsArr) edge.tags = tagsArr.toArray();

  const semantic = parseSemantic(ymap.get("semanticJson"));
  if (semantic) edge.semantic = semantic;

  if (ymap.get("unique") === true) edge.unique = true;

  const deletedAt = ymap.get("deletedAt");
  if (typeof deletedAt === "string" && deletedAt) edge.deletedAt = deletedAt;

  return edge;
}

export function writeEdgeToYMap(ymap: Y.Map<unknown>, edge: MemoryEdge) {
  ymap.set("id", edge.id);
  ymap.set("kind", "edge");
  ymap.set("relation", edge.relation);
  ymap.set("from", edge.from);
  ymap.set("to", edge.to);
  ymap.set("createdAt", edge.createdAt);
  ymap.set("updatedAt", edge.updatedAt);
  ymap.set("createdBy", edge.createdBy);
  ymap.set("updatedBy", edge.updatedBy);

  let tagsArr = ymap.get("tags") as Y.Array<string> | undefined;
  if (!tagsArr) {
    tagsArr = new Y.Array<string>();
    ymap.set("tags", tagsArr);
  }
  tagsArr.delete(0, tagsArr.length);
  if (edge.tags.length > 0) tagsArr.push(edge.tags);

  if (edge.semantic) {
    ymap.set("semanticJson", JSON.stringify(edge.semantic));
  } else {
    ymap.delete("semanticJson");
  }

  if (edge.unique) ymap.set("unique", true);
  else ymap.delete("unique");

  if (edge.deletedAt) ymap.set("deletedAt", edge.deletedAt);
  else ymap.delete("deletedAt");
}
