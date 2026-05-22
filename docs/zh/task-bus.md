# 任务看板

[English](../en/task-bus.md)

Slisync **room 级、图原生任务总线**：任务在 `kind: "task"` 节点中，与 scoped memory **共用同一 Y.Doc / CRDT**。

::: tip 没有 sync:task-* 事件
任务变更通过 `sync:crdt-update` 与 `sync:agent-push`（含 `graphOps`）完成。
:::

## 任务 vs memory_chunk

| 维度 | `memory_chunk` | `task` |
|------|----------------|--------|
| 用途 | 记忆片段、上下文正文 | 可执行工作项 |
| 核心字段 | `content`、`importance` | `status`、`scope` |
| Markdown 导出 | ✅ | ❌ |

详见 [导出 Markdown](./export.md)。
