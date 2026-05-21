import type { TraverseQuery, TraverseResult } from "@slisync/sync-schema";
import { getAgentSyncToken } from "../get-sync-auth";
import { getSyncHttpBase } from "../get-sync-http-base";
import { withSyncProtocolHeaders } from "../sync-protocol-client";

export type FetchGraphTraverseHttpOptions = {
  baseUrl?: string;
  roomId: string;
  startId: string;
  token?: string;
  query?: Partial<TraverseQuery>;
};

export type FetchGraphTraverseHttpResult =
  | { ok: true; roomId: string; result: TraverseResult }
  | { ok: false; error: string; status?: number };

function appendTraverseQuery(
  params: URLSearchParams,
  query?: Partial<TraverseQuery>,
) {
  if (!query) return;
  if (query.direction) params.set("direction", query.direction);
  if (query.maxDepth != null) params.set("maxDepth", String(query.maxDepth));
  if (query.maxNodes != null) params.set("maxNodes", String(query.maxNodes));
  if (query.includeDeleted != null) {
    params.set("includeDeleted", query.includeDeleted ? "true" : "false");
  }
  if (query.relations?.length) {
    params.set("relations", query.relations.join(","));
  }
  if (query.kinds?.length) {
    params.set("kinds", query.kinds.join(","));
  }
  if (query.tagFilter?.length) {
    params.set("tagFilter", query.tagFilter.join(","));
  }
  if (query.scopeFilter?.workspaceId) {
    params.set("workspaceId", query.scopeFilter.workspaceId);
  }
  if (query.scopeFilter?.sessionId) {
    params.set("sessionId", query.scopeFilter.sessionId);
  }
}

/** Read-only graph traversal over HTTP (no Socket.IO). */
export async function fetchGraphTraverseHttp(
  options: FetchGraphTraverseHttpOptions,
): Promise<FetchGraphTraverseHttpResult> {
  const { baseUrl, roomId, startId, query } = options;
  const root = getSyncHttpBase(baseUrl);
  const token = options.token ?? getAgentSyncToken();

  const params = new URLSearchParams({ startId });
  appendTraverseQuery(params, query);

  const url = `${root}/v1/graphs/${encodeURIComponent(roomId)}/traverse?${params}`;

  const headers = withSyncProtocolHeaders(
    token ? { Authorization: `Bearer ${token}` } : {},
  );

  const res = await fetch(url, { method: "GET", headers });

  let body: FetchGraphTraverseHttpResult;
  try {
    body = (await res.json()) as FetchGraphTraverseHttpResult;
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
