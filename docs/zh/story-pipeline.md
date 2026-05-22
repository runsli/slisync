# 共忆 → Markdown → 静态站

[English](../en/story-pipeline.md)

::: info 本页你将完成
- [ ] 在 Slisync 里编辑记忆片段
- [ ] HTTP 导出 Markdown 到本地目录
- [ ] 把文件交给自选的静态站或 CMS
:::

可演示链路：前两步约 **15 分钟**；第 3 步取决于你的建站工具。

## 1. 共忆（slisync）

```bash
cd ~/Documents/GitHub/slisync
nvm use 20 && npm install && npm run dev
```

另开终端：

```bash
npm run graph:seed
```

详见 [分层记忆演示](./demo-scoped-memory.md)、[任务看板](./task-bus.md)。

## 2. 导出 Markdown

```bash
npm run export:chunks:http -- --room example-room --out ./markdown/chunks
```

**期望**：`count >= 1`，且存在 `markdown/chunks/ws-demo/sess-demo/*.md`。

::: warning 导出读服务端
仅已同步到 **服务端 CRDT** 的片段会出现在导出中。见 [离线优先](./local-first.md)。
:::

## 3. 发布（你的工具链）

Slisync **不**内置博客产品。将 `markdown/chunks/**` 复制或同步到你的内容目录，按工具的 schema 使用 `title`、`date` 等字段，再运行 `build` / `dev`。

## 4. 边界

| 做 | 不做 |
|----|------|
| 协作、导出 Markdown 快照 | 发布站点改字自动回写 room |
| 任务看板跟执行 | 把 task 当博客文章导出 |

## 相关

[导出 Markdown](./export.md) · [HTTP 导出](./export-http.md)

**官网（更易读）**：[slisync-docs](https://github.com/runsli/slisync-docs) 同名章节。
