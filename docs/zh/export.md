# 导出 Markdown

[English](../en/export.md)

将 room 内 **`memory_chunk`** 节点导出为带 YAML front matter 的 **Markdown 文件**。Slisync 不包含博客引擎 —— 你把文件交给任意静态站、CMS 或笔记工具即可。

**第一版：单向快照** — 不做 Markdown → CRDT 回写。

## 数据流

```mermaid
flowchart LR
  CRDT[Y.Doc room] --> Snap[readMemoryGraphSnapshot]
  Snap --> Filter[memory_chunk only]
  Filter --> MD["markdown/chunks/ws/sess/slug.md"]
  MD --> YOU[你的发布工具]
  YOU --> Site[静态站 / 博客 / 笔记库]
```

## 目录约定

```text
markdown/chunks/
  {workspaceId}/
    {sessionId}/          # 无 session 时为 _unsessioned
      {slug}.md
```

`slug` 由 `title` 生成；纯中文标题等无拉丁字母时回退为 `nodeId` 前缀。

## Markdown 示例

```yaml
---
title: "产品目标：Demo 以 Memory Graph 为主"
date: "2026-05-22T12:00:00.000Z"
workspaceId: ws-demo
sessionId: sess-demo
nodeId: node_xxx
kind: memory_chunk
roomId: example-room
source: chat
importance: 0.9
tags: [scope:chunk]
---

正文内容……
```

多出来的 front matter 字段对多数工具无害；只需要 `title`、`date` 的消费方可以忽略其余字段。

## 三条导出路径

| 路径 | 命令 | 数据源 |
|------|------|--------|
| **Live HTTP** | `npm run export:chunks:http` | 运行中的 sync（需先 dev + seed） |
| **本地文件** | `npm run export:chunks` | `.sync-data/crdt-rooms.json` |
| **CI / fixture** | `npm run export:chunks:ci` | `fixtures/crdt-rooms.example.json` |

### Live 闭环（推荐演示）

```bash
npm run dev
npm run graph:seed
npm run export:chunks:http -- --room example-room --out ./markdown/chunks
```

Demo UI：**「导出为 Markdown 草稿（zip）」** 通过 HTTP 下载（`Accept: application/zip`）。

### 过滤

环境变量或 CLI 参数：

- `SYNC_EXPORT_WORKSPACE` / `--workspace`
- `SYNC_EXPORT_SESSION` / `--session`
- `SYNC_EXPORT_MIN_IMPORTANCE` / `--min-importance`

## SDK

```ts
import {
  exportMemoryChunksFromSnapshot,
  exportMemoryChunksFromCrdtFile,
} from "@slisync/sync-sdk/graph";

const files = exportMemoryChunksFromSnapshot(snapshot, {
  roomId: "example-room",
  workspaceId: "ws-demo",
  minImportance: 0.5,
});
// files[].relativePath, files[].markdown
```

HTTP 客户端见 [HTTP 导出 API](./export-http.md)。

## 明确不导出

- `task` 及其他非 `memory_chunk` 节点  
- 仅存在于浏览器 IndexedDB、未同步到 server 的编辑  

## 相关

[HTTP 导出 API](./export-http.md) · [共忆 → Markdown → 静态站](./story-pipeline.md)

**产品说明（官网）**：同级 [slisync-docs](https://github.com/runsli/slisync-docs) 仓库。
