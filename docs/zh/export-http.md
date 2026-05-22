# HTTP 导出 API

[English](../en/export-http.md)

只读导出服务端 **CrdtRoomStore** 中的 `memory_chunk`。与 Graph traverse 共用鉴权与协议头。

## 路由

| 方法 | 路径 |
|------|------|
| `GET` | `/v1/rooms/:roomId/export/chunks` |
| `GET` | `/rooms/:roomId/export/chunks`（别名） |

## Query

| 参数 | 说明 |
|------|------|
| `workspaceId` | 仅该 workspace |
| `sessionId` | 仅该 session |
| `minImportance` | 最低 importance（含边界） |
| `includeDeleted` | 是否含软删除节点 |

## 请求头

| 头 | 说明 |
|----|------|
| `X-Sync-Protocol-Version: 1` | 必填（与 schema 一致） |
| `Authorization: Bearer <SYNC_API_KEY>` | 人类/room token |
| `X-Sync-Agent-Key: <SYNC_AGENT_API_KEY>` | Agent 只读 |
| `Accept: application/json` | 默认 JSON |
| `Accept: application/zip` | 流式 zip，路径为 `relativePath` |

## JSON 响应示例

```json
{
  "ok": true,
  "roomId": "example-room",
  "exportedAt": "2026-05-22T12:00:00.000Z",
  "count": 2,
  "files": [
    {
      "relativePath": "ws-demo/sess-demo/user-asked-about-crdt-sync.md",
      "markdown": "---\ntitle: ...\n---\n\n正文\n"
    }
  ]
}
```

房间存在但无 chunk → **200**，`count: 0`。无 room → **404**。

## curl 示例

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

CLI：`npm run export:chunks:http`（环境变量 `SYNC_EXPORT_HTTP_URL` / `SYNC_HTTP_URL`）。

## 持久化与导出源

HTTP 导出**始终**经内存中的 Y.Doc（从持久化加载），与 CLI `export:chunks` 逻辑一致。优先级：

1. `REDIS_URL`  
2. `SYNC_CRDT_POSTGRES_URL`  
3. `SYNC_CRDT_DATA_PATH`（默认 `.sync-data/crdt-rooms.json`）

```bash
npm run postgres:up
npm run dev:postgres
npm run graph:seed
# 重启后仍可 HTTP 导出
```

无单独 export 缓存表。

见 [导出 Markdown](./export.md)。
