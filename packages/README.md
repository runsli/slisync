# Slisync — Technical documentation

[中文](./README.zh-CN.md) · Product: [docs/en/VISION.md](../docs/en/VISION.md)

npm workspace **`@slisync/*`** implements **Slisync** (room realtime sync + Memory Graph + export to Aonote).

| Doc | Audience |
|-----|----------|
| [docs/en/VISION.md](../docs/en/VISION.md) | Product vision (English) |
| [docs/zh/VISION.md](../docs/zh/VISION.md) | 产品愿景（中文） |
| [docs/en/ROADMAP.md](../docs/en/ROADMAP.md) | Roadmap |
| [README.md](../README.md) | Quick start |

---

## Packages

| Package | Role |
|---------|------|
| `@slisync/sync-schema` | Graph + wire types, `GraphOp`, traverse, auth, agent policy, `protocolVersion` |
| `@slisync/sync-sdk` | Client: hooks, Zustand, LWW + CRDT, `MemoryGraph`, HTTP helpers |
| `@slisync/sync-server` | Socket.IO, LWW rooms, Yjs CRDT, persistence, Graph HTTP, Presence |

```bash
# Dev: workspace resolves TypeScript sources (exports → src/)
# Release: npm run build:packages → dist/
```

---

## Engineering phases

Engineering IDs used in commits and comments. Product [12-phase vision](../docs/en/ROADMAP.md) is tracked separately.

| ID | Status | Deliverables |
|----|--------|--------------|
| **1** | ✅ | Rooms, `sync:join` / `sync:state`, demo `message` + `counter` |
| **2** | ✅ | `sync:patch` (RFC 6902) |
| **3** | ✅ | `createPersistence()`: memory, `.sync-data/` JSON, `REDIS_URL` |
| **4** | ✅ | LWW `baseVersion`, `sync:conflict` |
| **5** | ✅ | `@slisync/sync-sdk`, `@slisync/sync-server`; `server.ts` or `:3001` |
| **6** | ✅ | `sync:agent-push`, `sync:agent-activity` |
| **7** | ✅ | Yjs `graph/`, `MemoryGraph`, `graphOps` |
| **8** | ✅ | `SYNC_*` auth, `validateGraphOps`, `sync:error` |
| **9** | ✅ | `sync:graph-activity`, server CRDT graph diff, SVG viz |
| **10** | ✅ | Graph HTTP POST/GET, SDK HTTP helpers |
| **11** | ✅ | `npm test` (24 cases) |
| **P0** | ✅ | `protocolVersion` v1, Redis Socket adapter, `build:packages` |
| **P1** | ✅ | CRDT authority, incremental agent CRDT, audit trail |
| **P2** | ✅ | `workspace`/`session`/`memory_chunk`, Presence, CRDT outbox |
| **P3** | ✅ | Force-directed layout, strategy panel, `GET /v1/sync/capabilities` |

**Out of scope:** vector DB, embeddings, reasoning (vision phase 9).

---

## Running the server

### Standalone

```bash
npm run sync:server
npm run sync:server:dev   # watch
```

- `GET /health` → `{ ok, protocolVersion, socketRedisAdapter, capabilitiesPath }`
- `GET /v1/sync/capabilities`
- Default port `3001` (`SYNC_PORT`)

### Embedded in Next

```bash
npm run dev
NEXT_PUBLIC_SYNC_URL=http://localhost:3001 npm run dev
```

---

## Protocol version (P0)

Wire protocol **`1`** (`SYNC_PROTOCOL_VERSION`).

| Surface | Client |
|---------|--------|
| Socket `sync:crdt-join`, `sync:join`, `sync:agent-push` | `protocolVersion: 1` |
| HTTP graph / audit | Header `X-Sync-Protocol-Version: 1` |

Unsupported version → `sync:error` / HTTP `incompatible_protocol`.

SDK: `fetchSyncCapabilities()` — feature flags and effective `agentGraphPolicy` (after env overrides).

---

## Redis cluster (P0)

With `REDIS_URL`, attaches `@socket.io/redis-adapter`:

```bash
npm run redis:up
REDIS_URL=redis://localhost:6379 npm run sync:server
REDIS_URL=redis://localhost:6379 npm run test:cluster
```

`SYNC_SOCKET_ADAPTER=0` disables the adapter while keeping Redis persistence.

---

## npm publish (P0)

```bash
npm run build:packages
npm publish -w @slisync/sync-schema --access public
npm publish -w @slisync/sync-sdk --access public
npm publish -w @slisync/sync-server --access public
```

---

## CRDT authority & audit (P1)

- **Source of truth:** Yjs room doc (`root` + `graph/` + `syncMeta.version`)
- Agent / LWW bridge writes CRDT; incremental `encodeStateAsUpdate(doc, stateVectorBefore)`
- `GET /v1/rooms/:roomId/audit?limit=50` → `.sync-data/audit.jsonl` (`SYNC_AUDIT_PATH`)
- SDK: `fetchAuditHttp()`

