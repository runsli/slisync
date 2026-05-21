import type { Server, Socket } from "socket.io";
import {
  SYNC_EVENTS,
  type PresenceJoinPayload,
  type PresenceStatePayload,
  type PresenceUpdatePayload,
} from "@slisync/sync-sdk/protocol";
import type { PresenceMember } from "@slisync/sync-schema";

type SocketPresence = PresenceMember & { socketId: string };

const rooms = new Map<string, Map<string, SocketPresence>>();

function roomMap(roomId: string): Map<string, SocketPresence> {
  let map = rooms.get(roomId);
  if (!map) {
    map = new Map();
    rooms.set(roomId, map);
  }
  return map;
}

function dedupeMembers(map: Map<string, SocketPresence>): PresenceMember[] {
  const byClient = new Map<string, PresenceMember>();
  for (const entry of map.values()) {
    const existing = byClient.get(entry.clientId);
    if (!existing || entry.lastSeen >= existing.lastSeen) {
      byClient.set(entry.clientId, {
        clientId: entry.clientId,
        actorId: entry.actorId,
        status: entry.status,
        joinedAt: entry.joinedAt,
        lastSeen: entry.lastSeen,
      });
    }
  }
  return [...byClient.values()].sort((a, b) => a.joinedAt - b.joinedAt);
}

function broadcastPresence(io: Server, roomId: string) {
  const map = rooms.get(roomId);
  const payload: PresenceStatePayload = {
    roomId,
    members: map ? dedupeMembers(map) : [],
  };
  io.to(roomId).emit(SYNC_EVENTS.PRESENCE_STATE, payload);
}

function removeSocket(roomId: string, socketId: string) {
  const map = rooms.get(roomId);
  if (!map) return false;
  const removed = map.delete(socketId);
  if (map.size === 0) rooms.delete(roomId);
  return removed;
}

export function attachPresenceServer(io: Server) {
  io.on("connection", (socket: Socket) => {
    let activeRoom: string | null = null;

    const leaveActive = () => {
      if (!activeRoom) return;
      const roomId = activeRoom;
      activeRoom = null;
      if (removeSocket(roomId, socket.id)) {
        broadcastPresence(io, roomId);
      }
    };

    socket.on(SYNC_EVENTS.PRESENCE_JOIN, (payload: PresenceJoinPayload) => {
      const { roomId, clientId, actorId, status } = payload ?? {};
      if (!roomId || !clientId) return;

      leaveActive();
      activeRoom = roomId;

      const now = Date.now();
      const map = roomMap(roomId);
      map.set(socket.id, {
        socketId: socket.id,
        clientId,
        actorId: actorId || clientId,
        status: status ?? "online",
        joinedAt: now,
        lastSeen: now,
      });

      broadcastPresence(io, roomId);
    });

    socket.on(SYNC_EVENTS.PRESENCE_UPDATE, (payload: PresenceUpdatePayload) => {
      const { roomId, clientId, status } = payload ?? {};
      if (!roomId || !clientId || !status) return;

      const map = rooms.get(roomId);
      if (!map) return;

      const now = Date.now();
      for (const entry of map.values()) {
        if (entry.clientId === clientId && entry.socketId === socket.id) {
          entry.status = status;
          entry.lastSeen = now;
        }
      }
      broadcastPresence(io, roomId);
    });

    socket.on(SYNC_EVENTS.PRESENCE_LEAVE, () => {
      leaveActive();
    });

    socket.on("disconnect", () => {
      leaveActive();
    });
  });
}

/** Test helper — reset in-memory presence registry. */
export function resetPresenceRegistryForTests() {
  rooms.clear();
}
