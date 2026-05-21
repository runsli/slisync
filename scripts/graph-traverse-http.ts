/**
 * Read-only graph traverse via HTTP (no Socket.IO).
 *
 * Usage:
 *   npm run sync:server
 *   npm run graph:seed
 *   npm run graph:traverse:http -- --start <nodeId>
 */
import { buildDemoGraphOps, fetchGraphTraverseHttp } from "@slisync/sync-sdk/graph";

const argv = process.argv;
const ROOM_ID = process.env.SYNC_ROOM ?? "example-room";
const START_ID =
  argv.find((a, i) => argv[i - 1] === "--start" && a) ?? process.env.GRAPH_START_ID;

async function main() {
  let startId = START_ID;

  if (!startId) {
    const ops = buildDemoGraphOps(process.env.SYNC_AGENT_ID ?? "example-agent");
    const project = ops.find(
      (op): op is Extract<typeof op, { op: "upsertNode" }> =>
        op.op === "upsertNode" && op.node.kind === "project",
    );
    if (!project) {
      console.error(
        "[graph:traverse:http] pass --start <nodeId> or GRAPH_START_ID (seed the room first)",
      );
      process.exit(1);
    }
    startId = project.node.id;
    console.warn(
      `[graph:traverse:http] no --start; using demo project id from buildDemoGraphOps (seed must match): ${startId}`,
    );
  }

  const result = await fetchGraphTraverseHttp({
    roomId: ROOM_ID,
    startId,
    query: {
      direction: "out",
      maxDepth: 3,
      relations: ["contains", "references", "related_to"],
    },
  });

  if (!result.ok) {
    console.error("[graph:traverse:http] failed:", result.error, result.status ?? "");
    process.exit(1);
  }

  const { nodes, edges, truncated } = result.result;
  console.log(`[graph:traverse:http] room=${ROOM_ID} root=${result.result.rootId}`);
  console.log(
    "nodes:",
    nodes.map((n) => `${n.kind}:${n.title}`).join(", "),
  );
  console.log(
    "edges:",
    edges.map((e) => `${e.relation} ${e.from}→${e.to}`).join(", "),
  );
  console.log("truncated:", truncated);
}

main().catch((err) => {
  console.error("[graph:traverse:http] error:", err);
  process.exit(1);
});
