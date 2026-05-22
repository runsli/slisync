# HTTP 导出（Memory Chunk → JSON）

[English](../en/export-http.md)

通过 HTTP 只读导出服务端 **CrdtRoomStore** 中的 `memory_chunk` 节点。响应类型见 `@slisync/sync-schema`（`ExportChunksHttpResponse`）。**Phase 0** 仅定稿契约与文档，尚未注册路由。

另见：[export.md](./export.md)（CLI/SDK）· Graph HTTP（`POST /v1/graphs/:roomId/ops`、`GET /v1/graphs/:roomId/traverse`）。

---

## 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/v1/rooms/:roomId/export/chunks` | 推荐 |
| `GET` | `/rooms/:roomId/export/chunks` | 别名（与 graph 路由风格一致） |

`:roomId` 需 URL 编码。无请求体。

---

## Query 参数

与 SDK `ExportChunksOptions` / schema `ExportChunksQuery` 对齐：

| 参数 | 类型 | 说明 |
|------|------|------|
| `workspaceId` | string | 仅导出该 workspace 下的 chunk |
| `sessionId` | string | 仅导出该 session 下的 chunk |
| `minImportance` | number | 最低 `importance`（含边界） |
| `includeDeleted` | boolean | `true` / `false` / `1` / `0` — 是否包含软删除节点 |

省略时导出房间内所有符合条件的 `memory_chunk`。

---

## 鉴权

与 graph traverse 相同：

- `Authorization: Bearer <token>`（`SYNC_API_KEY` 或 `SYNC_ROOM_KEYS` 中的 room 密钥），或
- `X-Sync-Agent-Key: <SYNC_AGENT_API_KEY>`（Agent 只读）。

`SYNC_AUTH_REQUIRED=1`（或已配置密钥）时，缺失/无效凭证 → **401**，`{ "ok": false, "error": "..." }`。

---

## 协议头

客户端应发送 **`X-Sync-Protocol-Version`**（见 `@slisync/sync-schema` 的 `SYNC_PROTOCOL_HEADER`）。服务端与 graph HTTP 一样复用 `protocol-guard` / `negotiateProtocolVersion`。版本不兼容 → **400** 且 `code: "incompatible_protocol"`（下表未单独列出）。

---

## 成功响应

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
      "markdown": "---\ntitle: ...\n---\n\n正文。\n"
    }
  ]
}
```

- `relativePath` / `markdown` 与 SDK `ExportedChunkFile` 对齐（HTTP 响应不含顶层 `workspaceId` / `sessionId` / `nodeId`，这些信息在 `markdown` 的 YAML front matter 中）。
- `count` 等于 `files.length`。
- 服务端从内存 Y.Doc（由持久化加载）实时计算；**无** export 缓存表。

类型定义：`packages/sync-schema/src/export-http-model.ts` 中的 `ExportChunksHttpSuccess`、`ExportChunksHttpFile`、`ExportChunksHttpResponse`。

---

## 错误响应

| HTTP | 场景 | Body |
|------|------|------|
| **401** | 需要鉴权或 token 无效 | `{ "ok": false, "error": "agent token required" }` 等 |
| **404** | 服务端无该 room 的 CRDT 且 export 采用只读 load（不自动 seed） | `{ "ok": false, "error": "room not found" }` |
| **405** | 非 `GET` / `OPTIONS` | `{ "ok": false, "error": "method not allowed" }` |
| **422** | Query 非法（如 `minImportance` 非数字） | `{ "ok": false, "error": "invalid minImportance" }` |

房间存在但图为空 → **200**，`count: 0`，`files: []`（Phase 1 实现细节）。

---

## 持久化（实现前设计）

**所有** room 读路径（含 HTTP export）的 CRDT 后端优先级：

1. **`REDIS_URL`** — Redis 键 `sync:crdt:{roomId}`
2. **`SYNC_CRDT_POSTGRES_URL`** — 可选 PostgreSQL blob（Phase 1+；Phase 0 不接入）
3. **`SYNC_CRDT_DATA_PATH`** — JSON 文件（默认 `.sync-data/crdt-rooms.json`）

HTTP export **始终**经 `CrdtRoomStore` → 内存图快照 → `exportMemoryChunksFromSnapshot`（与 CLI 相同逻辑）。**不**维护单独的 export 快照表或物化视图。

---

## 验收链

**本地 live room：**

```bash
# 终端 1
npm run dev

# 终端 2 — 向 example-room 写入图
npm run graph:seed

# 终端 3 — HTTP 导出（Phase 1 实现 handler 后）
curl -sS \
  -H "X-Sync-Protocol-Version: 1" \
  -H "X-Sync-Agent-Key: $SYNC_AGENT_API_KEY" \
  "http://localhost:3000/v1/rooms/example-room/export/chunks" | jq '.count, .files[0].relativePath'

# 与同一持久化文件的离线导出对比
npm run export:chunks -- --room example-room --out ./markdown/chunks
```

**CI / fixture（无需 dev）：**

```bash
npm run export:chunks:ci -- --out ./markdown/chunks
```

在相同 `SYNC_CRDT_DATA_PATH` / fixture 下，HTTP JSON 的 `count`、`relativePath` 应与 CLI 落盘结果一致。

**Phase 0 类型检查：**

```bash
npm run typecheck -w @slisync/sync-schema
```

---

## 明确不做

- Markdown → CRDT 回写
- 以 IndexedDB / 浏览器 local-first 作为 HTTP 导出源
- 导出 `task` 等非 `memory_chunk` 节点
- 引入 `pg` 依赖或实现 `export-http.ts` handler（Phase 1）
