import type { Server, Socket } from "socket.io";
import { decodeUpdate, encodeUpdate } from "@slisync/sync-sdk/crdt";
import { readMemoryGraphSnapshot } from "@slisync/sync-sdk/graph";
import { emitGraphActivityIfSnapshotChanged } from "./emit-graph-activity-on-crdt";
import {
  SYNC_EVENTS,
  type SyncCrdtJoinAck,
  type SyncCrdtJoinPayload,
} from "@slisync/sync-sdk/protocol";
import type { SharedMemoryState } from "@slisync/sync-sdk/crdt";
import { parseProtocolVersion, SYNC_PROTOCOL_VERSION } from "@slisync/sync-schema";
import {
  assertRoomWriteAccess,
  emitSyncError,
  loadSyncAuthConfig,
  markRoomAuthenticated,
  verifyRoomToken,
  type SyncAuthConfig,
} from "./auth";
import { createCrdtRoomStore, type CrdtRoomStore } from "./crdt-room-store";
import { assertSocketProtocol } from "./protocol-guard";
import type { AuditStore } from "./audit-store";

export interface AttachCrdtServerOptions {
  roomStore?: CrdtRoomStore;
  auth?: SyncAuthConfig;
  auditStore?: AuditStore;
}

export function attachCrdtServer(
  io: Server,
  defaultState: SharedMemoryState,
  options: AttachCrdtServerOptions = {},
) {
  const store = options.roomStore ?? createCrdtRoomStore(defaultState);
  const auth = options.auth ?? loadSyncAuthConfig();
  const auditStore = options.auditStore;

  io.on("connection", (socket: Socket) => {
    let joinedRoom: string | null = null;

    socket.on(
      SYNC_EVENTS.CRDT_JOIN,
      async (payload: SyncCrdtJoinPayload, ack?: (res: SyncCrdtJoinAck) => void) => {
        const { roomId, token, protocolVersion } = payload;
        if (!roomId) {
          ack?.({ error: "roomId required" });
          return;
        }

        if (
          !assertSocketProtocol(
            socket,
            roomId,
            parseProtocolVersion(protocolVersion),
          )
        ) {
          ack?.({
            error: "incompatible protocol version",
            code: "incompatible_protocol",
            protocolVersion: SYNC_PROTOCOL_VERSION,
          });
          return;
        }

        const access = verifyRoomToken(auth, roomId, token);
        if (!access.ok) {
          ack?.({ error: access.message });
          emitSyncError(socket, {
            code: access.code,
            message: access.message,
            roomId,
          });
          return;
        }

        if (joinedRoom) socket.leave(joinedRoom);
        joinedRoom = roomId;
        socket.join(roomId);
        markRoomAuthenticated(socket, roomId, "human");

        try {
          const doc = await store.getOrCreate(roomId);
          const update = encodeUpdate(store.snapshot(doc));
          socket.emit(SYNC_EVENTS.CRDT_SYNC, { roomId, update });
          ack?.({ update, protocolVersion: SYNC_PROTOCOL_VERSION });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "CRDT join failed";
          console.error("[sync:crdt] join failed:", err);
          ack?.({ error: message });
        }
      },
    );

    socket.on(
      SYNC_EVENTS.CRDT_UPDATE,
      async (payload: { roomId: string; update: string }) => {
        const { roomId, update: encoded } = payload;
        if (!roomId || !encoded) return;

        const write = assertRoomWriteAccess(auth, socket, roomId);
        if (!write.ok) {
          emitSyncError(socket, {
            code: write.code,
            message: write.message,
            roomId,
          });
          return;
        }

        try {
          socket.join(roomId);
          const doc = await store.getOrCreate(roomId);
          const graphBefore = readMemoryGraphSnapshot(doc);
          await store.applyUpdate(roomId, decodeUpdate(encoded));
          const graphAfter = readMemoryGraphSnapshot(
            await store.getOrCreate(roomId),
          );
          emitGraphActivityIfSnapshotChanged(
            socket,
            roomId,
            graphBefore,
            graphAfter,
            auditStore,
          );
          socket.to(roomId).emit(SYNC_EVENTS.CRDT_UPDATE, { roomId, update: encoded });
        } catch (err) {
          console.error("[sync:crdt] update failed:", err);
        }
      },
    );
  });

  return { crdtRoomStore: store };
}
