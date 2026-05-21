import type { SharedMemoryState } from "../shared-memory-state";
import type { AgentMemoryEntry, AgentMemoryPatch } from "./types";

const MAX_LOG = 20;

export function buildAgentSummary(
  memory: AgentMemoryPatch,
  prev: SharedMemoryState,
): string {
  const parts: string[] = [];
  if (memory.message !== undefined) parts.push(`message→${memory.message}`);
  if (memory.appendToMessage) parts.push(`append「${memory.appendToMessage}」`);
  if (memory.counterDelta) {
    parts.push(`counter ${prev.counter}→${prev.counter + memory.counterDelta}`);
  }
  return parts.join(", ") || "no-op";
}

export function applyAgentMemoryToState(
  state: SharedMemoryState,
  input: { agentId: string; action: string; memory: AgentMemoryPatch },
): { next: SharedMemoryState; entry: AgentMemoryEntry } {
  const { agentId, action, memory } = input;
  const next: SharedMemoryState = {
    ...state,
    agentLog: [...(state.agentLog ?? [])],
  };

  if (memory.message !== undefined) next.message = memory.message;
  if (memory.appendToMessage) {
    next.message = `${state.message}${memory.appendToMessage}`;
  }
  if (memory.counterDelta !== undefined) {
    next.counter = state.counter + memory.counterDelta;
  }

  const entry: AgentMemoryEntry = {
    agentId,
    action,
    summary: buildAgentSummary(memory, state),
    at: Date.now(),
  };

  next.agentLog = [...(state.agentLog ?? []), entry].slice(-MAX_LOG);
  return { next, entry };
}
