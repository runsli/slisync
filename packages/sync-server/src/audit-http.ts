import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuditEntry } from "@slisync/sync-schema";
import { verifyAgentToken, loadSyncAuthConfig, type SyncAuthConfig } from "./auth";
import { extractBearerToken, jsonResponse, writeCorsPreflight } from "./graph-http-shared";
import { assertHttpProtocol, readHttpProtocolVersion } from "./protocol-guard";
import type { AuditStore } from "./audit-store";

export type AuditHttpResponse =
  | { ok: true; roomId: string; entries: AuditEntry[] }
  | { ok: false; error: string };

function parseAuditRoute(pathname: string | undefined): string | null {
  if (!pathname) return null;
  const patterns = [
    /^\/v1\/rooms\/([^/]+)\/audit\/?$/,
    /^\/rooms\/([^/]+)\/audit\/?$/,
  ];
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export function createAuditHttpHandler(auditStore: AuditStore, auth?: SyncAuthConfig) {
  const config = auth ?? loadSyncAuthConfig();

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = req.url?.split("?")[0];
    const roomId = parseAuditRoute(pathname);
    if (!roomId) return false;

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

    const token = extractBearerToken(req);
    const authCheck = verifyAgentToken(config, roomId, token);
    if (!authCheck.ok) {
      jsonResponse(res, 401, { ok: false, error: authCheck.message });
      return true;
    }

    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;

    try {
      const entries = await auditStore.list(
        roomId,
        Number.isFinite(limit) ? limit : 50,
      );
      jsonResponse(res, 200, { ok: true, roomId, entries });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "audit read failed";
      jsonResponse(res, 400, { ok: false, error: message });
      return true;
    }
  };
}
