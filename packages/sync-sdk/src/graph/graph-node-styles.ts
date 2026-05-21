/** Demo SVG fills per MemoryNodeKind. */
export const GRAPH_NODE_FILL: Record<string, string> = {
  workspace: "#cffafe",
  session: "#e0e7ff",
  memory_chunk: "#fce7f3",
  project: "#dbeafe",
  task: "#fef3c7",
  file: "#d1fae5",
  memory: "#ede9fe",
  agent_run: "#ffedd5",
  user_preference: "#f3e8ff",
  custom: "#f4f4f5",
};

export function fillForNodeKind(kind: string): string {
  return GRAPH_NODE_FILL[kind] ?? "#f4f4f5";
}
