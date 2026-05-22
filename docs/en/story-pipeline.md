# Memory → Markdown → site

[中文](../zh/story-pipeline.md)

::: info You will
- [ ] Edit memory snippets in Slisync
- [ ] HTTP-export Markdown to disk
- [ ] Point your static site or CMS at those files
:::

Demonstrable pipeline: steps 1–2 in ~15 minutes; step 3 depends on your publisher.

## 1. Live memory (slisync)

```bash
cd ~/Documents/GitHub/slisync
nvm use 20 && npm install && npm run dev
```

Second terminal:

```bash
npm run graph:seed
```

See [Scoped memory demo](./demo-scoped-memory.md) · [Task bus](./task-bus.md).

## 2. Export Markdown

```bash
npm run export:chunks:http -- --room example-room --out ./markdown/chunks
```

**Expect**: `count >= 1` and files under `markdown/chunks/ws-demo/sess-demo/*.md`.

::: warning Server-side source
Only chunks synced to **server CRDT** appear in export. See [Local-first](./local-first.md).
:::

## 3. Publish (your toolchain)

Slisync does **not** ship a blog product. Copy or sync `markdown/chunks/**` into your content directory, map `title` / `date` to your schema, then run `build` / `dev`.

## 4. Boundaries

| Do | Do not |
|----|--------|
| Collaborate, snapshot export | Published-file write-back to the room |
| Task board for execution | Export `task` nodes as posts |

## Related

[Export Markdown](./export.md) · [HTTP export](./export-http.md)

**Website (narrative)**: same chapter in [slisync-docs](https://github.com/runsli/slisync-docs).
