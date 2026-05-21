# @slisync/sync-sdk

Browser and Node client for **[Slisync](https://slisync.com)** — room realtime sync (LWW + Yjs CRDT) and **Memory Graph**.

[English](../../README.md) · [中文](../../README.zh-CN.md) · Vision: [docs/en/VISION.md](../../docs/en/VISION.md) · Tech: [packages/README.md](../README.md)

```bash
npm install @slisync/sync-sdk @slisync/sync-schema
```

Peer dependency: `react` ^18 or ^19（`useSync` / `useMemoryGraph` hooks）。

### Quick usage

```ts
import { useSync, MemoryGraph, createSyncStore } from "@slisync/sync-sdk";

const store = createSyncStore({ message: "Hello", counter: 0 });
const { data, patchData, syncReady, getCrdtDocument } = useSync({
  roomId: "example-room",
  defaultState: { message: "Hello", counter: 0 },
  strategy: "crdt",
  store,
});
```

Subpaths: `@slisync/sync-sdk/agent`, `@slisync/sync-sdk/graph`, `@slisync/sync-sdk/crdt`, `@slisync/sync-sdk/protocol`.
