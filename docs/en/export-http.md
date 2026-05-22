# HTTP export (Memory Chunk → JSON)

[中文](../zh/export-http.md)

Read-only HTTP export of `memory_chunk` nodes from the server **CrdtRoomStore**. Response shape is defined in `@slisync/sync-schema` (`ExportChunksHttpResponse`). **Phase 0**: types and docs only — no route registration yet.

See also: [export.md](./export.md) (CLI/SDK) · Graph HTTP (`POST /v1/graphs/:roomId/ops`, `GET /v1/graphs/:roomId/traverse`).

---

## Routes

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/v1/rooms/:roomId/export/chunks` | Preferred |
| `GET` | `/rooms/:roomId/export/chunks` | Alias (same style as graph routes) |

`:roomId` is URL-encoded. No request body.

---

## Query parameters

Aligned with SDK `ExportChunksOptions` / schema `ExportChunksQuery`:

| Query | Type | Description |
|-------|------|-------------|
| `workspaceId` | string | Only chunks in this workspace |
| `sessionId` | string | Only chunks in this session |
| `minImportance` | number | Minimum `importance` (inclusive) |
| `includeDeleted` | boolean | `true` / `false` / `1` / `0` — include soft-deleted nodes |

Omitted filters export all matching `memory_chunk` nodes in the room graph.

---

## Auth

Same as graph traverse:

- `Authorization: Bearer <token>` (`SYNC_API_KEY` or per-room key from `SYNC_ROOM_KEYS`), or
- `X-Sync-Agent-Key: <SYNC_AGENT_API_KEY>` for agent reads.

When `SYNC_AUTH_REQUIRED=1` (or keys are configured), missing/invalid credentials → **401** with `{ "ok": false, "error": "..." }`.

---

## Protocol header

Clients should send **`X-Sync-Protocol-Version`** (see `SYNC_PROTOCOL_HEADER` in `@slisync/sync-schema`). The server reuses `protocol-guard` / `negotiateProtocolVersion` like graph HTTP. Incompatible version → **400** with `code: "incompatible_protocol"` (not listed in the table below).

---

## Response (success)

`Content-Type: application/json`

```json
{
  "ok": true,
  "roomId": "example-room",
  "exportedAt": "2026-05-22T12:00:00.000Z",
  "count": 2,
  "files": [
    {
      "relativePath": "ws-demo/sess-demo/user-asked-about-crdt-sync.md",
      "markdown": "---\ntitle: ...\n---\n\nBody text.\n"
    }
  ]
}
```

- `relativePath` / `markdown` align with SDK `ExportedChunkFile` (HTTP omits top-level `workspaceId` / `sessionId` / `nodeId`; they remain in YAML front matter inside `markdown`).
- `count` equals `files.length`.
- Server computes export from the live in-memory Y.Doc backed by persistence (see below); **no** export snapshot table.

Types: `ExportChunksHttpSuccess`, `ExportChunksHttpFile`, `ExportChunksHttpResponse` in `packages/sync-schema/src/export-http-model.ts`.

---

## Error responses

| HTTP | When | Body |
|------|------|------|
| **401** | Auth required or invalid token | `{ "ok": false, "error": "agent token required" }` (or similar) |
| **404** | Room has no CRDT state on server and export uses load-only semantics (no auto-seed) | `{ "ok": false, "error": "room not found" }` |
| **405** | Not `GET` / `OPTIONS` | `{ "ok": false, "error": "method not allowed" }` |
| **422** | Invalid query (e.g. non-numeric `minImportance`) | `{ "ok": false, "error": "invalid minImportance" }` |

Empty graph with an existing room → **200**, `count: 0`, `files: []` (implementation detail for Phase 1).

---

## Persistence (design, pre-implementation)

Server CRDT backing store priority for **all** room reads (including HTTP export):

1. **`REDIS_URL`** — Redis keys `sync:crdt:{roomId}`
2. **`SYNC_CRDT_POSTGRES_URL`** — optional PostgreSQL blob store (Phase 1+; not wired in Phase 0)
3. **`SYNC_CRDT_DATA_PATH`** — JSON file (default `.sync-data/crdt-rooms.json`)

HTTP export **always** derives Markdown from `CrdtRoomStore` → memory graph snapshot → `exportMemoryChunksFromSnapshot` (same logic as CLI). There is **no** separate export cache or materialized export table.

---

## Acceptance chain

**Live server (same room as demo):**

```bash
# Terminal 1
npm run dev

# Terminal 2 — seed graph into example-room
npm run graph:seed

# Terminal 3 — HTTP export (after Phase 1 handler exists)
curl -sS \
  -H "X-Sync-Protocol-Version: 1" \
  -H "X-Sync-Agent-Key: $SYNC_AGENT_API_KEY" \
  "http://localhost:3000/v1/rooms/example-room/export/chunks" | jq '.count, .files[0].relativePath'

# Compare with offline export from the same persistence file
npm run export:chunks -- --room example-room --out ./markdown/chunks
```

**CI / fixture (no dev server):**

```bash
npm run export:chunks:ci -- --out ./markdown/chunks
```

Counts and `relativePath` values should match between HTTP JSON and CLI-written files when both read the same `SYNC_CRDT_DATA_PATH` / fixture.

**Typecheck (Phase 0):**

```bash
npm run typecheck -w @slisync/sync-schema
```

---

## Out of scope

- Markdown → CRDT write-back
- IndexedDB / browser local-first as HTTP export source
- Exporting `task` or other non-`memory_chunk` node kinds
- `pg` dependency or `export-http.ts` handler (Phase 1)
