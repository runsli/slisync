import * as Y from "yjs";
import type { MemoryNode, MemoryReference } from "@slisync/sync-schema";

function parseJson<T>(raw: unknown): T | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function readNodeFromYMap(ymap: Y.Map<unknown>): MemoryNode | null {
  if (ymap.get("deletedAt")) {
    const deletedAt = String(ymap.get("deletedAt"));
    if (deletedAt) {
      /* still readable when includeDeleted */
    }
  }

  const id = ymap.get("id");
  const kind = ymap.get("kind");
  const title = ymap.get("title");
  if (typeof id !== "string" || typeof kind !== "string" || typeof title !== "string") {
    return null;
  }

  const bodyText = ymap.get("body") as Y.Text | undefined;
  const tagsArr = ymap.get("tags") as Y.Array<string> | undefined;
  const refsArr = ymap.get("refs") as Y.Array<string> | undefined;

  const node: MemoryNode = {
    id,
    kind: kind as MemoryNode["kind"],
    title,
    createdAt: String(ymap.get("createdAt") ?? ""),
    updatedAt: String(ymap.get("updatedAt") ?? ""),
    createdBy: String(ymap.get("createdBy") ?? ""),
    updatedBy: String(ymap.get("updatedBy") ?? ""),
    tags: tagsArr?.toArray() ?? [],
    refs: (refsArr?.toArray() ?? [])
      .map((s) => parseJson<MemoryReference>(s))
      .filter((r): r is MemoryReference => r != null),
  };

  if (bodyText) node.body = bodyText.toString();
  const data = parseJson<Record<string, unknown>>(ymap.get("dataJson"));
  if (data) node.data = data;
  const rank = ymap.get("rank");
  if (typeof rank === "number") node.rank = rank;
  const deletedAt = ymap.get("deletedAt");
  if (typeof deletedAt === "string" && deletedAt) node.deletedAt = deletedAt;

  return node;
}

export function writeNodeToYMap(ymap: Y.Map<unknown>, node: MemoryNode) {
  ymap.set("id", node.id);
  ymap.set("kind", node.kind);
  ymap.set("title", node.title);
  ymap.set("createdAt", node.createdAt);
  ymap.set("updatedAt", node.updatedAt);
  ymap.set("createdBy", node.createdBy);
  ymap.set("updatedBy", node.updatedBy);

  let tagsArr = ymap.get("tags") as Y.Array<string> | undefined;
  if (!tagsArr) {
    tagsArr = new Y.Array<string>();
    ymap.set("tags", tagsArr);
  }
  tagsArr.delete(0, tagsArr.length);
  if (node.tags.length > 0) tagsArr.push(node.tags);

  let refsArr = ymap.get("refs") as Y.Array<string> | undefined;
  if (!refsArr) {
    refsArr = new Y.Array<string>();
    ymap.set("refs", refsArr);
  }
  refsArr.delete(0, refsArr.length);
  if (node.refs.length > 0) {
    refsArr.push(node.refs.map((r) => JSON.stringify(r)));
  }

  if (node.body !== undefined) {
    let bodyText = ymap.get("body") as Y.Text | undefined;
    if (!bodyText) {
      bodyText = new Y.Text();
      ymap.set("body", bodyText);
    }
    const current = bodyText.toString();
    if (current !== node.body) {
      bodyText.delete(0, current.length);
      if (node.body.length > 0) bodyText.insert(0, node.body);
    }
  }

  if (node.data !== undefined) {
    ymap.set("dataJson", JSON.stringify(node.data));
  } else {
    ymap.delete("dataJson");
  }

  if (node.rank !== undefined) ymap.set("rank", node.rank);
  else ymap.delete("rank");

  if (node.deletedAt) ymap.set("deletedAt", node.deletedAt);
  else ymap.delete("deletedAt");
}
