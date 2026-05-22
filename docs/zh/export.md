# 青笺导出（Memory Chunk → Markdown）

[English](../en/export.md)

Slisync 将 room 内 **Memory Graph** 的 `memory_chunk` 节点导出为带 YAML front matter 的 Markdown，供 [Aonote 青笺](https://aonote.vercel.app) 等静态站构建器消费。

**第一版**：单向快照导出；**不做** Markdown → CRDT 回写。

---

## 数据流

```mermaid
flowchart LR
  A[Y.Doc / CRDT room] --> B[readMemoryGraphSnapshot]
  B --> C[filter memory_chunk]
  C --> D["markdown/chunks/{ws}/{session}/{slug}.md"]
  D --> E[Aonote build]
  E --> F[静态站点]
```

| 阶段 | 实现 | 说明 |
|------|------|------|
| M0 | 本文档 | 路径约定与验收步骤 |
| M1 | `@slisync/sync-sdk` `export-chunks.ts` | 从 snapshot / Yjs update 生成文件描述 |
| M2 | `npm run export:chunks` | 从 CRDT JSON 读 room 并写盘（本地或 fixture） |
| M3 | HTTP GET | ✅ [export-http.md](./export-http.md) · `npm run export:chunks:http` |
| M4 | 可选 PostgreSQL CRDT 持久化 | ✅ `SYNC_CRDT_POSTGRES_URL` + `npm run dev:postgres`（[export-http.md](./export-http.md#持久化)） |
| M3+ | 青笺仓库对接 | 仓库侧消费 Markdown |

---

## 目录约定（与青笺对齐）

默认输出根目录：`markdown/chunks/`（可通过 `--out` 修改）。

```
markdown/chunks/
  {workspaceId}/
    {sessionId}/
      {slug}.md
```

- `workspaceId` / `sessionId` 来自 chunk 的 `data.scope`。
- 无 `sessionId` 时使用 `_unsessioned`。
- `slug` 由节点 `title` 生成；纯中文等无拉丁字母标题时回退为 `nodeId` 前缀。

---

## Markdown 格式

每个文件包含 YAML front matter + 正文（chunk `content`）：

```yaml
---
title: "User asked about CRDT sync"
date: "2026-05-20T12:00:00.000Z"
workspaceId: ws-demo
sessionId: sess-demo
nodeId: node_xxx
kind: memory_chunk
roomId: example-room
source: chat
importance: 0.9
tags: [scope:chunk]
---

Explain Yjs merge vs LWW optimistic locking for shared memory.
```

| 字段 | 来源 |
|------|------|
| `title`, `date`, `tags` | `MemoryNode` |
| `workspaceId`, `sessionId`, `content` | `MemoryChunkData.scope` / `content` |
| `roomId` | CLI `--room` 或 API 选项 |
| `source`, `importance` | chunk `data` |

---

## SDK（M1）

```ts
import {
  exportMemoryChunksFromSnapshot,
  exportMemoryChunksFromCrdtUpdate,
  exportMemoryChunksFromCrdtFile,
} from "@slisync/sync-sdk/graph";

// 从内存中的图快照
const files = exportMemoryChunksFromSnapshot(snapshot, {
  roomId: "my-room",
  workspaceId: "ws-main",
  minImportance: 0.5,
});

// 从 Yjs 二进制 update
const fromUpdate = exportMemoryChunksFromCrdtUpdate(update, { roomId: "my-room" });

// 从服务端持久化文件（Node）
const fromDisk = await exportMemoryChunksFromCrdtFile(
  ".sync-data/crdt-rooms.json",
  "example-room",
);
```

`ExportedChunkFile` 含 `relativePath` 与完整 `markdown` 字符串；写盘由调用方负责（CLI 或你自己的脚本）。

---

## CLI（M2）

### CRDT 数据源（自动选择）

未设置 `SYNC_CRDT_DATA_PATH` 时，`export:chunks` 按以下顺序解析：

| 条件 | 使用的文件 |
|------|------------|
| 设置了 `SYNC_CRDT_DATA_PATH` | 该路径 |
| `CI=1` 或 `GITHUB_ACTIONS`（且 fixture 存在） | `fixtures/crdt-rooms.example.json` |
| 存在 `.sync-data/crdt-rooms.json` | 本地 dev/seed 持久化 |
| 否则 | `fixtures/crdt-rooms.example.json` |

仓库内已提交 **`fixtures/crdt-rooms.example.json`**（仅 `example-room` 一条，约 6KB），供 **CI / 克隆后无需起 dev** 即可导出。

| 环境变量 | 默认 |
|----------|------|
| `SYNC_CRDT_DATA_PATH` | （见上表自动解析） |
| `SYNC_ROOM` | `example-room`（仅当未传 `--room`） |

### 路径 A：本地 live room（你已跑通的闭环）

```bash
# 1. 启动服务并写入 room（终端 1）
npm run dev

# 2. 向 example-room 写入 scoped memory（终端 2）
npm run graph:seed

# 3. 导出 Markdown（优先读 .sync-data）
npm run export:chunks -- --room example-room --out ./markdown/chunks
```

### 路径 B：fixture（CI / 新克隆，无需 dev）

```bash
npm run export:chunks:ci -- --out ./markdown/chunks
# 等价于 CI=1 时走 fixtures/crdt-rooms.example.json
```

### 更新 fixture（改了 demo 图结构时）

```bash
npm run dev && npm run graph:seed
npm run fixtures:refresh
git add fixtures/crdt-rooms.example.json
```

可选过滤（环境变量）：

- `SYNC_EXPORT_WORKSPACE` — 只导出指定 workspace
- `SYNC_EXPORT_SESSION` — 只导出指定 session
- `SYNC_EXPORT_MIN_IMPORTANCE` — 最低 importance（含边界）

---

## 验收链

**本地（live，文件）：**

1. `npm run graph:seed` 成功。
2. `npm run export:chunks` 在 `markdown/chunks/` 下生成至少 2 个 `.md`。

**本地（live，HTTP）：**

1. `npm run dev` + `npm run graph:seed`。
2. `npm run export:chunks:http -- --room example-room --out ./markdown/chunks`（或按 [export-http.md](./export-http.md) 用 curl / `fetchExportChunksHttp`）。
3. 与 `export:chunks` 落盘的 `relativePath` 与内容一致（同一 CRDT 持久化时）。

**CI / fixture（无需 dev）：**

1. `npm run export:chunks:ci` 成功并打印 `data=.../fixtures/crdt-rooms.example.json`。
2. GitHub Actions `CI` workflow 中同样步骤自动执行。

3. 将 `markdown/chunks` 拷入青笺项目对应目录后执行其 `build`，浏览器可阅读导出内容。

单元测试：`tests/unit/export-chunks.test.ts`（`npm test` 包含）。生成目录 `markdown/chunks/` 已 gitignore，不提交。

---

## 明确不做

- Markdown / 青笺编辑结果写回 CRDT
- IndexedDB local-first 作为 HTTP 导出源
- HTTP 导出 `task` 等非 `memory_chunk` 节点

HTTP 导出契约与验收链：[export-http.md](./export-http.md)。相关愿景：[ROADMAP.md](./ROADMAP.md) · [VISION.md](./VISION.md)
