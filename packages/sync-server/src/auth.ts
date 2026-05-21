import type { Socket } from "socket.io";
import {
  SYNC_EVENTS,
  type SyncAuthErrorCode,
  type SyncErrorPayload,
} from "@slisync/sync-sdk/protocol";

export interface SyncAuthConfig {
  enabled: boolean;
  /** Default key for any room (SYNC_API_KEY). */
  apiKey?: string;
  /** Agent-only key (SYNC_AGENT_API_KEY). */
  agentApiKey?: string;
  /** Per-room overrides (SYNC_ROOM_KEYS JSON). */
  roomKeys: Record<string, string>;
}

export interface AuthenticatedRoom {
  role: "human" | "agent";
  at: number;
}

type SyncSocketData = {
  syncRooms?: Map<string, AuthenticatedRoom>;
};

function socketData(socket: Socket): SyncSocketData {
  return socket.data as SyncSocketData;
}

export function loadSyncAuthConfig(): SyncAuthConfig {
  const apiKey = process.env.SYNC_API_KEY?.trim();
  const agentApiKey = process.env.SYNC_AGENT_API_KEY?.trim();
  const required =
    process.env.SYNC_AUTH_REQUIRED === "1" ||
    process.env.SYNC_AUTH_REQUIRED === "true";

  let roomKeys: Record<string, string> = {};
  const rawRoomKeys = process.env.SYNC_ROOM_KEYS?.trim();
  if (rawRoomKeys) {
    try {
      const parsed = JSON.parse(rawRoomKeys) as Record<string, string>;
      roomKeys = parsed ?? {};
    } catch {
      console.warn("[sync:auth] invalid SYNC_ROOM_KEYS JSON, ignoring");
    }
  }

  const enabled =
    required || Boolean(apiKey || agentApiKey || Object.keys(roomKeys).length);

  return {
    enabled,
    apiKey,
    agentApiKey,
    roomKeys,
  };
}

function resolveRoomToken(config: SyncAuthConfig, roomId: string): string | undefined {
  if (config.roomKeys[roomId]) return config.roomKeys[roomId];
  return config.apiKey;
}

export function verifyRoomToken(
  config: SyncAuthConfig,
  roomId: string,
  token?: string,
): { ok: true } | { ok: false; code: SyncAuthErrorCode; message: string } {
  if (!config.enabled) return { ok: true };

  const expected = resolveRoomToken(config, roomId);
  if (!expected) {
    return {
      ok: false,
      code: "auth_required",
      message: `no token configured for room ${roomId}`,
    };
  }

  if (!token || token !== expected) {
    return { ok: false, code: "invalid_token", message: "invalid room token" };
  }

  return { ok: true };
}

export function verifyAgentToken(
  config: SyncAuthConfig,
  roomId: string,
  token?: string,
): { ok: true } | { ok: false; code: SyncAuthErrorCode; message: string } {
  if (!config.enabled) return { ok: true };

  if (config.agentApiKey && token === config.agentApiKey) {
    return { ok: true };
  }

  const roomCheck = verifyRoomToken(config, roomId, token);
  if (roomCheck.ok) return { ok: true };

  if (!token) {
    return {
      ok: false,
      code: "auth_required",
      message: "agent token required",
    };
  }

  return { ok: false, code: "invalid_token", message: "invalid agent token" };
}

export function emitSyncError(
  socket: Socket,
  payload: SyncErrorPayload,
) {
  socket.emit(SYNC_EVENTS.ERROR, payload);
}

export function markRoomAuthenticated(
  socket: Socket,
  roomId: string,
  role: AuthenticatedRoom["role"] = "human",
) {
  const data = socketData(socket);
  if (!data.syncRooms) data.syncRooms = new Map();
  data.syncRooms.set(roomId, { role, at: Date.now() });
}

export function assertRoomWriteAccess(
  config: SyncAuthConfig,
  socket: Socket,
  roomId: string,
): { ok: true } | { ok: false; code: SyncAuthErrorCode; message: string } {
  if (!config.enabled) return { ok: true };

  const entry = socketData(socket).syncRooms?.get(roomId);
  if (!entry) {
    return {
      ok: false,
      code: "forbidden",
      message: "join room with valid token before writing",
    };
  }

  return { ok: true };
}
