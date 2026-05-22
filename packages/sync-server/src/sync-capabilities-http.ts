import type { IncomingMessage, ServerResponse } from "node:http";
import {
  DEFAULT_AGENT_GRAPH_POLICY,
  SYNC_PROTOCOL_VERSION,
  summarizeAgentGraphPolicy,
} from "@slisync/sync-schema";
import { loadAgentGraphPolicy } from "./agent-graph-policy-config";
import { jsonResponse, writeCorsPreflight } from "./graph-http-shared";

export type SyncCapabilitiesResponse = {
  ok: true;
  protocolVersion: number;
  crdtAuthority: boolean;
  features: {
    presence: boolean;
    offlineOutbox: boolean;
    scopedMemory: boolean;
    graphHttp: boolean;
    exportChunks: boolean;
    audit: boolean;
  };
  agentGraphPolicy: ReturnType<typeof summarizeAgentGraphPolicy>;
};

export function handleSyncCapabilitiesGet(
  req: IncomingMessage,
  res: ServerResponse,
  options: { crdtAuthority?: boolean } = {},
): boolean {
  if (req.method === "OPTIONS") {
    writeCorsPreflight(res, "GET, OPTIONS");
    return true;
  }
  if (req.method !== "GET") {
    jsonResponse(res, 405, { ok: false, error: "method not allowed" });
    return true;
  }

  const policy = loadAgentGraphPolicy();
  const body: SyncCapabilitiesResponse = {
    ok: true,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    crdtAuthority: options.crdtAuthority ?? true,
    features: {
      presence: true,
      offlineOutbox: true,
      scopedMemory: true,
      graphHttp: true,
      exportChunks: true,
      audit: true,
    },
    agentGraphPolicy: summarizeAgentGraphPolicy(policy),
  };

  jsonResponse(res, 200, body);
  return true;
}

/** For tests — default policy shape without env overrides. */
export function defaultCapabilitiesSnapshot(): SyncCapabilitiesResponse {
  return {
    ok: true,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    crdtAuthority: true,
    features: {
      presence: true,
      offlineOutbox: true,
      scopedMemory: true,
      graphHttp: true,
      exportChunks: true,
      audit: true,
    },
    agentGraphPolicy: summarizeAgentGraphPolicy(DEFAULT_AGENT_GRAPH_POLICY),
  };
}
