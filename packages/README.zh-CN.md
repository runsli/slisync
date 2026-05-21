# Slisync — 技术文档

[English](./README.md)（默认） · 产品：[docs/zh/VISION.md](../docs/zh/VISION.md)

npm 工作区 **`@slisync/*`** 实现 **Slisync**（room 实时同步 + Memory Graph + 导出至青笺）。

| 文档 | 说明 |
|------|------|
| [docs/zh/VISION.md](../docs/zh/VISION.md) | 产品愿景 |
| [docs/zh/ROADMAP.md](../docs/zh/ROADMAP.md) | 路线图 |
| [README.zh-CN.md](../README.zh-CN.md) | 快速开始 |

---

## Packages

| Package | 职责 |
|---------|------|
| `@slisync/sync-schema` | 类型、`GraphOp`、traverse、鉴权、agent policy、`protocolVersion` |
| `@slisync/sync-sdk` | 客户端 hooks、Zustand、LWW + CRDT、`MemoryGraph` |
| `@slisync/sync-server` | Socket.IO、持久化、Graph HTTP、Presence |

---

## Engineering phases

与 [12 阶段产品愿景](../docs/zh/ROADMAP.md) 并行维护的工程编号。

| ID | 状态 | 交付物 |
|----|------|--------|
| **1–11** | ✅ | 见 [English README](./README.md#engineering-phases) 对照表 |
| **P0–P3** | ✅ | 协议 v1、Redis、CRDT 权威、scoped memory、Presence、可视化、capabilities |

**不做：** 向量 DB、embedding、推理引擎。

---

## 运行服务

```bash
npm run sync:server      # :3001
npm run dev              # :3000 集成 Demo
```

- `GET /health`
- `GET /v1/sync/capabilities`

---

## 协议版本（P0）

协议 **`1`**。Socket / HTTP 携带 `protocolVersion` 或 `X-Sync-Protocol-Version`。

`fetchSyncCapabilities()` 返回生效的 `agentGraphPolicy`。

---

## Redis 集群（P0）

`REDIS_URL` 启用 `@socket.io/redis-adapter`。验证：`npm run test:cluster`。

---

## Agent 与 Graph

```bash
npm run agent:push
npm run graph:seed
npm run graph:push:http
npm run graph:traverse:http -- --start <nodeId>
```

- `POST /v1/graphs/:roomId/ops`
- `GET /v1/graphs/:roomId/traverse?startId=...&workspaceId=...&sessionId=...`
- `MemoryGraph.upsertChunk()` · `buildScopedMemoryOps()`

---

## 鉴权与策略（Phase 8）

`SYNC_API_KEY` / `SYNC_AGENT_API_KEY` / `SYNC_AGENT_GRAPH_*` 等，见 [.env.example](../.env.example)。

`npm run graph:policy` 校验默认策略。

---

## Presence 与离线（P2）

- `sync:presence-*`
- CRDT outbox · `useSync().presenceMembers` · `outboxSize`

### Local-first（愿景 2）

```ts
const { patchData, outboxSize, localRestored, lastSyncedAt } = useSync({
  roomId: "my-project",
  defaultState: { message: "Hello", counter: 0 },
  strategy: "crdt",
  localPersistence: true, // 浏览器默认；false 则仅内存
});
```

- `localPersistence: true` — 有 IndexedDB 时用 `slisync` / `rooms`
- `localRestored` — hydrate 前为 `null`；有本地快照为 `true`
- `lastSyncedAt` — 上次成功与服务端同步（Unix ms）
- `clearLocalRoom(roomId)` — 删除本地记录

详见 [docs/zh/local-first.md](../docs/zh/local-first.md)

---

## Socket 事件

`sync:join` · `sync:patch` · `sync:crdt-*` · `sync:agent-*` · `sync:graph-*` · `sync:presence-*` · `sync:error`

完整列表见 [English README](./README.md#socket-events)。

---

## 测试

```bash
npm test   # 46 cases（含 local-first）
```

---

## 环境变量

[.env.example](../.env.example)
