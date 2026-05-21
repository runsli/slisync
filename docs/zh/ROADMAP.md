# 路线图：产品愿景 × 工程实现

[English](../en/ROADMAP.md)（默认）

本文档对齐 [VISION.md](./VISION.md) 中的 **12 阶段产品路线图**，并标注 **Slisync 参考仓库**当前实现状态。  
工程 Phase 1–11 / P0–P3 见 [packages/README.zh-CN.md](../../packages/README.zh-CN.md#engineering-phases)。

---

## 状态图例

| 标记 | 含义 |
|------|------|
| ✅ | 已在主分支可用，有 Demo 或测试 |
| 🟡 | 部分实现 |
| ⬜ | 未开始 |
| ⛔ | 明确排除 |

---

## 12 阶段对照表

### 第一阶段：基础架构

| 愿景 | 主题 | 状态 | 本仓库实现 |
|------|------|------|------------|
| **1** | Realtime Sync | ✅ | Socket.IO、`sync:crdt-join` — **Phase 1** |
| **2** | Local-first | 🟡 | **P2-9** outbox；尚无 IndexedDB |
| **3** | Patch Sync | ✅ | `sync:patch` — **Phase 2** |

### 第二阶段：数据一致性与持久化

| 愿景 | 主题 | 状态 | 本仓库实现 |
|------|------|------|------------|
| **4** | Persistence | ✅ | 内存 / JSON / Redis — **Phase 3** |
| **5** | Conflict Resolution | ✅ | Yjs CRDT — **P1-4** |
| **6** | SDK 产品化 | ✅ | `@slisync/*` — **P0-3** |

### 第三阶段：AI 原生层

| 愿景 | 主题 | 状态 | 本仓库实现 |
|------|------|------|------------|
| **7** | Memory Layer | 🟡 | workspace/session/chunk — **P2-7** |
| **8** | Memory Graph | ✅ | Graph + HTTP — **Phase 7–10** |
| **9** | Semantic Memory | ⛔ | 不做向量 / 推理 |

### 第四阶段：多 Agent 协作

| 愿景 | 主题 | 状态 | 本仓库实现 |
|------|------|------|------------|
| **10** | Multi-Agent | 🟡 | agent push、Presence、graph activity |
| **11** | Workflow Engine | ⬜ | — |
| **12** | AI Runtime / AI OS | ⬜ | 长期愿景 |

---

## 工程里程碑

| 工程 | 状态 | 摘要 |
|------|------|------|
| Phase 1–6 | ✅ | memory → patch → 持久化 → LWW → 拆包 → agent |
| Phase 7–11 | ✅ | Graph、鉴权、HTTP、测试 |
| P0–P3 | ✅ | 协议、Redis、CRDT 权威、scoped memory、可视化 |

---

## 建议阅读顺序

1. [VISION.md](./VISION.md)
2. [export.md](./export.md) — 青笺 Memory Chunk 导出（M0–M2）
3. [README.zh-CN.md](../../README.zh-CN.md)
4. [packages/README.zh-CN.md](../../packages/README.zh-CN.md)
5. [.env.example](../../.env.example)

---

## 下一步（非承诺排期）

1. ✅ 青笺导出 M0–M2 — 见 [export.md](./export.md)  
2. IndexedDB + outbox 统一  
3. Demo 以 scoped memory 为主  
4. Agent 任务总线  
5. 可选 PostgreSQL / HTTP export（M4）  

**不做：** 语义检索、Web3、套壳聊天。
