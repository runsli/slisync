# Local-first (Vision 2)

[中文](../zh/local-first.md)

Slisync is adding **client-side persistence** so CRDT room state and pending updates survive page refresh and brief offline edits. Server-side CRDT remains the merge authority after reconnect.

---

## Goal

| Theme | Target |
|-------|--------|
| Vision 2 | Local-first: IndexedDB, offline queue, replay on connect |
| Engineering | Extends **P2-9** (CRDT outbox + reconnect flush) with durable storage |

Today: `CrdtUpdateOutbox` is in-memory only; `disconnect()` clears the queue.  
Next phases wire IndexedDB and hydrate `Y.Doc` before `CRDT_JOIN`.

---

## `RoomLocalRecord` (schema v1)

Stored per `roomId` in IndexedDB object store `rooms` (database `slisync`, version `1` — implemented in Phase 1).

| Field | Type | Meaning |
|-------|------|---------|
| `schemaVersion` | `1` | Migration hook |
| `roomId` | string | Room key |
| `strategy` | `"crdt"` | LWW not persisted in v1 |
| `docSnapshot` | string (base64) | `Y.encodeStateAsUpdate(doc)` |
| `outbox` | `string[]` | FIFO base64 incremental updates pending upload |
| `clientId` | `string \| null` | Stable client id across sessions |
| `lastSyncedAt` | `number \| null` | Last successful server sync (Unix ms) |
| `updatedAt` | `number` | Last local write (Unix ms) |

Types: `@slisync/sync-sdk` — `RoomLocalRecord`, `isRoomLocalRecord`, `LocalRoomStore`, `CrdtOutbox`.

---

## IndexedDB schema (Phase 1)

| Item | Value |
|------|--------|
| Database | `slisync` |
| Version | `1` |
| Object store | `rooms` |
| Key path | `roomId` |
| Value | `RoomLocalRecord` (structured clone) |

### `LocalRoomStore` API

| Method | Behavior |
|--------|----------|
| `get(roomId)` | Returns record or `null` if missing or invalid schema |
| `put(record)` | Validates record, sets `updatedAt` to now, upserts |
| `delete(roomId)` | Removes record |
| `listRoomIds()` | All keys in `rooms` |

Factory functions:

- `createIndexedDBRoomStore()` — browser; throws if IndexedDB unavailable
- `createNoopLocalRoomStore()` — in-memory `Map` for Node tests and `localPersistence: false`
- `isIndexedDBAvailable()` — feature detect

Quota: `put` may throw `LocalRoomQuotaExceededError` when storage is full.

### Outbox API (Phase 2)

| Export | Role |
|--------|------|
| `InMemoryCrdtOutbox` | FIFO queue in memory |
| `CrdtUpdateOutbox` | Alias of `InMemoryCrdtOutbox` (back-compat) |
| `PersistentCrdtOutbox` | Memory queue + debounced `outbox` field on `LocalRoomStore` |
| `createCrdtOutbox({ roomId, persistence })` | `false` → memory; `true` → IDB or noop; or inject `LocalRoomStore` |
| `clearLocalRoom(roomId)` | Delete persisted record for a room |
| `useSync({ localPersistence })` | Passed to `CrdtSyncClient` (default: browser on) |

### Client lifecycle (Phase 3)

1. `connect()` → load `RoomLocalRecord` → apply `docSnapshot` → hydrate `outbox` → Socket `CRDT_JOIN`
2. Local edits → debounced `docSnapshot` + outbox enqueue while not synced
3. `markSynced` → flush outbox → `lastSyncedAt` + clear persisted outbox
4. `disconnect()` → persist snapshot (does **not** clear outbox in memory store)

---

## IndexedDB decision

**Phase 0–1:** use the native `indexedDB` API (no new dependency).  
Re-evaluate the [`idb`](https://github.com/jakearchibald/idb) wrapper only if upgrade/migration code becomes unwieldy.

**Phase 0:** types + `LocalRoomStore` + in-memory `createNoopLocalRoomStore()` only — no `CrdtSyncClient` change.

**Phase 1:** `createIndexedDBRoomStore()` + unit tests (`fake-indexeddb` devDependency).

---

## Phase plan

| Phase | Deliverable |
|-------|-------------|
| **0** ✅ | `RoomLocalRecord`, `LocalRoomStore`, `CrdtOutbox` types, docs |
| **1** ✅ | `createIndexedDBRoomStore()`, `tests/unit/indexeddb-room-store.test.ts` |
| **2** ✅ | `PersistentCrdtOutbox`, `createCrdtOutbox()`, `InMemoryCrdtOutbox` |
| **3** ✅ | `CrdtSyncClient` hydrate + snapshot persist; `useSync({ localPersistence })` |
| **4** | Integration tests (refresh / second client instance) |
| **5** | Demo UI + ROADMAP ✅ for Vision 2 |

**Follow-up:** export chunks from local store; multi-tab coordination.

---

## Related

- [ROADMAP.md](./ROADMAP.md) — Vision 2 status
- [VISION.md](./VISION.md) — product principles
- [packages/README.md](../../packages/README.md) — SDK API
