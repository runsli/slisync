# Slisync

**Realtime shared-memory sync for multi-agent rooms** (*sli* = scoped live information)

[中文](../zh/VISION.md) · [slisync.com](https://slisync.com)

---

## 1. What is this project?

This is not a chat app, not Web3, and not a thin AI wrapper.

It is an **AI-native realtime sync engine** for **shared memory and live state** across clients.

### Goals

Enable multiple AIs (coding, browser, planning, research, etc.) to work like a human team with:

- **Shared Memory**
- **Shared State**
- **Shared Tasks**
- **Shared Context**
- **Long-term Collaboration**

This repository is the **Slisync** reference open-source implementation: a runnable Demo plus npm packages (`@slisync/sync-schema`, `@slisync/sync-sdk`, `@slisync/sync-server`) that prove the protocol and consistency model.

---

## 2. Why it matters

### Forget-after-chat

Most AIs still run as isolated sessions. As device and enterprise agents multiply, they need one memory space per project—not siloed copies.

### Multi-agent bottleneck

Complex work (e.g. “build a Shopify store”) needs specialized agents:

- **Planning Agent** — breakdown
- **Coding Agent** — implementation
- **Testing Agent** — verification

Without a shared memory space, handoffs are slow and error-prone.

---

## 3. Tech stack (this repo today)

| Layer | Technology | Notes |
|-------|------------|-------|
| Demo UI | Next.js, TypeScript, Tailwind | `app/`, `src/components/` |
| Client state | Zustand | `createSyncStore` |
| Transport | **Socket.IO** | Production path; WebRTC is future |
| Consistency | **Yjs / CRDT** | Primary; optional LWW + JSON Patch |
| Server persistence | Node.js, **Redis** (optional), JSON files | PostgreSQL not yet |
| Local-first | **IndexedDB** + CRDT offline outbox | Browser persistence for room snapshot + outbox — [local-first.md](./local-first.md) |

---

## 4. Twelve-phase product roadmap

Full status mapping: **[ROADMAP.md](./ROADMAP.md)**.

| Phase | Theme | Summary |
|-------|-------|---------|
| **1** | Realtime Sync | Multi-client sync, reconnect, rooms |
| **2** | Local-first | IndexedDB, offline queue, replay |
| **3** | Patch Sync | JSON Patch / diff transport |
| **4** | Persistence | Redis / DB survive restarts |
| **5** | Conflict Resolution | CRDT (Yjs) merge |
| **6** | SDK productization | npm-installable SDK + server |
| **7** | Memory Layer | Long-lived preferences, project context |
| **8** | Memory Graph | Entities and relations (projects, chunks, …) |
| **9** | Semantic Memory | Embeddings / vector search (**out of scope here**) |
| **10** | Multi-Agent | Shared event bus, task progress |
| **11** | Workflow Engine | Triggers from shared state |
| **12** | AI Runtime / AI OS | Scheduling and memory layer for AI era |

---

## 5. SDK usage (aligned with current API)

Install via **`@slisync/sync-sdk`** (monorepo workspace or npm after publish):

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

Headless agents: `pushAgentMemory()`, `pushGraphOpsHttp()` — see [packages/README.md](../../packages/README.md).

---

## 6. Directory layout (vision vs this repo)

**Target shape:**

```text
apps/demo-app/
packages/sync-sdk, sync-core, sync-protocol/
services/sync-server/
docs/  examples/
```

**Current repo layout:**

```text
slisync/
├── app/ src/                 # Next.js Demo
├── server.ts                 # Custom server with sync
├── packages/
│   ├── sync-schema/          # Protocol + graph schema
│   ├── sync-sdk/             # Client SDK
│   └── sync-server/          # Server
├── docs/en/ docs/zh/         # Bilingual docs
├── scripts/
└── tests/integration/
```

---

## 7. Principles

### We optimize for

1. **Local-first direction** — edit locally; sync enhances; grow offline + persistence.
2. **Simple API** — Demo in minutes (`npm run dev`).
3. **Stability** — reconnect, consistency, protocol version before feature sprawl.
4. **Developer trust** — open implementation, tests, docs aligned with code.

### We do not (now)

1. **No Web3** — no token narrative.
2. **No over-engineering** — no full agent orchestration framework in v1.
3. **No super app** — infrastructure, not a chat shell.
4. **No semantic / vector / reasoning** — vision phase 9 is excluded (see ROADMAP).

---

## 8. Business vision

- **Open source:** SDK, protocol, base server, documentation.
- **Future commercial:** hosted Cloud Sync, Enterprise Memory, AI Coordination API.

**Summary:** **Slisync** is the sync-and-link layer in the Aonote ecosystem: room CRDT + scoped memory, then export to 笺. Today's engineering focus is **reliable multi-client state sync and Memory Graph**, with evolvable protocol (`protocolVersion`) and observability (audit, capabilities).

---

## Related docs

- [ROADMAP.md](./ROADMAP.md)
- [README.md](../../README.md)
- [packages/README.md](../../packages/README.md)