---

## Agent push (Phase 6)

```bash
npm run agent:push
npm run agent:push -- --action summarize --append " [from agent]"
```

```ts
import { pushAgentMemory } from "@slisync/sync-sdk/agent";
```

Optional `graphOps`; server `commit-agent-write` updates CRDT and broadcasts activity events.

---

## Memory Graph (Phase 7–10, P2-7)

Graph lives under Y.Doc `graph/` and replicates via `sync:crdt-update`.

```bash
npm run graph:smoke
npm run graph:seed
SYNC_GRAPH_SCOPED=0 npm run graph:seed   # legacy project/task/file demo
```

```ts
import * as Y from "yjs";
import { MemoryGraph } from "@slisync/sync-sdk/graph";

const graph = MemoryGraph.on(doc, "agent-1").init(roomId);
graph.upsertChunk({
  workspaceId: "ws-demo",
  sessionId: "sess-1",
  title: "Context",
  content: "...",
});
graph.traverse(rootId, {
  scopeFilter: { workspaceId: "ws-demo" },
  kinds: ["memory_chunk"],
});
```

### HTTP write

`POST /v1/graphs/:roomId/ops` (alias `/graphs/:roomId/ops`)

```http
Authorization: Bearer <SYNC_AGENT_API_KEY>
{ "agentId": "example-agent", "action": "seed_graph", "graphOps": [ ... ] }
```

`pushGraphOpsHttp()` · optional `Idempotency-Key`

### HTTP traverse

`GET /v1/graphs/:roomId/traverse?startId=...&workspaceId=...&sessionId=...`

`fetchGraphTraverseHttp()`

---

## Auth & agent graph policy (Phase 8)

Enabled when `SYNC_AUTH_REQUIRED=1` or any key is set:

| Env | Role |
|-----|------|
| `SYNC_API_KEY` | Human: CRDT join, traverse read |
| `SYNC_AGENT_API_KEY` | Agent push, graph HTTP write |
| `SYNC_ROOM_KEYS` | Per-room token JSON |
| `SYNC_AGENT_DENY_MEMORY` | Block agent demo memory patch |
| `SYNC_AGENT_GRAPH_RELATIONS` | Allowed edge types |
| `SYNC_AGENT_GRAPH_KINDS` | Allowed node kinds |
| `SYNC_AGENT_GRAPH_OPS` | Allowed op types |
| `SYNC_AGENT_MAX_GRAPH_OPS` | Max ops per push |

```bash
SYNC_AUTH_REQUIRED=1 SYNC_API_KEY=<room-key> SYNC_AGENT_API_KEY=<agent-key> npm run dev
npm run graph:policy
```

---

## Graph activity & visualization (Phase 9, P3)

| Trigger | Mechanism |
|---------|-----------|
| Agent `graphOps` | `sync:graph-activity` (`source: agent`) |
| Human `sync:graph-notify` | Relay to peers |
| Human `sync:crdt-update` | Server snapshot diff → peers |

Demo: `GraphTreeView` (tree / force), `GraphNodeDetail`, `SyncStrategyPanel`.

---

## Presence & offline (P2)

| Event | Purpose |
|-------|---------|
| `sync:presence-*` | Room membership |
| CRDT outbox | Queue while offline / pre-sync; FIFO flush on `markSynced` |

### Local-first (Vision 2)

```ts
const { patchData, outboxSize, localRestored, lastSyncedAt } = useSync({
  roomId: "my-project",
  defaultState: { message: "Hello", counter: 0 },
  strategy: "crdt",
  localPersistence: true, // default in browser; false for memory-only
});
```

- `localPersistence: true` — IndexedDB when available (`slisync` / `rooms`)
- `localRestored` — `null` before hydrate; `true` if a local snapshot was applied
- `lastSyncedAt` — Unix ms of last successful server sync
- `clearLocalRoom(roomId)` — delete persisted record

Details: [docs/en/local-first.md](../docs/en/local-first.md)

`useSync()` → `presenceMembers`, `outboxSize`, `localRestored`, `lastSyncedAt`

---

## Socket events

| Event | Direction |
|-------|-----------|
| `sync:join` / `sync:state` / `sync:patch` | ↔ |
| `sync:conflict` | server → client |
| `sync:crdt-join` / `sync:crdt-sync` / `sync:crdt-update` | ↔ |
| `sync:agent-push` / `sync:agent-activity` | ↔ / broadcast |
| `sync:graph-activity` / `sync:graph-notify` | broadcast / client → server |
| `sync:presence-*` | ↔ / broadcast |
| `sync:error` | server → client |

---

## Integration tests (Phase 11)

```bash
npm test
```

Covers CRDT seed, late join, graph activity, HTTP ops/traverse, idempotency, auth, scoped memory, presence, capabilities, offline outbox.

---

## Environment

See [.env.example](../.env.example). Defaults: `.sync-data/rooms.json`, `.sync-data/crdt-rooms.json`.
