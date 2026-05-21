/** Lightweight broadcast when the memory graph changes. */

export type GraphActivitySource = "agent" | "human";

export interface GraphActivityPayload {
  roomId: string;
  actorId: string;
  summary: string;
  at: number;
  source?: GraphActivitySource;
}

export interface GraphNotifyPayload {
  roomId: string;
  actorId: string;
  summary: string;
}
