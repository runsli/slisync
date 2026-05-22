import type { IncomingMessage, ServerResponse } from "node:http";
import type { ExportChunksHttpResponse, ExportChunksQuery } from "@slisync/sync-schema";
import { exportMemoryChunksFromCrdtUpdate } from "@slisync/sync-sdk/graph";
import { loadSyncAuthConfig, verifyAgentToken, type SyncAuthConfig } from "./auth";
import type { CrdtRoomStore } from "./crdt-room-store";
import { extractBearerToken, jsonResponse, writeCorsPreflight } from "./graph-http-shared";
import { assertHttpProtocol, readHttpProtocolVersion } from "./protocol-guard";

export interface ExportHttpHandlerDeps {
  crdtRoomStore: CrdtRoomStore;
  auth?: SyncAuthConfig;
}

export function parseExportChunksRoute(pathname: string | undefined): string | null {
  if (!pathname) return null;
  const patterns = [
    /^\/v1\/rooms\/([^/]+)\/export\/chunks\/?$/,
    /^\/rooms\/([^/]+)\/export\/chunks\/?$/,
  ];
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

function parseBool(param: string | null): boolean | undefined {
  if (param == null || param === "") return undefined;
  const v = param.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return undefined;
}

/** Parse GET query filters for chunk export (invalid minImportance is omitted). */
export function parseExportChunksQueryParams(
  searchParams: URLSearchParams,
): ExportChunksQuery {
  const workspaceId = searchParams.get("workspaceId")?.trim();
  const sessionId = searchParams.get("sessionId")?.trim();
  const minRaw = searchParams.get("minImportance");
  let minImportance: number | undefined;
  if (minRaw != null && minRaw !== "") {
    const n = Number.parseFloat(minRaw);
    if (Number.isFinite(n)) {
      minImportance = n;
    }
  }
  const includeDeleted = parseBool(searchParams.get("includeDeleted"));

  return {
    ...(workspaceId ? { workspaceId } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(minImportance !== undefined ? { minImportance } : {}),
    ...(includeDeleted !== undefined ? { includeDeleted } : {}),
  };
}

/**
 * Handle GET /v1/rooms/:roomId/export/chunks (and /rooms/:roomId/export/chunks).
 * Returns true if the request was handled.
 */
export function handleExportChunksGet(
  req: IncomingMessage,
  res: ServerResponse,
  roomId: string,
  deps: ExportHttpHandlerDeps,
): Promise<boolean> {
  return (async () => {
    if (req.method === "OPTIONS") {
      writeCorsPreflight(res, "GET, OPTIONS");
      return true;
    }

    if (req.method !== "GET") {
      jsonResponse(res, 405, { ok: false, error: "method not allowed" });
      return true;
    }

    if (!assertHttpProtocol(res, readHttpProtocolVersion(req))) {
      return true;
    }

    const auth = deps.auth ?? loadSyncAuthConfig();
    const token = extractBearerToken(req);
    const authCheck = verifyAgentToken(auth, roomId, token);
    if (!authCheck.ok) {
      jsonResponse(res, 401, { ok: false, error: authCheck.message });
      return true;
    }

    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const filters = parseExportChunksQueryParams(url.searchParams);

    try {
      const doc = await deps.crdtRoomStore.getOrCreate(roomId);
      const update = deps.crdtRoomStore.snapshot(doc);
      const sdkFiles = exportMemoryChunksFromCrdtUpdate(update, {
        roomId,
        ...filters,
      });
      const files = sdkFiles.map(({ relativePath, markdown }) => ({
        relativePath,
        markdown,
      }));
      const body: ExportChunksHttpResponse = {
        ok: true,
        roomId,
        exportedAt: new Date().toISOString(),
        count: files.length,
        files,
      };
      jsonResponse(res, 200, body);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "export failed";
      jsonResponse(res, 400, { ok: false, error: message });
      return true;
    }
  })();
}

/** HTTP handler for memory chunk export routes. Returns true when the path matches. */
export function createExportHttpHandler(deps: ExportHttpHandlerDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = req.url?.split("?")[0];
    const roomId = parseExportChunksRoute(pathname);
    if (!roomId) return false;
    return handleExportChunksGet(req, res, roomId, deps);
  };
}
