import type { IncomingMessage, ServerResponse } from "node:http";
import archiver from "archiver";
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

export type ExportChunkFile = {
  relativePath: string;
  markdown: string;
};

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

/** True when the client requests a zip archive via Accept: application/zip. */
export function parseAcceptsZipExport(
  acceptHeader: string | string[] | undefined,
): boolean {
  const raw = Array.isArray(acceptHeader)
    ? acceptHeader.join(",")
    : (acceptHeader ?? "");
  return raw.split(",").some((part) => {
    const value = part.trim().toLowerCase();
    return value === "application/zip" || value.startsWith("application/zip;");
  });
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

function safeZipBasename(roomId: string): string {
  const cleaned = roomId.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "room";
}

/** Stream Markdown files as a zip (entry paths = relativePath). */
export function streamExportChunksZip(
  res: ServerResponse,
  roomId: string,
  files: ExportChunkFile[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    res.on("finish", resolve);
    res.on("close", resolve);

    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeZipBasename(roomId)}-chunks.zip"`,
      "Cache-Control": "no-store",
    });

    archive.pipe(res);
    for (const file of files) {
      archive.append(file.markdown, { name: file.relativePath });
    }
    void archive.finalize();
  });
}

async function loadExportChunkFiles(
  deps: ExportHttpHandlerDeps,
  roomId: string,
  filters: ExportChunksQuery,
): Promise<ExportChunkFile[]> {
  const doc = await deps.crdtRoomStore.getOrCreate(roomId);
  const update = deps.crdtRoomStore.snapshot(doc);
  const sdkFiles = exportMemoryChunksFromCrdtUpdate(update, {
    roomId,
    ...filters,
  });
  return sdkFiles.map(({ relativePath, markdown }) => ({
    relativePath,
    markdown,
  }));
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
    const wantsZip = parseAcceptsZipExport(req.headers.accept);

    try {
      const files = await loadExportChunkFiles(deps, roomId, filters);

      if (wantsZip) {
        await streamExportChunksZip(res, roomId, files);
        return true;
      }

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
