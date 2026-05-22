# Task bus

[中文](../zh/task-bus.md)

Slisync provides a **room-level, graph-native task bus**: tasks live in `kind: "task"` nodes, sharing the same **Y.Doc / CRDT** as scoped memory.

::: tip No `sync:task-*` events
Task changes use `sync:crdt-update` and `sync:agent-push` (with `graphOps`).
:::

## Tasks vs `memory_chunk`

| Dimension | `memory_chunk` | `task` |
|-----------|----------------|--------|
| Purpose | Memory snippets | Actionable work items |
| Core fields | `content`, `importance` | `status`, `scope` |
| Markdown export | Yes | No |

See [Export Markdown](./export.md).
