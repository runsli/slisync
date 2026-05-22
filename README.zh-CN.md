# Slisync

**让多个 AI 与人在同一协作空间里共用一份项目记忆**——实时一起改，需要时再**导出 Markdown** 自行发布。

[English](./README.md) · [GitHub](https://github.com/runsli/slisync) · [slisync.com](https://slisync.com)

> GitHub 仓库：[runsli/slisync](https://github.com/runsli/slisync)。本地建议 clone 到目录名 `slisync`。  
> 开发者术语：**room** = 协作空间；**memory_chunk** = 可导出的记忆片段。

---

## 我想…

| 我想… | 怎么做 |
|--------|--------|
| **5 分钟体验「多人共忆」** | 下方 [快速开始](#快速开始) → 打开 Demo 的「共享记忆」 |
| **看中文产品说明（官网）** | [slisync-docs](../slisync-docs/) → `cd ../slisync-docs && npm run dev`（:5173） |
| **把记忆导出成 Markdown** | [docs/zh/export.md](./docs/zh/export.md) |
| **接入自己的应用** | [packages/README.zh-CN.md](./packages/README.zh-CN.md) · [docs/zh/](./docs/zh/) |
| **查协议与实现进度** | [docs/zh/ROADMAP.md](./docs/zh/ROADMAP.md) |

**文档分工**：对外官网只在 **[slisync-docs](../slisync-docs/)**（勿用本仓库内 `文档/GitHub/` 旧目录）。协议与 Phase 见本仓库 `docs/zh`。

---

## 它是什么？

不是聊天软件，不是 Web3，也不是套一层 API 的 ChatGPT。

**Slisync** 解决两件事：**协作时记忆不散落**（浏览器 + 多个 Agent 改同一份结构化记忆），**协作结束后能出版**（把记忆片段导出为 Markdown）。底层用 **Socket.IO + Yjs CRDT** 做实时合并；Agent 可通过 Socket 或 HTTP 写入。

| 包 | 职责 |
|----|------|
| `@slisync/sync-schema` | 图类型、`GraphOp`、鉴权、协议版本 |
| `@slisync/sync-sdk` | hooks、Zustand、CRDT/LWW、`MemoryGraph` |
| `@slisync/sync-server` | Socket、持久化、Graph HTTP、Presence |

---

## 为什么需要它？

1. **聊完就忘** — 统一 room 级记忆。  
2. **多 Agent 协作** — 在同一空间读写状态与图谱。

详见 [docs/zh/VISION.md](./docs/zh/VISION.md#二核心价值为什么需要它)。

---

## 路线图

- 产品愿景对照：[docs/zh/ROADMAP.md](./docs/zh/ROADMAP.md)  
- Markdown 导出：[docs/zh/export.md](./docs/zh/export.md) · HTTP：[docs/zh/export-http.md](./docs/zh/export-http.md)  
- 工程 Phase：[packages/README.zh-CN.md](./packages/README.zh-CN.md)

---

## 快速开始

需要 **Node ≥ 20.9**。

```bash
nvm use 20
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。主界面 **「共享记忆」** 写项目笔记，**「任务看板」** 跟待办（可先 `npm run task:seed`）。断网或刷新后修改仍会保留 — [local-first](./docs/zh/local-first.md)。分步说明：[demo-scoped-memory](./docs/zh/demo-scoped-memory.md)。

```bash
npm run graph:seed
npm run export:chunks:http -- --room example-room --out ./markdown/chunks
npm run task:seed
npm run agent:push -- --task-title "审查导出流水线" --status in_progress
```

导出闭环：`graph:seed` → `export:chunks:http`（或 curl，见 [export-http.md](./docs/zh/export-http.md)）；离线：`npm run export:chunks`。发布由你的静态站或 CMS 自行处理。

> 旧版 `message` / `counter` 与 LWW 对比在 Demo 折叠区「旧版共享字段演示」「高级：LWW 对比实验」。

```bash
npm run sync:server
NEXT_PUBLIC_SYNC_URL=http://localhost:3001 npm run dev
```

### SDK 示例

```ts
import { useSync, MemoryGraph, createSyncStore } from "@slisync/sync-sdk";

const store = createSyncStore({ message: "Hello", counter: 0 });
const { patchData, syncReady, getCrdtDocument } = useSync({
  roomId: "my-project",
  defaultState: { message: "Hello", counter: 0 },
  strategy: "crdt",
  store,
});

patchData({ message: "Stripe 集成进行中" });

const doc = getCrdtDocument();
if (doc && syncReady) {
  MemoryGraph.on(doc, "agent-1")
    .init("my-project")
    .upsertChunk({
      workspaceId: "ws-main",
      title: "支付说明",
      content: "使用 Stripe Checkout。",
    });
}
```

---

## 文档

### 产品官网（VitePress）

在同级 **slisync-docs** 仓库中执行（与 slisync 并排 clone）：

```bash
cd ../slisync-docs
nvm use 20
npm install
npm run dev      # http://localhost:5173
npm run build
```

不要使用本仓库内的 `文档/GitHub/`（已废弃）。

| 站点 | 仓库 |
|------|------|
| 用户文档与指南 | [slisync-docs](../slisync-docs/) |

### 本仓库（协议 / 工程）

| 文档 | 语言 |
|------|------|
| [docs/zh/VISION.md](./docs/zh/VISION.md) | 中文 |
| [docs/en/VISION.md](./docs/en/VISION.md) | English |
| [packages/README.zh-CN.md](./packages/README.zh-CN.md) | 技术文档（中文） |
| [packages/README.md](./packages/README.md) | Technical (English) |
| [docs/zh/demo-scoped-memory.md](./docs/zh/demo-scoped-memory.md) | Demo 主路径验收 |
| [docs/zh/task-bus.md](./docs/zh/task-bus.md) | Room 任务看板与 CLI |
| [docs/zh/export.md](./docs/zh/export.md) | Markdown 导出 |
| [docs/zh/export-http.md](./docs/zh/export-http.md) | HTTP 导出 |
| [docs/zh/story-pipeline.md](./docs/zh/story-pipeline.md) | 共忆 → Markdown → 静态站 |
| [docs/README.md](./docs/README.md) | 文档索引 |
| [slisync-docs](https://github.com/runsli/slisync-docs) | 产品官网（VitePress） |

---

## 测试

```bash
npm test   # 64 cases
```

环境变量：[.env.example](./.env.example)
