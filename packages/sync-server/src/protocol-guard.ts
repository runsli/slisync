import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "socket.io";
import {
  negotiateProtocolVersion,
  parseProtocolVersion,
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from "@slisync/sync-schema";
import { emitSyncError } from "./auth";
import { jsonResponse } from "./graph-http-shared";

export function resolveClientProtocolVersion(
  explicit?: unknown,
  header?: string | string[] | undefined,
): number | undefined {
  const fromBody = parseProtocolVersion(explicit);
  if (fromBody != null) return fromBody;
  const raw = Array.isArray(header) ? header[0] : header;
  return parseProtocolVersion(raw);
}

export function assertSocketProtocol(
  socket: Socket,
  roomId: string | undefined,
  clientVersion?: number,
): boolean {
  const check = negotiateProtocolVersion(clientVersion);
  if (check.ok) return true;

  emitSyncError(socket, {
    code: check.code,
    message: check.message,
    roomId,
  });
  return false;
}

export function assertHttpProtocol(
  res: ServerResponse,
  clientVersion?: number,
): boolean {
  const check = negotiateProtocolVersion(clientVersion);
  if (check.ok) return true;

  jsonResponse(res, 400, {
    ok: false,
    error: check.message,
    code: check.code,
    serverProtocolVersion: SYNC_PROTOCOL_VERSION,
    minProtocolVersion: check.minVersion,
    maxProtocolVersion: check.maxVersion,
  });
  return false;
}

export function readHttpProtocolVersion(
  req: IncomingMessage,
  bodyValue?: unknown,
): number | undefined {
  return resolveClientProtocolVersion(
    bodyValue,
    req.headers[SYNC_PROTOCOL_HEADER.toLowerCase()],
  );
}
