import type { SyncStrategy } from "./protocol";

export type StrategyDetailRow = {
  label: string;
  crdt: string;
  lww: string;
};

/** Human-readable CRDT vs LWW comparison for the demo and docs. */
export const SYNC_STRATEGY_DETAILS: StrategyDetailRow[] = [
  {
    label: "权威数据源",
    crdt: "Y.Doc（图 + 共享 state 均在 CRDT）",
    lww: "RoomStore JSON + version",
  },
  {
    label: "并发合并",
    crdt: "Yjs 自动合并（无冲突 toast）",
    lww: "baseVersion 乐观锁 → sync:conflict",
  },
  {
    label: "传输",
    crdt: "sync:crdt-update（增量 Yjs）",
    lww: "sync:patch（RFC 6902）",
  },
  {
    label: "Memory Graph",
    crdt: "支持（graph/ 在 Y.Doc）",
    lww: "不支持（请切 CRDT）",
  },
  {
    label: "Presence / 离线队列",
    crdt: "支持",
    lww: "不支持",
  },
  {
    label: "Agent graphOps",
    crdt: "写入 Y.Doc + 策略校验",
    lww: "仅 legacy memory patch（若未 deny）",
  },
];

export function strategyFeatureFor(
  strategy: SyncStrategy,
  feature: "graph" | "presence" | "offline",
): boolean {
  return strategy === "crdt";
}
