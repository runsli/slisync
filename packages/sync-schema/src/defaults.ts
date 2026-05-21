import type { TraverseQuery } from "./types";

export const GRAPH_DOC_KEY = "graph" as const;

export const DEFAULT_TRAVERSE: TraverseQuery = {
  direction: "out",
  maxDepth: 3,
  maxNodes: 100,
  includeDeleted: false,
};

export const TRAVERSE_LIMITS = {
  maxDepth: 10,
  maxNodes: 500,
} as const;
