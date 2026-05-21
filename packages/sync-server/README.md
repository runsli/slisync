# @slisync/sync-server

Socket.IO sync server for **[Slisync](https://slisync.com)**: optional Redis persistence, cluster adapter, Graph HTTP, Presence, audit.

[English](../../README.md) · [中文](../../README.zh-CN.md) · [packages/README.md](../README.md)

```bash
npm install @slisync/sync-server @slisync/sync-sdk @slisync/sync-schema
```

```bash
# From monorepo root
npm run sync:server
```

Health: `GET /health` · Capabilities: `GET /v1/sync/capabilities`
