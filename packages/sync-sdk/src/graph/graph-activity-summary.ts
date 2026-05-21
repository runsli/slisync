import type { GraphOp } from "@slisync/sync-schema";
import { summarizeGraphOps } from "./apply-graph-ops";

/** Human-readable one-line summary for graph activity toasts. */
export function buildGraphActivitySummary(ops: GraphOp[]): string {
  const base = summarizeGraphOps(ops);
  const titles = ops
    .filter((op): op is Extract<GraphOp, { op: "upsertNode" }> => op.op === "upsertNode")
    .map((op) => op.node.title)
    .slice(0, 3);

  if (titles.length === 0) return base;
  return `${base} — ${titles.join(", ")}`;
}
