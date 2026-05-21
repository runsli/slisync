# Roadmap: product vision × implementation

[中文](../zh/ROADMAP.md)

This document maps the **12-phase product vision** in [VISION.md](./VISION.md) to the **current Slisync reference repo**. Engineering phases (1–11, P0–P3) are listed in [packages/README.md](../../packages/README.md#engineering-phases).

---

## Legend

| Mark | Meaning |
|------|---------|
| ✅ | Shipped on main; Demo or tests |
| 🟡 | Partial or server-only / demo-only |
| ⬜ | Not started; kept in vision |
| ⛔ | Explicitly out of scope |

---

## Twelve phases

### Foundations

| Vision | Theme | Status | In this repo |
|--------|-------|--------|--------------|
| **1** | Realtime Sync | ✅ | Socket.IO rooms, `sync:join` / `sync:crdt-join`, reconnect — **eng. Phase 1** |
| **2** | Local-first | ✅ | **P2-9** outbox + IndexedDB hydrate / flush — [local-first.md](./local-first.md) |
| **3** | Patch Sync | ✅ | `sync:patch` RFC 6902 — **eng. Phase 2** |

### Stability

| Vision | Theme | Status | In this repo |
|--------|-------|--------|--------------|
| **4** | Persistence | ✅ | Memory / JSON / `REDIS_URL` — **eng. Phase 3** |
| **5** | Conflict Resolution | ✅ | Yjs CRDT primary; LWW optional — **P1-4** authority |
| **6** | SDK productization | ✅ | `@slisync/*`, `build:packages` — **P0-3** |

### AI-native layer

| Vision | Theme | Status | In this repo |
|--------|-------|--------|--------------|
| **7** | Memory Layer | ✅ | Demo centered on scoped memory — [demo-scoped-memory.md](./demo-scoped-memory.md) (**P2-7**) |
| **8** | Memory Graph | ✅ | Yjs `graph/`, `MemoryGraph`, `graphOps`, HTTP traverse — **eng. Phase 7–10** |
| **9** | Semantic Memory | ⛔ | No embedding / vector / reasoning engine |

### Collaboration

| Vision | Theme | Status | In this repo |
|--------|-------|--------|--------------|
| **10** | Multi-Agent | ✅ | Room task bus, `sync:agent-push`, **P2-8 Presence**, graph activity — [task-bus.md](./task-bus.md) |
| **11** | Workflow Engine | ⬜ | No workflow / trigger product layer |
| **12** | AI Runtime / AI OS | ⬜ | Long-term vision |

---

## Engineering milestones

Parallel **engineering IDs** (commits / comments):

| Engineering | Status | Summary |
|-------------|--------|---------|
| Phase 1–6 | ✅ | Shared memory → patch → persistence → LWW → packages → agent push |
| Phase 7–11 | ✅ | Graph, auth, activity, HTTP API, integration tests |
| P0 | ✅ | Protocol v1, Redis adapter, npm build |
| P1 | ✅ | CRDT authority, incremental agent CRDT, audit |
| P2 | ✅ | Scoped memory, Presence, offline outbox |
| P3 | ✅ | Force layout, strategy panel, capabilities API, docs |

---

## Suggested reading order

1. Motivation → [VISION.md](./VISION.md)
2. Scoped memory Demo → [demo-scoped-memory.md](./demo-scoped-memory.md)
3. Room task bus → [task-bus.md](./task-bus.md) (`task:seed`, task board tab)
4. Aonote export → [export.md](./export.md) (M0–M2)
5. Run app → [README.md](../../README.md)
6. Protocol & API → [packages/README.md](../../packages/README.md)
7. Config → [.env.example](../../.env.example)

---

## Likely next steps (not committed dates)

1. ✅ **Aonote export M0–M2** — [export.md](./export.md)
2. ✅ **Vision 2** — IndexedDB + unified outbox — [local-first.md](./local-first.md)
3. ✅ **Vision 7** — Demo centered on scoped memory — [demo-scoped-memory.md](./demo-scoped-memory.md)
4. ~~**Vision 10** — Room-level agent task bus~~ — done; see [task-bus.md](./task-bus.md)
5. **Vision 4** — Optional PostgreSQL / HTTP export (M4)

**Not planned here:** vision 9 (semantic search), Web3, chat super-app.
