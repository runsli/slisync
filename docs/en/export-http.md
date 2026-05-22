# HTTP export (Memory Chunk → JSON)

[中文](../zh/export-http.md)

Read-only HTTP export of `memory_chunk` nodes from the server **CrdtRoomStore**. Response shape is defined in `@slisync/sync-schema` (`ExportChunksHttpResponse`). Handler: `packages/sync-server/src/export-http.ts`. Client: `fetchExportChunksHttp` in `@slisync/sync-sdk/graph`.

See also: [export.md](./export.md) (CLI/SDK) · Graph HTTP (`POST /v1/graphs/:roomId/ops`, `GET /v1/graphs/:roomId/traverse`).

---

## Three export paths

| Path | Command | Data source |
|------|---------|-------------|
| Local file | `npm run export:chunks` | `.sync-data/crdt-rooms.json` or `SYNC_CRDT_DATA_PATH` |
| Fixture (CI) | `npm run export:chunks:ci` | `fixtures/crdt-rooms.example.json` (no dev server) |
| Live HTTP | `npm run export:chunks:http` | Running sync server (`npm run dev` + `graph:seed`) |

With the same room and persistence, file and HTTP exports should produce the same `relativePath` set and Markdown content.

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

## Accept header

| Accept | Response |
|--------|----------|
| (default) / `application/json` | JSON `ExportChunksHttpResponse` |
| `application/zip` | Streaming zip; each entry path = `relativePath`, body = `markdown` |

Zip example:

```bash
curl -sS \
  -H "X-Sync-Protocol-Version: 1" \
  -H "Accept: application/zip" \
  "http://127.0.0.1:3000/v1/rooms/example-room/export/chunks" \
  -o example-room-chunks.zip
```

SDK: `fetchExportChunksZipHttp()` · Demo UI sends `Accept: application/zip`.

---

## Response (success, JSON)

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

## SDK (Phase 2)

```ts
import {
  fetchExportChunksHttp,
  fetchExportChunksZipHttp,
} from "@slisync/sync-sdk/graph";

const result = await fetchExportChunksHttp({
  baseUrl: "http://127.0.0.1:3000",
  roomId: "example-room",
  workspaceId: "ws-demo",
  minImportance: 0.5,
});

if (result.ok) {
  for (const file of result.files) {
    console.log(file.relativePath, file.markdown.slice(0, 80));
  }
}
```

```ts
const zip = await fetchExportChunksZipHttp({ roomId: "example-room" });
if (zip.ok) {
  // zip.blob → save as zip.filename
}
```

Uses `getSyncHttpBase`, `getAgentSyncToken`, and `withSyncProtocolHeaders` (same as `fetchGraphTraverseHttp`).

---

## CLI (Phase 2)

```bash
npm run dev
npm run graph:seed
npm run export:chunks:http -- --room example-room --out ./markdown/chunks
```

| Env | Role |
|-----|------|
| `SYNC_EXPORT_HTTP_URL` / `SYNC_HTTP_URL` / `SYNC_URL` | Server base (default `http://127.0.0.1:3000`) |
| `SYNC_ROOM` | Room id (default `example-room`) |
| `SYNC_EXPORT_WORKSPACE` / `SYNC_EXPORT_SESSION` / `SYNC_EXPORT_MIN_IMPORTANCE` | Query filters |

Compare with offline export:

```bash
npm run export:chunks -- --room example-room --out /tmp/file-export
npm run export:chunks:http -- --room example-room --out /tmp/http-export
# diff -r the two trees
```

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

## Persistence

One backend is active at a time (no dual-write). Priority for **all** room reads (including HTTP export):

1. **`REDIS_URL`** — Redis keys `sync:crdt:{roomId}`
2. **`SYNC_CRDT_POSTGRES_URL`** — PostgreSQL table `sync_crdt_rooms` (`packages/sync-server/migrations/001_sync_crdt_rooms.sql`; also auto-created on first connect)
3. **`SYNC_CRDT_DATA_PATH`** — JSON file (default `.sync-data/crdt-rooms.json`)

```bash
docker compose up -d postgres
npm run dev:postgres
npm run graph:seed
# restart dev, then HTTP export still returns seeded chunks
```

HTTP export **always** derives Markdown from `CrdtRoomStore` → memory graph snapshot → `exportMemoryChunksFromSnapshot` (same logic as CLI). There is **no** separate export cache or materialized export table.

**Tests (optional, not in default `npm test`):** set `SYNC_CRDT_POSTGRES_URL` and run `npm run test:postgres`. Use `SKIP_POSTGRES=1` to force skip when the URL is set.

---

## Acceptance chain

**Live server (same room as demo):**

```bash
# Terminal 1
npm run dev

# Terminal 2 — seed graph into example-room
npm run graph:seed

# Terminal 3 — HTTP export (SDK or CLI)
npm run export:chunks:http -- --room example-room --out ./markdown/chunks

# Or curl
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

**Tests:** `tests/integration/export-http.test.ts`, `tests/unit/fetch-export-chunks-http.test.ts` (in `npm test`).

---

## Out of scope

- Markdown → CRDT write-back
- IndexedDB / browser local-first as HTTP export source
- Exporting `task` or other non-`memory_chunk` node kinds
- PostgreSQL CRDT persistence (Phase 3)
