import type { AuditEntry } from "@slisync/sync-schema";
import { getAgentSyncToken } from "../get-sync-auth";
import { getSyncHttpBase } from "../get-sync-http-base";
import { withSyncProtocolHeaders } from "../sync-protocol-client";

export type FetchAuditHttpOptions = {
  baseUrl?: string;
  roomId: string;
  token?: string;
  limit?: number;
};

export type FetchAuditHttpResult =
  | { ok: true; roomId: string; entries: AuditEntry[] }
  | { ok: false; error: string; status?: number };

export async function fetchAuditHttp(
  options: FetchAuditHttpOptions,
): Promise<FetchAuditHttpResult> {
  const { baseUrl, roomId, limit = 50 } = options;
  const root = getSyncHttpBase(baseUrl);
  const token = options.token ?? getAgentSyncToken();
  const params = new URLSearchParams({ limit: String(limit) });
  const url = `${root}/v1/rooms/${encodeURIComponent(roomId)}/audit?${params}`;

  const headers = withSyncProtocolHeaders(
    token ? { Authorization: `Bearer ${token}` } : {},
  );

  const res = await fetch(url, { method: "GET", headers });
  let body: FetchAuditHttpResult;
  try {
    body = (await res.json()) as FetchAuditHttpResult;
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
