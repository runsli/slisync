import * as Y from "yjs";
import { initMemoryGraphDoc, readGraphMeta } from "./graph-doc";

export function ensureMemoryGraphDoc(doc: Y.Doc, graphId: string, title?: string) {
  if (!readGraphMeta(doc)) {
    initMemoryGraphDoc(doc, graphId, title);
  }
}
