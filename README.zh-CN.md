# Slisync

**多 Agent 在同一 room 内的实时共忆与同步**（可选导出至 [Aonote 青笺](https://aonote.vercel.app)）

[English](./README.md) · [GitHub](https://github.com/runsli/slisync) · [slisync.com](https://slisync.com)

> **Sli** = *scoped live information*（room 内分层、可 CRDT 合并的实时共享信息）。  
> 本仓库为 Slisync 参考实现：浏览器与 Agent 在同一 **room** 同步状态与 **Memory Graph**。

---

## 它是什么？

不是聊天软件，不是 Web3，也不是套壳工具。

**Slisync** 是 **AI-native 实时同步引擎**：让多个 AI Agent 在 **room** 内共享记忆、状态与上下文，并可导出为青笺 Markdown。传输层为 **Socket.IO + Yjs CRDT**（可选 LWW）；Agent 可通过 Socket 或 HTTP 写入。

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

[docs/zh/ROADMAP.md](./docs/zh/ROADMAP.md) · 青笺导出：[docs/zh/export.md](./docs/zh/export.md) · 工程 Phase：[packages/README.zh-CN.md](./packages/README.zh-CN.md#engineering-phases)

---

## 快速开始

需要 **Node ≥ 20.9**。

```bash
nvm use 20
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。**主路径：Scoped Memory**（[demo-scoped-memory](./docs/zh/demo-scoped-memory.md)）+ **任务看板** Tab（[task-bus](./docs/zh/task-bus.md)，`npm run task:seed`）。**Local-first（CRDT）**：刷新不丢 Graph 与 chunk — [local-first](./docs/zh/local-first.md)。

```bash
npm run task:seed
npm run agent:push -- --task-title "审查导出流水线" --status in_progress
```

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

| 文档 | 语言 |
|------|------|
| [docs/zh/VISION.md](./docs/zh/VISION.md) | 中文 |
| [docs/en/VISION.md](./docs/en/VISION.md) | English |
| [packages/README.zh-CN.md](./packages/README.zh-CN.md) | 技术文档（中文） |
| [packages/README.md](./packages/README.md) | Technical (English) |
| [docs/zh/demo-scoped-memory.md](./docs/zh/demo-scoped-memory.md) | Demo 主路径验收 |
| [docs/zh/task-bus.md](./docs/zh/task-bus.md) | Room 任务看板与 CLI |
| [docs/README.md](./docs/README.md) | 文档索引 |

---

## 测试

```bash
npm test   # 64 cases
```

环境变量：[.env.example](./.env.example)
