import type { GraphOp } from "@slisync/sync-schema";
import type { AgentMemoryPatch } from "../agent/types";
import { getAgentSyncToken } from "../get-sync-auth";
import { getSyncHttpBase } from "../get-sync-http-base";
import {
  defaultProtocolVersion,
  withSyncProtocolHeaders,
} from "../sync-protocol-client";

export type PushGraphOpsHttpOptions = {
  baseUrl?: string;
  roomId: string;
  agentId: string;
  action: string;
  graphOps: GraphOp[];
  memory?: AgentMemoryPatch;
  token?: string;
  idempotencyKey?: string;
};

export type PushGraphOpsHttpResult =
  | {
      ok: true;
      version: number;
      summary: string;
      graphSummary?: string;
    }
  | { ok: false; error: string; status?: number };

export async function pushGraphOpsHttp(
  options: PushGraphOpsHttpOptions,
): Promise<PushGraphOpsHttpResult> {
  const {
    baseUrl,
    roomId,
    agentId,
    action,
    graphOps,
    memory,
    idempotencyKey,
  } = options;

  const root = getSyncHttpBase(baseUrl);
  const token = options.token ?? getAgentSyncToken();
  const url = `${root}/v1/graphs/${encodeURIComponent(roomId)}/ops`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      agentId,
      action,
      graphOps,
      memory,
      idempotencyKey,
      protocolVersion: defaultProtocolVersion(),
    }),
  });

  let body: PushGraphOpsHttpResult;
  try {
    body = (await res.json()) as PushGraphOpsHttpResult;
  } catch {
    return { ok: false, error: "invalid JSON response", status: res.status };
  }

  if (!body.ok) {
    return {
      ok: false,
      error: "error" in body ? body.error : "request failed",
      status: res.status,
    };
  }

  return body;
}
