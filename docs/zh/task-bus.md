# Room 任务总线

[English](../en/task-bus.md)（默认）

Slisync **room 级、图原生（graph-native）** 任务总线：权威任务状态存放在共享 Memory Graph 的 `kind: "task"` 节点中，与 scoped memory 共用同一 `Y.Doc` / CRDT 路径。

相关：[demo-scoped-memory.md](./demo-scoped-memory.md)（记忆 Tab）· [local-first.md](./local-first.md) · [ROADMAP.md](./ROADMAP.md) · [packages/README.zh-CN.md](../../packages/README.zh-CN.md)

---

## 数据流

```mermaid
flowchart TB
  subgraph scope [工作区 scope]
    WS[workspace]
    TK[task]
    CH[memory_chunk 可选]
  end
  subgraph clients [客户端]
    A[浏览器 A]
    B[浏览器 B]
    AG[Agent CLI]
  end
  subgraph sync [Slisync room 如 example-room]
    CRDT[Y.Doc / CRDT 图]
    IDB[(IndexedDB room 快照)]
  end
  WS --> TK
  TK -.->|related_to 可选| CH
  A --> CRDT
  B --> CRDT
  AG -->|agent:push / graph:seed| CRDT
  CRDT --> IDB
  A --> IDB
```

任务与 scoped memory 一样，是 **CRDT 图上的节点**。客户端与 Agent 通过既有图操作（`upsertNode`、`upsertEdge`）在 `agent:push` 或 room CRDT 更新中写入 — Phase 0 **没有** `sync:task-*` socket 事件。

---

## 任务 vs Scoped Memory

| 维度 | `memory_chunk`（scoped memory） | `task`（任务总线） |
|------|--------------------------------|-------------------|
| 用途 | 工作区/会话下的 AI/用户记忆片段 | 可执行工作项（状态、负责人、截止） |
| `data` 核心 | `content`、`importance`、`scope` | `status`、`scope`，可选 `assigneeId`、`priority`、`dueAt` |
| 典型边 | 自 session `contains` | `depends_on`、`assigned_to`，可选 `related_to` → chunk |
| 解析 | `parseMemoryChunkData` | `parseTaskData` |

任务可通过 **`related_to`** 关联到 memory chunk：正文留在 chunk，任务跟踪执行状态。

---

## `TaskData`（schema）

类型位于 `@slisync/sync-schema`（`task-model.ts`）：

| 字段 | 类型 | 必填 |
|------|------|------|
| `scope` | `MemoryScope`（`workspaceId`，可选 `sessionId`） | 是 |
| `status` | `todo` \| `in_progress` \| `blocked` \| `done` \| `cancelled` | 是 |
| `assigneeId` | string | 否 |
| `priority` | number | 否 |
| `dueAt` | ISO-8601 字符串 | 否 |
| `source` | string（如 `agent:push`） | 否 |

节点示例：

```json
{
  "kind": "task",
  "title": "审查 scoped memory 导出",
  "data": {
    "scope": { "workspaceId": "ws-demo", "sessionId": "sess-demo" },
    "status": "todo",
    "priority": 1,
    "source": "agent:push"
  }
}
```

---

## SDK（Phase 1）

从 `@slisync/sync-sdk` / `@slisync/sync-sdk/graph` 导出：

| API | 作用 |
|-----|------|
| `MemoryGraph.upsertTask` | 在 room 的 `Y.Doc` 上创建/更新 `kind: "task"` 节点 |
| `MemoryGraph.updateTaskStatus` | 修改已有任务的 `status` 及可选字段 |
| `filterTasksByScope` | 按 `workspaceId` / `sessionId` 筛出任务节点 |
| `buildDemoTaskOps` | 种子 GraphOp：workspace/session + 3 条中文演示任务 + `contains` / `depends_on` / `assigned_to` |

```ts
import * as Y from "yjs";
import {
  applyGraphOps,
  buildDemoTaskOps,
  filterTasksByScope,
  MemoryGraph,
  readMemoryGraphSnapshot,
} from "@slisync/sync-sdk/graph";

const doc = new Y.Doc();
const graph = MemoryGraph.on(doc, "agent-1").init("room-graph");

const task = graph.upsertTask({
  workspaceId: "ws-demo",
  sessionId: "sess-demo",
  title: "审查导出流水线",
  status: "todo",
  priority: 1,
});

graph.updateTaskStatus(task.id, "in_progress", { assigneeId: "user-42" });

applyGraphOps(doc, buildDemoTaskOps("agent-1", "ws-demo", "sess-demo"), "agent-1");
const snap = readMemoryGraphSnapshot(doc);
const tasks = filterTasksByScope(snap?.nodes ?? [], {
  workspaceId: "ws-demo",
  sessionId: "sess-demo",
});
```

类型：`UpsertTaskInput`、`UpdateTaskPatch`；解析：`parseTaskData`（`@slisync/sync-schema`）。

---

## Agent 图策略（默认）

`DEFAULT_AGENT_GRAPH_POLICY` 默认允许：

- **节点种类：** 含 `task`
- **关系：** 含 `depends_on`、`assigned_to`（以及 `contains`、`related_to` 等）
- **操作：** `upsertNode`、`upsertEdge`、`addTag`、`addRef`

查看摘要：

```bash
npm run graph:policy
```

---

## CLI（Phase 2）

终端 1：

```bash
npm run dev
```

终端 2 — 可选，先写入 scoped memory（workspace/session 节点）：

```bash
npm run graph:seed
```

向 `example-room` 种子演示任务（`ws-demo` / `sess-demo`）：

```bash
npm run task:seed
```

期望输出：`[task:seed] ok room=example-room ...`

按标题 upsert 单条任务（稳定 node id，与 agent push 同路径）：

