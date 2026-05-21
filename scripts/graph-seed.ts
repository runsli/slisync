/**
 * Seed demo memory graph into a live room via agent push (CRDT sync).
 *
 * Usage:
 *   npm run dev          # terminal 1
 *   npm run graph:seed   # terminal 2
 */
import { pushAgentMemory } from "@slisync/sync-sdk/agent";
import {
  buildDemoGraphOps,
  buildScopedMemoryOps,
} from "@slisync/sync-sdk/graph";

const ROOM_ID = process.env.SYNC_ROOM ?? "example-room";
const AGENT_ID = process.env.SYNC_AGENT_ID ?? "example-agent";
/** Node CLI has no `window`; default matches `npm run dev` (Next + Socket on :3000). */
const SYNC_URL =
  process.env.SYNC_URL?.trim() ||
  process.env.NEXT_PUBLIC_SYNC_URL?.trim() ||
  "http://127.0.0.1:3000";
const USE_SCOPED = process.env.SYNC_GRAPH_SCOPED !== "0";
/** Aligns with Demo UI MemoryScopeBar defaults. */
const DEMO_WORKSPACE_ID = "ws-demo";
const DEMO_SESSION_ID = "sess-demo";

async function main() {
  console.log(`[graph:seed] sync=${SYNC_URL} room=${ROOM_ID}`);
  const graphOps = USE_SCOPED
    ? buildScopedMemoryOps(AGENT_ID, DEMO_WORKSPACE_ID, DEMO_SESSION_ID)
    : buildDemoGraphOps(AGENT_ID);

  const ack = await pushAgentMemory({
    url: SYNC_URL,
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    action: "seed_graph",
    graphOps,
  });

  if (!ack.ok) {
    console.error("[graph:seed] failed:", ack.error ?? "unknown");
    console.error(
      "[graph:seed] hint: start sync first — terminal 1: `npm run dev`",
    );
    console.error(
      "  or standalone: `npm run sync:server` then SYNC_URL=http://127.0.0.1:3001 npm run graph:seed",
    );
    process.exit(1);
  }

  console.log(
    `[graph:seed] ok room=${ROOM_ID} v=${ack.version} ${ack.entry?.summary ?? ""}`,
  );
}

main().catch((err) => {
  console.error("[graph:seed] error:", err);
  process.exit(1);
});
