# Slisync

**多 Agent 在同一 room 内的实时共忆与同步**（*sli* = scoped live information，分层实时共享信息）

[English](../en/VISION.md)（默认） · [slisync.com](https://slisync.com)

---

## 一、项目定位：它是什么？

这不是聊天软件，不是 Web3 项目，也不是简单的 AI 包装工具。

这是一个 **AI 共享记忆与实时同步基础设施（AI-native Realtime Sync Engine）**。

### 核心目标

让多个 AI（Coding AI、Browser AI、Planning AI、Research AI 等）像人类团队一样协作，共享：

- **Shared Memory** — 共享记忆
- **Shared State** — 共享状态
- **Shared Tasks** — 共享任务
- **Shared Context** — 共享上下文
- **Long-term Collaboration** — 长期协同

本仓库为 **Slisync** 参考实现：可运行 Demo 与 npm 三件套（`@slisync/sync-schema` / `@slisync/sync-sdk` / `@slisync/sync-server`）验证协议与一致性。

---

## 二、核心价值：为什么需要它？

### 1. 解决「聊完就忘」

多数 AI 仍是单次对话、独立运行。当手机 AI、浏览器 AI、本地 AI、企业 Agent 并存时，需要统一的记忆空间，而不是各自为政。

### 2. 解决「多 Agent 协作」瓶颈

复杂任务（例如「开发一个 Shopify 项目」）需要多 Agent 分工：

- **Planning Agent** 拆解任务
- **Coding Agent** 编写代码
- **Testing Agent** 运行测试

若没有共享记忆空间，Agent 之间的状态与上下文传递会低效且易错。

---

## 三、技术栈（本仓库现状）

| 层级 | 技术 | 说明 |
|------|------|------|
| Demo UI | Next.js, TypeScript, Tailwind CSS | `app/`、`src/components/` |
| 客户端状态 | Zustand | `createSyncStore` |
| 实时传输 | **Socket.IO** | 当前生产路径；WebRTC 为远期选项 |
| 一致性 | **Yjs / CRDT** | 主路径；可选 LWW + JSON Patch |
| 服务端持久化 | Node.js、**Redis**（可选）、JSON 文件 | 非 PostgreSQL（可后续扩展） |
| 本地优先 | 客户端 **CRDT 离线队列** | 已做 reconnect flush；**IndexedDB 尚未接入** |

---

## 四、12 阶段演进路线图（产品愿景）

完整状态与实现对照见 **[ROADMAP.md](./ROADMAP.md)**。

| 阶段 | 主题 | 愿景摘要 |
|------|------|----------|
| **1** | Realtime Sync | 多窗口/多客户端状态同步、重连与房间 |
| **2** | Local-first | IndexedDB、离线队列、联网后回放 |
| **3** | Patch Sync | JSON Patch / Diff 增量同步 |
| **4** | Persistence | Redis / DB，重启不丢数据 |
| **5** | Conflict Resolution | CRDT（Yjs）多端无损合并 |
| **6** | SDK 产品化 | `sync-sdk` + `sync-server`，npm 接入 |
| **7** | Memory Layer | 长期偏好、项目背景等结构化记忆 |
| **8** | Memory Graph | 实体关系图谱（项目、任务、文件、chunk） |
| **9** | Semantic Memory | Embedding / 向量检索（**本仓库明确不做**） |
| **10** | Multi-Agent | 多 Agent 事件总线、任务进度同步 |
| **11** | Workflow Engine | 根据共享状态触发后续流程 |
| **12** | AI Runtime / AI OS | AI 时代的协同与记忆调度层 |

---

## 五、SDK 使用概念（与当前 API 对齐）

安装使用 **`@slisync/sync-sdk`**（monorepo workspace 或发布后 npm）：

```ts
import { useSync, MemoryGraph, createSyncStore } from "@slisync/sync-sdk";

const store = createSyncStore({ message: "Hello", counter: 0 });
const { patchData, syncReady, getCrdtDocument } = useSync({
  roomId: "shopify-project-id",
  defaultState: { message: "Hello", counter: 0 },
  strategy: "crdt",
  store,
});

patchData({ message: "Implementing Stripe integration" });

const doc = getCrdtDocument();
if (doc && syncReady) {
  const graph = MemoryGraph.on(doc, "coding-agent").init("shopify-project-id");
  graph.upsertChunk({
    workspaceId: "ws-shopify",
    sessionId: "sess-1",
    title: "Payment context",
    content: "We use Stripe Checkout with webhooks.",
  });
}
```

无头 Agent 写入：`pushAgentMemory()`、`pushGraphOpsHttp()` — 见 [packages/README.zh-CN.md](../../packages/README.zh-CN.md)。

---

## 六、推荐目录结构（愿景 vs 本仓库）

**愿景（目标形态）：**

```text
apps/demo-app/
packages/sync-sdk, sync-core, sync-protocol/
services/sync-server/
docs/  examples/
```

**本仓库（当前）：**

```text
slisync/
├── app/ src/
├── server.ts
├── packages/sync-schema|sync-sdk|sync-server
├── docs/en/ docs/zh/
├── scripts/
└── tests/integration/
```

---

## 七、项目原则

### 坚持做

1. **Local-first 方向** — 本地可编辑，同步是增强。
2. **Simple API** — 数分钟内跑通 Demo。
3. **Stability** — 重连、一致性、协议版本优先。
4. **Developer Trust** — 开源、可测、文档与代码对齐。

### 当前阶段不做

1. **No Web3**
2. **No Over-Engineering**
3. **No Super App**
4. **No Semantic / Vector / Reasoning**

---

## 八、商业模式与愿景（产品层）

- **开源**：SDK、协议、基础 sync server、文档。
- **商业化方向（远期）**：Cloud Sync、Enterprise Memory、AI Coordination API。

**总结：** **Slisync** 负责 Aonote 生态中的「共忆 → 笺」链路；当前重点是 **多客户端稳定同步与 Memory Graph**。

---

## 相关文档

- [ROADMAP.md](./ROADMAP.md)
- [README.zh-CN.md](../../README.zh-CN.md)
- [packages/README.zh-CN.md](../../packages/README.zh-CN.md)
