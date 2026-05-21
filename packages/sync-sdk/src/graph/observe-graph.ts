import * as Y from "yjs";
import type { MemoryGraphSnapshot } from "@slisync/sync-schema";
import { getGraphRoot, readMemoryGraphSnapshot } from "./graph-doc";

export function observeMemoryGraph(
  doc: Y.Doc,
  onChange: (snapshot: MemoryGraphSnapshot | null) => void,
): () => void {
  const root = getGraphRoot(doc);
  const handler = () => onChange(readMemoryGraphSnapshot(doc));
  root.observeDeep(handler);
  handler();
  return () => root.unobserveDeep(handler);
}
