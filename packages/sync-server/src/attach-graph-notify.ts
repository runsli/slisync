import type { Server, Socket } from "socket.io";
import type { GraphActivityPayload, GraphNotifyPayload } from "@slisync/sync-schema";
import { SYNC_EVENTS } from "@slisync/sync-sdk/protocol";
import {
  assertRoomWriteAccess,
  loadSyncAuthConfig,
  type SyncAuthConfig,
} from "./auth";

import type { AuditStore } from "./audit-store";
import type { CrdtRoomStore } from "./crdt-room-store";

export interface AttachGraphNotifyOptions {
  auth?: SyncAuthConfig;
  crdtRoomStore?: CrdtRoomStore;
  auditStore?: AuditStore;
}

export function attachGraphNotify(io: Server, options: AttachGraphNotifyOptions = {}) {
  const auth = options.auth ?? loadSyncAuthConfig();

  io.on("connection", (socket: Socket) => {
    socket.on(SYNC_EVENTS.GRAPH_NOTIFY, (payload: GraphNotifyPayload) => {
      const { roomId, actorId, summary } = payload;
      if (!roomId || !actorId || !summary?.trim()) return;

      const write = assertRoomWriteAccess(auth, socket, roomId);
      if (!write.ok) return;

      socket.join(roomId);

      const activity: GraphActivityPayload = {
        roomId,
        actorId,
        summary: summary.trim(),
        at: Date.now(),
        source: "human",
      };

      socket.to(roomId).emit(SYNC_EVENTS.GRAPH_ACTIVITY, activity);

      if (options.auditStore) {
        void options.auditStore.record({
          roomId,
          actorId,
          source: "human",
          action: "graph_notify",
          summary: activity.summary,
        });
      }
    });
  });
}
