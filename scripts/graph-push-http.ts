/**
 * Seed demo graph via HTTP (no Socket.IO) — for CI / Lambda / agents.
 *
 * Usage:
 *   npm run sync:server          # :3001
 *   npm run graph:push:http
 *
 * Integrated dev server:
 *   SYNC_HTTP_URL=http://localhost:3000 npm run graph:push:http
 */
import { buildDemoGraphOps, pushGraphOpsHttp } from "@slisync/sync-sdk/graph";

const ROOM_ID = process.env.SYNC_ROOM ?? "example-room";
const AGENT_ID = process.env.SYNC_AGENT_ID ?? "example-agent";
const BASE_URL = process.env.SYNC_HTTP_URL ?? process.env.SYNC_URL;

async function main() {
  const graphOps = buildDemoGraphOps(AGENT_ID);

  const result = await pushGraphOpsHttp({
    baseUrl: BASE_URL,
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    action: "seed_graph_http",
    graphOps,
    idempotencyKey: process.env.IDEMPOTENCY_KEY,
  });

  if (!result.ok) {
    console.error(
      `[graph:push:http] failed (${result.status ?? "?"}):`,
      result.error,
    );
    process.exit(1);
  }

  console.log(
    `[graph:push:http] ok room=${ROOM_ID} v=${result.version} ${result.summary}`,
  );
}

main().catch((err) => {
  console.error("[graph:push:http] error:", err);
  process.exit(1);
});