```bash
npm run agent:push -- --task-title "审查导出流水线" --status in_progress
```

旧版 message 补丁（不变）：

```bash
npm run agent:push -- --action summarize --append " [from agent]"
```

环境变量与 `graph:seed` 相同：`SYNC_URL`、`SYNC_ROOM`、`SYNC_AGENT_ID`。覆盖策略时见 `.env.example` 中 `SYNC_AGENT_GRAPH_KINDS`（须含 `task`）。

---

## 5 分钟手动验收（Demo）

前置：**Node ≥ 20.9**，终端 1 已 `npm run dev` 并出现 `Local: http://localhost:3000`。

| 步骤 | 操作 | 期望 |
|------|------|------|
| 1 | 浏览器打开 Demo，策略 **CRDT** | 见「共享记忆 · Scoped Memory」；默认 **记忆** Tab |
| 2 | 确认 ScopeBar：`ws-demo` / `sess-demo` | 与 `graph:seed` / `task:seed` 一致 |
| 3 | 切换到 **任务看板** Tab | 空 room 时提示运行 `npm run task:seed` |
| 4 | 终端 2：`npm run task:seed` | `[task:seed] ok room=example-room ...` |
| 5 | 任务看板出现待办 / 进行中 / 已完成 分栏 | ≥3 条中文演示任务 |
| 6 | 点击任务卡片，在详情区将 status 改为「进行中」 | 本页即时更新 |
| 7 | 再开一浏览器窗口同 URL，**任务看板** Tab | 数秒内看到相同 status（CRDT） |
| 8 | 终端 2：`npm run agent:push -- --task-title "审查导出流水线" --status in_progress` | 顶部琥珀色 **任务变更** toast；看板内活动提示（无需展开底部 agentLog） |
| 9 | （可选）**记忆** Tab 仍可按 [demo-scoped-memory.md](./demo-scoped-memory.md) 编辑 chunk | 两 Tab 互不破坏 |

---

## 故障排查

| 现象 | 处理 |
|------|------|
| `[task:seed] failed` / 连接错误 | 先 `npm run dev`；确认 `SYNC_URL` 指向 dev 端口（默认 `http://127.0.0.1:3000`） |
| `node kind not allowed: task` | 服务端 `SYNC_AGENT_GRAPH_KINDS` 未含 `task`；对照 `.env.example` 恢复默认或显式包含 `task` |
| 任务看板为空 | 执行 `npm run task:seed`；确认 Scope 为 `ws-demo` / `sess-demo`（非 `ws-task-test`，后者仅用于自动化测试） |
| 第二窗口 status 不同步 | 两窗口须同一 URL、同一 room（默认 `example-room`）；等待 `connected` / `syncReady` |
| `agent:push` 无任务反馈 | 带 `--task-title` 与 `--status`（`todo` \| `in_progress` \| `done`）；或先 `task:seed` 再普通 `agent:push` 观察 graph 活动 |
| 误查 IndexedDB 任务表 | **无**独立任务 object store；任务仅在 Graph 节点中，IndexedDB 仅存 room 级 CRDT 快照 |

---

## 明确不做

| 不做 | 说明 |
|------|------|
| Workflow 引擎 | 愿景 11；无触发器、无 DAG 编排（见 [ROADMAP.md](./ROADMAP.md)） |
| 独立 DB 任务表 | 不用 IndexedDB / PostgreSQL 单独存任务行；权威数据为 `kind: "task"` 图节点 |
| `sync:task-*` socket 事件 | 任务变更走既有 `sync:crdt-update` / `sync:agent-push` + `graphOps` |
| `export:chunks` 导出任务 | 导出管线仅针对 `memory_chunk` Markdown，不读 IDB 拼任务列表 |

---

## 交付阶段

| 阶段 | 包含 | 不包含 |
|------|------|--------|
| 0 | `TaskData`、`parseTaskData`、策略默认、设计文档 | SDK 辅助方法、Demo UI |
| 1 | `upsertTask`、`updateTaskStatus`、`filterTasksByScope`、`buildDemoTaskOps` | Demo UI、`sync:task-*` 事件 |
| 2 | `task:seed` CLI、服务端策略默认、`agent:push --task-title` | Demo UI、`sync:task-*` 事件 |
| 3 | Demo **任务看板** Tab、改 status、任务向 toast | 拖拽排序、`GraphActivityPayload.nodeId` |
| 4 | 集成测试 A/B（`task-bus-sync.test.ts`） | 仅 IndexedDB 的任务表 |
| 5 | 本文档、ROADMAP 愿景 10 ✅、README / Demo 交叉链接 | Workflow、独立任务 DB |

**Follow-up：** 可选 `GraphActivityPayload.nodeId` 自动定位任务卡片。

---

## 测试（Phase 4）

集成测试使用独立 scope `ws-task-test` / `sess-task-test`（不污染 `example-room` 演示数据）。

```bash
npm test
# 仅任务总线同步：
npx tsx --test tests/integration/task-bus-sync.test.ts
```

| 用例 | 验证内容 |
|------|----------|
| **A** | 同 room 双客户端：writer `upsertTask` + `updateTaskStatus` → reader 快照 `status` 一致 |
| **B** | `pushAgentMemory` + `buildTaskUpsertOps` → 已连接 reader 观察到 task 节点 |

上文 Demo 手动步骤（`task:seed`、任务看板 Tab）与 B（Agent 路径）、A（UI 改 status）一致。

---

## 相关链接

- [demo-scoped-memory.md](./demo-scoped-memory.md) — workspace → session → memory_chunk 演示
- [local-first.md](./local-first.md) — CRDT + IndexedDB room 持久化（非任务库）
- [ROADMAP.md](./ROADMAP.md) — 阶段规划
