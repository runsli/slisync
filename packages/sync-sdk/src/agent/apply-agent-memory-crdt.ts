import * as Y from "yjs";
import {
  adjustCounter,
  readSharedMemoryState,
  updateMessage,
} from "../crdt/shared-memory-doc";
import { applyAgentMemoryToState } from "./apply-agent-memory";
import { appendAgentLogEntry } from "./append-agent-log";
import type { AgentMemoryEntry, AgentMemoryPatch } from "./types";

/** Apply agent patch to Y.Doc and append activity log. */
export function applyAgentMemoryToDoc(
  doc: Y.Doc,
  input: {
    agentId: string;
    action: string;
    memory: AgentMemoryPatch;
  },
): AgentMemoryEntry {
  const prev = readSharedMemoryState(doc);
  const { next, entry } = applyAgentMemoryToState(prev, input);

  doc.transact(() => {
    if (next.message !== prev.message) {
      updateMessage(doc, prev.message, next.message);
    }
    if (next.counter !== prev.counter) {
      adjustCounter(doc, input.agentId, next.counter - prev.counter);
    }
    appendAgentLogEntry(doc, entry);
  });

  return entry;
}
