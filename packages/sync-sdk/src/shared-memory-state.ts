import type { AgentMemoryEntry } from "./agent/types";

/** Demo / SDK default shared document shape. */
export type SharedMemoryState = {
  message: string;
  counter: number;
  agentLog?: AgentMemoryEntry[];
};
