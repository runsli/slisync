# Slisync

**One shared project memory for people and multiple AIs** — edit together in realtime, export **Markdown** when you are ready to publish.

[中文](./README.zh-CN.md) · [GitHub](https://github.com/runsli/slisync) · [slisync.com](https://slisync.com)

> GitHub repo: [runsli/slisync](https://github.com/runsli/slisync). Clone into a folder named `slisync`.  
> **room** = collaboration space; **memory_chunk** = an exportable memory snippet.

---

## I want to…

| I want to… | How |
|------------|-----|
| **Try shared memory in 5 minutes** | [Quick start](#quick-start) → open **Shared memory** in the demo |
| **Read product docs (website)** | [slisync-docs](../slisync-docs/) → `cd ../slisync-docs && npm run dev` (:5173) |
| **Export memory as Markdown** | [docs/en/export.md](./docs/en/export.md) |
| **Integrate into my app** | [packages/README.md](./packages/README.md) · [docs/en/](./docs/en/) |
| **Protocol & implementation status** | [docs/en/ROADMAP.md](./docs/en/ROADMAP.md) |

**Docs split:** user-facing site = **[slisync-docs](../slisync-docs/)** only (not `文档/` under this repo). This repo’s `docs/en` is protocol and engineering detail.

---

## What is it?

Not a chat app, not Web3, not a thin LLM wrapper.

**Slisync** keeps **project memory in one place** while humans and agents collaborate, then **publishes** what matters via Markdown export. Under the hood: **Socket.IO + Yjs CRDT**; agents write via Socket or HTTP.

| Package | Role |
|---------|------|
| `@slisync/sync-schema` | Graph types, `GraphOp`, auth, protocol version |
| `@slisync/sync-sdk` | Client hooks, Zustand, CRDT/LWW, `MemoryGraph` |
| `@slisync/sync-server` | Socket server, persistence, Graph HTTP, Presence |

---

## Why it matters

1. **Forget-after-chat** — one room-level memory, not per-agent silos.
2. **Multi-agent work** — planning / coding / testing agents read and write the same space.

Details: [docs/en/VISION.md](./docs/en/VISION.md#2-why-it-matters).

---

## Roadmap

12-phase product vision vs implementation: [docs/en/ROADMAP.md](./docs/en/ROADMAP.md) · Markdown export: [docs/en/export.md](./docs/en/export.md) · HTTP: [docs/en/export-http.md](./docs/en/export-http.md)

| Vision | Theme | This repo |
|--------|-------|-----------|
| 1–3 | Realtime / local-first / patch | ✅ realtime + patch + [IndexedDB local-first](./docs/en/local-first.md) |
| 4–6 | Persistence / CRDT / SDK | ✅ |
| 7–8 | Memory layer / graph | ✅ [scoped memory Demo](./docs/en/demo-scoped-memory.md); ✅ graph + HTTP |
| 9 | Semantic search | ⛔ excluded |
| 10–12 | Multi-agent / workflow / AI OS | ✅ [room task bus](./docs/en/task-bus.md); ⬜ workflow & OS |

Engineering phases 1–11, P0–P3: [packages/README.md](./packages/README.md#engineering-phases).

---

## Quick start

Requires **Node ≥ 20.9**.

```bash
nvm use 20
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Open **Shared memory** to edit project notes with live sync; **Task board** for kanban-style work (`npm run task:seed`). Edits survive refresh — [local-first](./docs/en/local-first.md). Walkthrough: [demo-scoped-memory](./docs/en/demo-scoped-memory.md).

```bash
npm run graph:seed
npm run export:chunks:http -- --room example-room --out ./markdown/chunks
npm run task:seed
npm run agent:push -- --task-title "Review export pipeline" --status in_progress
```

Export loop: seed memory → `export:chunks:http` ([export-http.md](./docs/en/export-http.md)); offline: `npm run export:chunks`. Publish with your own static site or CMS.

> Legacy `message` / `counter` and LWW comparison live under collapsed **legacy shared fields** and **Advanced: LWW** sections.

Standalone sync server:

```bash
npm run sync:server          # :3001
NEXT_PUBLIC_SYNC_URL=http://localhost:3001 npm run dev
```

### SDK sketch

```ts
import { useSync, MemoryGraph, createSyncStore } from "@slisync/sync-sdk";

const store = createSyncStore({ message: "Hello", counter: 0 });
const { patchData, syncReady, getCrdtDocument } = useSync({
  roomId: "my-project",
  defaultState: { message: "Hello", counter: 0 },
  strategy: "crdt",
  store,
});

patchData({ message: "Stripe integration in progress" });

const doc = getCrdtDocument();
if (doc && syncReady) {
  MemoryGraph.on(doc, "agent-1")
    .init("my-project")
    .upsertChunk({
      workspaceId: "ws-main",
      title: "Payment notes",
      content: "Use Stripe Checkout.",
    });
}
```

---

## Architecture

```mermaid
flowchart LR
  subgraph clients [Clients]
    Browser[Next.js Demo]
    AgentSocket[Agent scripts]
    AgentHttp[HTTP agents]
  end
  subgraph server [Sync server]
    IO[Socket.IO]
    HTTP[Graph HTTP API]
    CRDT[Yjs CRDT authority]
    LWW[LWW projection]
  end
  Browser --> IO
  AgentSocket --> IO
  AgentHttp --> HTTP
  IO --> CRDT
  HTTP --> CRDT
  IO --> LWW
```

`npm run dev` serves UI + sync on **:3000** via a custom Next server.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Next + embedded sync (:3000) |
| `npm run sync:server` | Sync only (:3001) |
| `npm run sync:reset` | Clear local persistence |
| `npm run agent:push` | Socket agent write |
| `npm run graph:seed` | Agent seeds scoped graph (default) |
| `npm run task:seed` | Agent seeds demo tasks into `example-room` |
| `npm run graph:push:http` | HTTP graph ops |
| `npm run graph:traverse:http` | HTTP graph traverse |
| `npm test` | Unit + integration tests (64 cases) |
| `npm run test:cluster` | Two instances + Redis (`REDIS_URL`) |
| `npm run build:packages` | Build `dist/` for npm publish |

Environment: [.env.example](./.env.example)

---

## Layout

```text
slisync/
├── app/ src/              # Next.js Demo
├── server.ts              # Custom server (sync mounted)
├── packages/
│   ├── sync-schema/
│   ├── sync-sdk/
│   └── sync-server/
├── docs/
│   ├── en/                # English (default)
│   └── zh/                # 中文
├── scripts/
└── tests/integration/
```

---

## Principles

- **Local-first direction** — IndexedDB snapshot + outbox persistence in the browser ([local-first.md](./docs/en/local-first.md)).
- **Simple API** — Demo in minutes.
- **Stability** — protocol version, CRDT authority, reconnect, tests.
- **Out of scope** — Web3, chat super-app, vectors / embeddings / reasoning.

---

## Documentation

### Product site (VitePress)

Run from the **slisync-docs** sibling repo (clone next to this repo):

```bash
cd ../slisync-docs
nvm use 20
npm install
npm run dev      # http://localhost:5173
npm run build
```

Do not use `infra/文档/GitHub/` — that path is obsolete.

| Site | Repo |
|------|------|
| User docs & guides | [slisync-docs](../slisync-docs/) |

### In-repo (protocol / engineering)

| Doc | Language |
|-----|----------|
| [docs/en/VISION.md](./docs/en/VISION.md) | English |
| [docs/zh/VISION.md](./docs/zh/VISION.md) | 中文 |
| [docs/en/ROADMAP.md](./docs/en/ROADMAP.md) | English |
| [docs/zh/ROADMAP.md](./docs/zh/ROADMAP.md) | 中文 |
| [docs/en/export.md](./docs/en/export.md) | English |
| [docs/zh/export.md](./docs/zh/export.md) | 中文 |
| [docs/en/story-pipeline.md](./docs/en/story-pipeline.md) | English |
| [docs/zh/story-pipeline.md](./docs/zh/story-pipeline.md) | 中文 |
| [docs/en/demo-scoped-memory.md](./docs/en/demo-scoped-memory.md) | English |
| [docs/zh/demo-scoped-memory.md](./docs/zh/demo-scoped-memory.md) | 中文 |
| [packages/README.md](./packages/README.md) | English (technical) |
| [packages/README.zh-CN.md](./packages/README.zh-CN.md) | 中文（技术） |
| [docs/README.md](./docs/README.md) | Index |

---

## Tests

```bash
npm test
```

In-process ephemeral server: CRDT, HTTP graph, auth, presence, capabilities, offline outbox, etc.

---

## Stack

Next.js · TypeScript · Tailwind · Zustand · Socket.IO · Yjs · Redis (optional) · Node.js

Future: WebRTC, PostgreSQL, IndexedDB — [docs/en/ROADMAP.md](./docs/en/ROADMAP.md).

---

## License

Licensed under the [MIT License](LICENSE). Published `@slisync/*` packages use the same license.
