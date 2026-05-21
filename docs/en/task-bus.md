# Room task bus (Phase 0)

[中文](../zh/task-bus.md)

This document defines the **graph-native task model** for Slisync rooms: authoritative task state lives in the shared Memory Graph as `kind: "task"` nodes, not in a separate IndexedDB task table or new socket events.

Related: [demo-scoped-memory.md](./demo-scoped-memory.md) · [local-first.md](./local-first.md) · [packages/README.md](../../packages/README.md)

---

## Data flow

```mermaid
flowchart TB
  subgraph scope [Workspace scope]
    WS[workspace]
    TK[task]
    CH[memory_chunk optional]
  end
  subgraph clients [Clients]
    A[Browser A]
    B[Browser B]
    AG[Agent CLI]
  end
  subgraph sync [Slisync room e.g. example-room]
    CRDT[Y.Doc / CRDT graph]
    IDB[(IndexedDB room snapshot)]
  end
  WS --> TK
  TK -.->|related_to optional| CH
  A --> CRDT
  B --> CRDT
  AG -->|agent:push / graph:seed| CRDT
  CRDT --> IDB
  A --> IDB
```

Tasks are **nodes** in the same CRDT-backed graph as scoped memory. Clients and agents mutate them via existing graph ops (`upsertNode`, `upsertEdge`) inside `agent:push` or room CRDT updates — **no** `sync:task-*` socket events in Phase 0.

---

## Task vs scoped memory

| Aspect | `memory_chunk` (scoped memory) | `task` (task bus) |
|--------|-------------------------------|-------------------|
| Purpose | Durable AI/user notes per workspace/session | Actionable work items (status, assignee, due date) |
| Primary `data` | `content`, `importance`, `scope` | `status`, `scope`, optional `assigneeId`, `priority`, `dueAt` |
| Typical edges | `contains` from session | `depends_on`, `assigned_to`, optional `related_to` → chunk |
| Parser | `parseMemoryChunkData` | `parseTaskData` |

A task may link to a memory chunk with **`related_to`** when context should stay in the chunk body but the task tracks execution.

---

## `TaskData` (schema)

Types live in `@slisync/sync-schema` (`task-model.ts`):

| Field | Type | Required |
|-------|------|----------|
| `scope` | `MemoryScope` (`workspaceId`, optional `sessionId`) | yes |
| `status` | `todo` \| `in_progress` \| `blocked` \| `done` \| `cancelled` | yes |
| `assigneeId` | string | no |
| `priority` | number | no |
| `dueAt` | ISO-8601 string | no |
| `source` | string (e.g. `agent:push`) | no |

Example node payload:

```json
{
  "kind": "task",
  "title": "Review scoped memory export",
  "data": {
    "scope": { "workspaceId": "ws-demo", "sessionId": "sess-demo" },
    "status": "todo",
    "priority": 1,
    "source": "agent:push"
  }
}
```

---

## SDK (Phase 1)

Exports from `@slisync/sync-sdk` / `@slisync/sync-sdk/graph`:

| API | Role |
|-----|------|
| `MemoryGraph.upsertTask` | Create or update a `kind: "task"` node on the room `Y.Doc` |
| `MemoryGraph.updateTaskStatus` | Change `status` and optional fields on an existing task |
| `filterTasksByScope` | Filter snapshot nodes to tasks matching `workspaceId` / `sessionId` |
| `buildDemoTaskOps` | Seed ops: workspace/session + 3 Chinese demo tasks + `contains` / `depends_on` / `assigned_to` |

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
  title: "Review export pipeline",
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

Types: `UpsertTaskInput`, `UpdateTaskPatch` from the same module. Parsing: `parseTaskData` from `@slisync/sync-schema`.

---

## Agent graph policy (default)

`DEFAULT_AGENT_GRAPH_POLICY` allows:

- **Node kinds:** includes `task`
- **Relations:** includes `depends_on`, `assigned_to` (plus `contains`, `related_to`, …)
- **Ops:** `upsertNode`, `upsertEdge`, `addTag`, `addRef`

Inspect defaults:

```bash
npm run graph:policy
```

---

## CLI (Phase 2)

Terminal 1:

```bash
npm run dev
```

Terminal 2 — seed scoped memory (optional, for workspace/session nodes):

```bash
npm run graph:seed
```

Seed demo tasks into `example-room` (`ws-demo` / `sess-demo`):

```bash
npm run task:seed
```

Expected: `[task:seed] ok room=example-room ...`

Upsert one task by title (stable node id, same path as agent push):

```bash
npm run agent:push -- --task-title "Review export pipeline" --status in_progress
```

Legacy message patch (unchanged):

```bash
npm run agent:push -- --action summarize --append " [from agent]"
```

Environment (same as `graph:seed`): `SYNC_URL`, `SYNC_ROOM`, `SYNC_AGENT_ID`. See `.env.example` for `SYNC_AGENT_GRAPH_KINDS` (must include `task` when overriding).

### Policy rejection (manual check)

With server env restricting kinds (no `task`), `npm run task:seed` should fail with a readable error, e.g. `node kind not allowed: task`.

---

## Delivery phases

| Phase | In scope | Out of scope |
|-------|----------|--------------|
| 0 | `TaskData`, `parseTaskData`, policy defaults, design docs | SDK helpers, Demo UI |
| 1 | `upsertTask`, `updateTaskStatus`, `filterTasksByScope`, `buildDemoTaskOps` | Demo UI, `sync:task-*` events |
| 2 | `task:seed` CLI, server policy defaults, `agent:push --task-title` | Demo UI, `sync:task-*` events |
| 3+ | Demo / activity integration (planned) | IndexedDB-only task tables |

---

## Related links

- [demo-scoped-memory.md](./demo-scoped-memory.md) — workspace → session → memory_chunk demo
- [local-first.md](./local-first.md) — CRDT + IndexedDB room persistence (not a task store)
- [ROADMAP.md](./ROADMAP.md) — delivery phases
