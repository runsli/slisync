/**
 * Local smoke test for Memory Graph (no Socket.IO).
 * Run: npm run graph:smoke
 */
import * as Y from "yjs";
import { MemoryGraph } from "@slisync/sync-sdk/graph";

const doc = new Y.Doc();
const graph = MemoryGraph.on(doc, "smoke-agent").init("demo-graph", "Smoke graph");

const project = graph.upsertNode({
  kind: "project",
  title: "Infra sync",
  tags: ["team:infra"],
});

const task = graph.upsertNode({
  kind: "task",
  title: "Memory graph v1",
  data: { status: "in_progress" },
});

const file = graph.upsertNode({
  kind: "file",
  title: "graph-doc.ts",
  data: { path: "packages/sync-sdk/src/graph/graph-doc.ts" },
});

graph.link(project.id, task.id, "contains");
graph.link(task.id, file.id, "references");
graph.link(project.id, file.id, "related_to", {
  semantic: { reason: "primary implementation file", confidence: 0.9 },
});

const walk = graph.traverse(project.id, {
  direction: "out",
  maxDepth: 3,
  relations: ["contains", "references", "related_to"],
});

console.log("[graph:smoke] project:", project.id);
console.log("[graph:smoke] nodes:", walk.nodes.map((n) => `${n.kind}:${n.title}`));
console.log("[graph:smoke] edges:", walk.edges.map((e) => `${e.relation} ${e.from}→${e.to}`));
console.log("[graph:smoke] truncated:", walk.truncated);

const snap = graph.snapshot();
console.log("[graph:smoke] snapshot counts:", snap?.nodes.length, snap?.edges.length);
