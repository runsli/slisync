import * as Y from "yjs";
import type { AgentMemoryEntry } from "./types";

const ROOT_KEY = "root";
const MAX_LOG = 20;

function getAgentLogArray(doc: Y.Doc): Y.Array<AgentMemoryEntry> {
  const root = doc.getMap(ROOT_KEY);
  let log = root.get("agentLog") as Y.Array<AgentMemoryEntry> | undefined;
  if (!log) {
    log = new Y.Array<AgentMemoryEntry>();
    root.set("agentLog", log);
  }
  return log;
}

export function appendAgentLogEntry(doc: Y.Doc, entry: AgentMemoryEntry) {
  doc.transact(() => {
    const log = getAgentLogArray(doc);
    log.push([entry]);
    while (log.length > MAX_LOG) {
      log.delete(0, 1);
    }
  });
}
