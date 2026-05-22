# HTTP export API

[中文](../zh/export-http.md)

Read-only export of `memory_chunk` from the server **CrdtRoomStore**. Shares auth and protocol headers with Graph traverse.

## Routes

| Method | Path |
|--------|------|
| `GET` | `/v1/rooms/:roomId/export/chunks` |
| `GET` | `/rooms/:roomId/export/chunks` (alias) |

## Query

| Param | Description |
|-------|-------------|
| `workspaceId` | Filter to workspace |
| `sessionId` | Filter to session |
| `minImportance` | Minimum importance (inclusive) |
| `includeDeleted` | Include soft-deleted nodes |

## Headers

| Header | Description |
|--------|-------------|
| `X-Sync-Protocol-Version: 1` | Required (matches schema) |
| `Authorization: Bearer <SYNC_API_KEY>` | Human / room token |
| `X-Sync-Agent-Key: <SYNC_AGENT_API_KEY>` | Agent read-only |
| `Accept: application/json` | Default JSON |
| `Accept: application/zip` | Stream zip; paths = `relativePath` |

## JSON response example

```json
{
  "ok": true,
  "roomId": "example-room",
  "exportedAt": "2026-05-22T12:00:00.000Z",
  "count": 2,
  "files": [
    {
      "relativePath": "ws-demo/sess-demo/user-asked-about-crdt-sync.md",
      "markdown": "---\ntitle: ...\n---\n\nBody\n"
    }
  ]
}
```

Room exists but no chunks → **200**, `count: 0`. Unknown room → **404**.

## curl examples

```bash
curl -sS \
  -H "X-Sync-Protocol-Version: 1" \
  "http://127.0.0.1:3000/v1/rooms/example-room/export/chunks" | jq '.count'

curl -sS \
  -H "X-Sync-Protocol-Version: 1" \
  -H "Accept: application/zip" \
  "http://127.0.0.1:3000/v1/rooms/example-room/export/chunks" \
  -o example-room-chunks.zip
```

## SDK

```ts
import {
  fetchExportChunksHttp,
  fetchExportChunksZipHttp,
} from "@slisync/sync-sdk/graph";

const result = await fetchExportChunksHttp({
  baseUrl: "http://127.0.0.1:3000",
  roomId: "example-room",
  workspaceId: "ws-demo",
});

if (result.ok) {
  for (const f of result.files) {
    console.log(f.relativePath);
  }
}
```

CLI: `npm run export:chunks:http` (env: `SYNC_EXPORT_HTTP_URL` / `SYNC_HTTP_URL`).

## Persistence and export source

HTTP export **always** goes through in-memory `Y.Doc` (loaded from persistence), same logic as CLI `export:chunks`. Priority:

1. `REDIS_URL`  
2. `SYNC_CRDT_POSTGRES_URL`  
3. `SYNC_CRDT_DATA_PATH` (default `.sync-data/crdt-rooms.json`)

```bash
npm run postgres:up
npm run dev:postgres
npm run graph:seed
# After restart, HTTP export still works
```

There is no separate export cache table.

See [Export Markdown](./export.md).
