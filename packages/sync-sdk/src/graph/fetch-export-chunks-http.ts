import type { ExportChunksHttpResponse } from "@slisync/sync-schema";
import { getAgentSyncToken } from "../get-sync-auth";
import { getSyncHttpBase } from "../get-sync-http-base";
import { withSyncProtocolHeaders } from "../sync-protocol-client";

export type FetchExportChunksHttpOptions = {
  baseUrl?: string;
  roomId: string;
  token?: string;
  workspaceId?: string;
  sessionId?: string;
  minImportance?: number;
  includeDeleted?: boolean;
};

export type FetchExportChunksHttpResult = ExportChunksHttpResponse & {
  status?: number;
};

/** Append export filter query params (aligned with server parseExportChunksQueryParams). */
export function appendExportChunksQuery(
  params: URLSearchParams,
  options: Pick<
    FetchExportChunksHttpOptions,
    "workspaceId" | "sessionId" | "minImportance" | "includeDeleted"
  >,
) {
  if (options.workspaceId) params.set("workspaceId", options.workspaceId);
  if (options.sessionId) params.set("sessionId", options.sessionId);
  if (options.minImportance != null) {
    params.set("minImportance", String(options.minImportance));
  }
  if (options.includeDeleted != null) {
    params.set("includeDeleted", options.includeDeleted ? "true" : "false");
  }
}

/** Build GET /v1/rooms/:roomId/export/chunks URL with optional filters. */
export function buildExportChunksHttpUrl(
  baseUrl: string,
  roomId: string,
  options?: Pick<
    FetchExportChunksHttpOptions,
    "workspaceId" | "sessionId" | "minImportance" | "includeDeleted"
  >,
): string {
  const params = new URLSearchParams();
  if (options) appendExportChunksQuery(params, options);
  const qs = params.toString();
  const root = baseUrl.replace(/\/$/, "");
  const path = `${root}/v1/rooms/${encodeURIComponent(roomId)}/export/chunks`;
  return qs ? `${path}?${qs}` : path;
}

/**
 * Read-only HTTP export of memory_chunk nodes only (no task or other node kinds).
 * Uses the same Markdown paths and front matter as CLI exportMemoryChunksFromCrdtUpdate.
 */
export async function fetchExportChunksHttp(
  options: FetchExportChunksHttpOptions,
): Promise<FetchExportChunksHttpResult> {
  const { baseUrl, roomId, workspaceId, sessionId, minImportance, includeDeleted } =
    options;
  const root = getSyncHttpBase(baseUrl);
  const token = options.token ?? getAgentSyncToken();

  const url = buildExportChunksHttpUrl(root, roomId, {
    workspaceId,
    sessionId,
    minImportance,
    includeDeleted,
  });

  const headers = withSyncProtocolHeaders(
    token ? { Authorization: `Bearer ${token}` } : {},
  );

  const res = await fetch(url, { method: "GET", headers });

  let body: ExportChunksHttpResponse;
  try {
    body = (await res.json()) as ExportChunksHttpResponse;
  } catch {
    return { ok: false, error: "invalid JSON response", status: res.status };
  }

  if (!body.ok) {
    return { ...body, status: res.status };
  }

  return { ...body, status: res.status };
}

export type FetchExportChunksZipHttpResult =
  | { ok: true; blob: ArrayBuffer; filename: string; status?: number }
  | { ok: false; error: string; status?: number };

/**
 * Download memory_chunk export as a zip archive (Accept: application/zip).
 * Entry paths inside the zip match SDK relativePath layout.
 */
export async function fetchExportChunksZipHttp(
  options: FetchExportChunksHttpOptions,
): Promise<FetchExportChunksZipHttpResult> {
  const { baseUrl, roomId, workspaceId, sessionId, minImportance, includeDeleted } =
    options;
  const root = getSyncHttpBase(baseUrl);
  const token = options.token ?? getAgentSyncToken();

  const url = buildExportChunksHttpUrl(root, roomId, {
    workspaceId,
    sessionId,
    minImportance,
    includeDeleted,
  });

  const headers = withSyncProtocolHeaders({
    Accept: "application/zip",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const res = await fetch(url, { method: "GET", headers });

  if (!res.ok) {
    let error = `export failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) error = body.error;
    } catch {
      /* non-JSON error body */
    }
    return { ok: false, error, status: res.status };
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `${roomId}-chunks.zip`;
  const blob = await res.arrayBuffer();

  return { ok: true, blob, filename, status: res.status };
}
