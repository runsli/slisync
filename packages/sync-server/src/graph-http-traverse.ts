import type { IncomingMessage, ServerResponse } from "node:http";
import {
  DEFAULT_TRAVERSE,
  TRAVERSE_LIMITS,
  type EdgeRelation,
  type MemoryNodeKind,
  type TraverseQuery,
  type TraverseResult,
} from "@slisync/sync-schema";
import { traverseGraph } from "@slisync/sync-sdk/graph";
import { loadSyncAuthConfig, verifyAgentToken, type SyncAuthConfig } from "./auth";
import type { CrdtRoomStore } from "./crdt-room-store";
import { extractBearerToken, jsonResponse, writeCorsPreflight } from "./graph-http-shared";
import { assertHttpProtocol, readHttpProtocolVersion } from "./protocol-guard";

const EDGE_RELATIONS = new Set<EdgeRelation>([
  "contains",
  "depends_on",
  "references",
  "derived_from",
  "related_to",
  "assigned_to",
  "prefers",
  "custom",
]);

const NODE_KINDS = new Set<MemoryNodeKind>([
  "project",
  "task",
  "file",
  "user_preference",
  "memory",
  "agent_run",
  "workspace",
  "session",
  "memory_chunk",
  "custom",
]);

export type GraphHttpTraverseResponse =
  | { ok: true; roomId: string; result: TraverseResult }
  | { ok: false; error: string };

export interface GraphTraverseHandlerDeps {
  crdtRoomStore: CrdtRoomStore;
  auth?: SyncAuthConfig;
}

export function parseGraphTraverseRoute(pathname: string | undefined): string | null {
  if (!pathname) return null;
  const patterns = [
    /^\/v1\/graphs\/([^/]+)\/traverse\/?$/,
    /^\/graphs\/([^/]+)\/traverse\/?$/,
  ];
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

function parseCsv(param: string | null): string[] | undefined {
  if (!param?.trim()) return undefined;
  const parts = param
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function parsePositiveInt(
  param: string | null,
  fallback: number,
  max: number,
): number {
  if (!param) return Math.min(fallback, max);
  const n = Number.parseInt(param, 10);
  if (!Number.isFinite(n) || n < 0) return Math.min(fallback, max);
  return Math.min(n, max);
}

function parseBool(param: string | null): boolean | undefined {
  if (param == null || param === "") return undefined;
  const v = param.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return undefined;
}

export function parseTraverseQueryParams(
  searchParams: URLSearchParams,
): { startId?: string; traverse: Partial<TraverseQuery> } {
  const direction = searchParams.get("direction");
  const dir =
    direction === "in" || direction === "out" || direction === "both"
      ? direction
      : undefined;

  const relationsRaw = parseCsv(searchParams.get("relations"));
  const relations = relationsRaw?.filter((r): r is EdgeRelation =>
    EDGE_RELATIONS.has(r as EdgeRelation),
  );

  const kindsRaw = parseCsv(searchParams.get("kinds"));
  const kinds = kindsRaw?.filter((k): k is MemoryNodeKind =>
    NODE_KINDS.has(k as MemoryNodeKind),
  );

  const tagFilter = parseCsv(searchParams.get("tagFilter"));
  const includeDeleted = parseBool(searchParams.get("includeDeleted"));
  const workspaceId = searchParams.get("workspaceId")?.trim();
  const sessionId = searchParams.get("sessionId")?.trim();
  const scopeFilter =
    workspaceId || sessionId
      ? {
          ...(workspaceId ? { workspaceId } : {}),
          ...(sessionId ? { sessionId } : {}),
        }
      : undefined;

  return {
    startId: searchParams.get("startId")?.trim() || undefined,
    traverse: {
      direction: dir,
      relations: relations?.length ? relations : undefined,
      kinds: kinds?.length ? kinds : undefined,
      tagFilter,
      maxDepth: parsePositiveInt(
        searchParams.get("maxDepth"),
        DEFAULT_TRAVERSE.maxDepth,
        TRAVERSE_LIMITS.maxDepth,
      ),
      maxNodes: parsePositiveInt(
        searchParams.get("maxNodes"),
        DEFAULT_TRAVERSE.maxNodes,
        TRAVERSE_LIMITS.maxNodes,
      ),
      includeDeleted:
        includeDeleted ?? DEFAULT_TRAVERSE.includeDeleted,
      scopeFilter,
    },
  };
}

/**
 * Handle GET /v1/graphs/:roomId/traverse (and /graphs/:roomId/traverse).
 * Returns true if the request was handled.
 */
export function handleGraphTraverseGet(
  req: IncomingMessage,
  res: ServerResponse,
  roomId: string,
  deps: GraphTraverseHandlerDeps,
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
    const { startId, traverse } = parseTraverseQueryParams(url.searchParams);

    if (!startId) {
      jsonResponse(res, 400, {
        ok: false,
        error: "startId query parameter required",
      });
      return true;
    }

    try {
      const doc = await deps.crdtRoomStore.getOrCreate(roomId);
      const result = traverseGraph(doc, startId, traverse);
      jsonResponse(res, 200, { ok: true, roomId, result });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "traverse failed";
      jsonResponse(res, 400, { ok: false, error: message });
      return true;
    }
  })();
}
