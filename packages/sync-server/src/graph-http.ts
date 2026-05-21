import type { IncomingMessage, ServerResponse } from "node:http";
import type { Server as SocketIOServer } from "socket.io";
import type { GraphOp } from "@slisync/sync-schema";
import { buildGraphActivitySummary } from "@slisync/sync-sdk/graph";
import type { AgentMemoryPatch } from "@slisync/sync-sdk/agent";
import {
  commitAgentWriteToRoom,
  type CommitAgentWriteDeps,
} from "./commit-agent-write";
import {
  handleGraphTraverseGet,
  parseGraphTraverseRoute,
} from "./graph-http-traverse";
import {
  extractBearerToken,
  jsonResponse,
  writeCorsPreflight,
} from "./graph-http-shared";
import { assertHttpProtocol, readHttpProtocolVersion } from "./protocol-guard";

const MAX_BODY_BYTES = 512 * 1024;

export interface GraphHttpPostBody {
  agentId: string;
  action: string;
  graphOps: GraphOp[];
  memory?: AgentMemoryPatch;
  idempotencyKey?: string;
  protocolVersion?: number;
}

export type GraphHttpPostResponse =
  | {
      ok: true;
      version: number;
      summary: string;
      graphSummary?: string;
    }
  | { ok: false; error: string };

export interface GraphHttpHandlerDeps extends CommitAgentWriteDeps {
  io: SocketIOServer;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function parseGraphOpsRoute(pathname: string | undefined): string | null {
  if (!pathname) return null;
  const patterns = [
    /^\/v1\/graphs\/([^/]+)\/ops\/?$/,
    /^\/graphs\/([^/]+)\/ops\/?$/,
  ];
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

const idempotencyCache = new Map<
  string,
  { at: number; body: GraphHttpPostResponse }
>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function getIdempotent(key: string): GraphHttpPostResponse | null {
  const hit = idempotencyCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > IDEMPOTENCY_TTL_MS) {
    idempotencyCache.delete(key);
    return null;
  }
  return hit.body;
}

function setIdempotent(key: string, body: GraphHttpPostResponse) {
  idempotencyCache.set(key, { at: Date.now(), body });
  if (idempotencyCache.size > 500) {
    const oldest = [...idempotencyCache.entries()].sort(
      (a, b) => a[1].at - b[1].at,
    )[0];
    if (oldest) idempotencyCache.delete(oldest[0]);
  }
}

function isValidBody(body: unknown): body is GraphHttpPostBody {
  if (!body || typeof body !== "object") return false;
  const b = body as GraphHttpPostBody;
  return (
    typeof b.agentId === "string" &&
    b.agentId.length > 0 &&
    typeof b.action === "string" &&
    b.action.length > 0 &&
    Array.isArray(b.graphOps) &&
    b.graphOps.length > 0
  );
}

/**
 * Graph HTTP routes: GET traverse, POST ops.
 * Returns true if the request was handled.
 */
export function createGraphHttpHandler(deps: GraphHttpHandlerDeps) {
  const { io, crdtRoomStore, auth } = deps;

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = req.url?.split("?")[0];
    const traverseRoomId = parseGraphTraverseRoute(pathname);
    const opsRoomId = parseGraphOpsRoute(pathname);

    if (traverseRoomId) {
      return handleGraphTraverseGet(req, res, traverseRoomId, {
        crdtRoomStore,
        auth,
      });
    }

    if (!opsRoomId) return false;

    if (req.method === "OPTIONS") {
      writeCorsPreflight(res, "POST, OPTIONS");
      return true;
    }

    if (req.method !== "POST") {
      jsonResponse(res, 405, { ok: false, error: "method not allowed" });
      return true;
    }

    try {
      const raw = await readJsonBody(req);
      if (
        !assertHttpProtocol(
          res,
          readHttpProtocolVersion(req, (raw as GraphHttpPostBody)?.protocolVersion),
        )
      ) {
        return true;
      }

      if (!isValidBody(raw)) {
        jsonResponse(res, 400, {
          ok: false,
          error: "agentId, action, and non-empty graphOps required",
        });
        return true;
      }

      const token = extractBearerToken(req);
      const idempotencyKey =
        typeof raw.idempotencyKey === "string"
          ? raw.idempotencyKey
          : typeof req.headers["idempotency-key"] === "string"
            ? req.headers["idempotency-key"]
            : undefined;

      if (idempotencyKey) {
        const cacheKey = `${opsRoomId}:${idempotencyKey}`;
        const cached = getIdempotent(cacheKey);
        if (cached) {
          jsonResponse(res, cached.ok ? 200 : 400, cached);
          return true;
        }
      }

      const result = await commitAgentWriteToRoom(
        io,
        {
          crdtRoomStore,
          defaultState: deps.defaultState,
          auth,
          agentGraphPolicy: deps.agentGraphPolicy,
          auditStore: deps.auditStore,
          roomStore: deps.roomStore,
        },
        {
          roomId: opsRoomId,
          agentId: raw.agentId,
          action: raw.action,
          graphOps: raw.graphOps,
          memory: raw.memory,
          token,
        },
      );

      if (!result.ok) {
        const body: GraphHttpPostResponse = { ok: false, error: result.error ?? "failed" };
        if (idempotencyKey) {
          setIdempotent(`${opsRoomId}:${idempotencyKey}`, body);
        }
        jsonResponse(res, result.error?.includes("token") ? 401 : 400, body);
        return true;
      }

      const graphSummary = buildGraphActivitySummary(raw.graphOps);

      const body: GraphHttpPostResponse = {
        ok: true,
        version: result.version!,
        summary: result.entry?.summary ?? raw.action,
        graphSummary,
      };

      if (idempotencyKey) {
        setIdempotent(`${opsRoomId}:${idempotencyKey}`, body);
      }

      jsonResponse(res, 200, body);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "request failed";
      jsonResponse(res, 400, { ok: false, error: message });
      return true;
    }
  };
}
