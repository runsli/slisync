import * as Y from "yjs";

const SYNC_META_KEY = "syncMeta";

function getMetaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(SYNC_META_KEY);
}

export function initRoomMeta(doc: Y.Doc, version = 0) {
  const meta = getMetaMap(doc);
  if (!meta.has("version")) {
    meta.set("version", version);
  }
}

export function getRoomVersion(doc: Y.Doc): number {
  const raw = getMetaMap(doc).get("version");
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

/** Monotonic LWW-style version stored in the CRDT doc (single authority). */
export function bumpRoomVersion(doc: Y.Doc): number {
  const meta = getMetaMap(doc);
  const next = getRoomVersion(doc) + 1;
  meta.set("version", next);
  return next;
}
