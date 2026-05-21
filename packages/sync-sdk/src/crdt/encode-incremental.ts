import * as Y from "yjs";

/** Encode only changes since `stateVector` (empty = full snapshot). */
export function encodeIncrementalUpdate(
  doc: Y.Doc,
  stateVector?: Uint8Array,
): Uint8Array {
  if (stateVector && stateVector.length > 0) {
    return Y.encodeStateAsUpdate(doc, stateVector);
  }
  return Y.encodeStateAsUpdate(doc);
}

export function captureStateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}
