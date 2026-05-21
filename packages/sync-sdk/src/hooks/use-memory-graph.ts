"use client";

import { useEffect, useMemo, useState } from "react";
import type { MemoryGraphSnapshot } from "@slisync/sync-schema";
import type * as Y from "yjs";
import { ensureMemoryGraphDoc } from "../graph/ensure-graph";
import { MemoryGraph } from "../graph/memory-graph";
import { observeMemoryGraph } from "../graph/observe-graph";

export type UseMemoryGraphOptions = {
  graphId: string;
  actorId: string;
  syncReady: boolean;
  getDocument: () => Y.Doc | null;
};

export function useMemoryGraph(options: UseMemoryGraphOptions) {
  const { graphId, actorId, syncReady, getDocument } = options;
  const [snapshot, setSnapshot] = useState<MemoryGraphSnapshot | null>(null);
  const doc = syncReady ? getDocument() : null;

  const graph = useMemo(() => {
    if (!doc) return null;
    ensureMemoryGraphDoc(doc, graphId);
    return MemoryGraph.on(doc, actorId);
  }, [doc, graphId, actorId]);

  useEffect(() => {
    if (!doc) {
      setSnapshot(null);
      return;
    }

    ensureMemoryGraphDoc(doc, graphId);
    return observeMemoryGraph(doc, setSnapshot);
  }, [doc, graphId]);

  return {
    graph,
    snapshot,
    ready: syncReady && graph != null,
  };
}
