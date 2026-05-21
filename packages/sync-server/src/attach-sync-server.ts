import type { Server, Socket } from "socket.io";
import { encodeUpdate } from "@slisync/sync-sdk/crdt";
import {
  applySharedMemoryStateToDoc,
  bumpRoomVersion,
  captureStateVector,
  encodeIncrementalUpdate,
  getRoomVersion,
  readSharedMemoryState,
} from "@slisync/sync-sdk/crdt";
import { tryApplyStatePatch } from "@slisync/sync-sdk/patch";
import {
  SYNC_EVENTS,
  type SyncConflictPayload,
  type SyncJoinPayload,
  type SyncPatchBroadcast,
  type SyncPatchPayload,
  type SyncStatePayload,
  type SyncUpdatePayload,
} from "@slisync/sync-sdk/protocol";
import type { SharedMemoryState } from "@slisync/sync-sdk/shared-memory-state";
import { conflictReasonForPatch } from "./conflict";
import { parseProtocolVersion } from "@slisync/sync-schema";
import {
  assertRoomWriteAccess,
  emitSyncError,
  loadSyncAuthConfig,
  markRoomAuthenticated,
  verifyRoomToken,
  type SyncAuthConfig,
} from "./auth";
import { assertSocketProtocol } from "./protocol-guard";
import type { AuditStore } from "./audit-store";
import type { CrdtRoomStore } from "./crdt-room-store";
import {
  createPersistence,
  type RoomPersistence,
  type RoomRecord,
  RoomStore,
} from "./persistence";

function emitConflict(socket: Socket, room: RoomRecord, reason: SyncConflictPayload["reason"]) {
  const payload: SyncConflictPayload = {
    reason,
    state: room.state,
    version: room.version,
  };
  socket.emit(SYNC_EVENTS.CONFLICT, payload);
}

function emitConflictFromCrdt(
  socket: Socket,
  state: SharedMemoryState,
  version: number,
  reason: SyncConflictPayload["reason"],
) {
  socket.emit(SYNC_EVENTS.CONFLICT, {
    reason,
    state,
    version,
  });
}

function broadcastCrdtUpdate(
  io: Server,
  socket: Socket,
  roomId: string,
  updateEncoded: string,
) {
  socket.to(roomId).emit(SYNC_EVENTS.CRDT_UPDATE, { roomId, update: updateEncoded });
  socket.emit(SYNC_EVENTS.CRDT_UPDATE, { roomId, update: updateEncoded });
}

export interface AttachSyncServerOptions {
  persistence?: RoomPersistence;
  auth?: SyncAuthConfig;
  /** When set, LWW join/patch/update use CRDT as single authority. */
  crdtRoomStore?: CrdtRoomStore;
  defaultState?: SharedMemoryState;
  auditStore?: AuditStore;
}

/**
 * Attaches shared-state sync handlers to a Socket.IO server.
 * With `crdtRoomStore`, all writes go through Yjs as the single CRDT authority.
 */
export function attachSyncServer(
  io: Server,
  defaultState: unknown = {},
  options: AttachSyncServerOptions = {},
) {
  const persistence = options.persistence ?? createPersistence();
  const auth = options.auth ?? loadSyncAuthConfig();
  const crdtRoomStore = options.crdtRoomStore;
  const roomStore = new RoomStore(persistence, defaultState);
  const useCrdtAuthority = Boolean(crdtRoomStore);

  io.on("connection", (socket: Socket) => {
    let joinedRoom: string | null = null;

    socket.on(SYNC_EVENTS.JOIN, async (payload: SyncJoinPayload) => {
      const { roomId, defaultState: clientDefault, token, protocolVersion } =
        payload;
      if (!roomId) return;

      if (
        !assertSocketProtocol(
          socket,
          roomId,
          parseProtocolVersion(protocolVersion),
        )
      ) {
        return;
      }

      const access = verifyRoomToken(auth, roomId, token);
      if (!access.ok) {
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
        if (useCrdtAuthority && crdtRoomStore) {
          const doc = await crdtRoomStore.getOrCreate(roomId);
          const state = readSharedMemoryState(doc);
          const version = getRoomVersion(doc);
          socket.emit(SYNC_EVENTS.STATE, { state, version } satisfies SyncStatePayload);
          return;
        }

        const room = await roomStore.getOrCreate(
          roomId,
          clientDefault ?? defaultState,
        );
        socket.emit(SYNC_EVENTS.STATE, {
          state: room.state,
          version: room.version,
        } satisfies SyncStatePayload);
      } catch (err) {
        console.error("[sync] join failed:", err);
      }
    });

    socket.on(SYNC_EVENTS.PATCH, async (payload: SyncPatchPayload) => {
      const { roomId, patch, baseVersion } = payload;
      if (!roomId || patch.length === 0) return;

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
        if (useCrdtAuthority && crdtRoomStore) {
          const doc = await crdtRoomStore.getOrCreate(roomId);
          const prev = readSharedMemoryState(doc);
          const version = getRoomVersion(doc);
          const next = tryApplyStatePatch(prev, patch);
          const conflict = conflictReasonForPatch(
            baseVersion,
            version,
            next !== null,
          );

          if (conflict) {
            emitConflictFromCrdt(socket, prev, version, conflict);
            return;
          }

          const svBefore = captureStateVector(doc);
          applySharedMemoryStateToDoc(doc, next!);
          const newVersion = bumpRoomVersion(doc);
          await crdtRoomStore.saveDoc(roomId);
          const encoded = encodeUpdate(
            encodeIncrementalUpdate(doc, svBefore),
          );

          broadcastCrdtUpdate(io, socket, roomId, encoded);
          socket.emit(SYNC_EVENTS.PATCH, { patch: [], version: newVersion });
          socket.emit(SYNC_EVENTS.STATE, {
            state: readSharedMemoryState(doc),
            version: newVersion,
          });
          return;
        }

        const room = await roomStore.getOrCreate(roomId, defaultState);
        const next = tryApplyStatePatch(room.state, patch);
        const conflict = conflictReasonForPatch(
          baseVersion,
          room.version,
          next !== null,
        );

        if (conflict) {
          emitConflict(socket, room, conflict);
          return;
        }

        room.state = next!;
        room.version += 1;
        await roomStore.commit(roomId, room);

        const broadcast: SyncPatchBroadcast = {
          patch,
          version: room.version,
        };

        socket.to(roomId).emit(SYNC_EVENTS.PATCH, broadcast);
        socket.emit(SYNC_EVENTS.PATCH, { patch: [], version: room.version });
      } catch (err) {
        console.error("[sync] patch failed:", err);
      }
    });

    socket.on(SYNC_EVENTS.UPDATE, async (payload: SyncUpdatePayload) => {
      const { roomId, state, baseVersion } = payload;
      if (!roomId) return;

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
        if (useCrdtAuthority && crdtRoomStore) {
          const doc = await crdtRoomStore.getOrCreate(roomId);
          const version = getRoomVersion(doc);

          if (baseVersion !== version) {
            emitConflictFromCrdt(
              socket,
              readSharedMemoryState(doc),
              version,
              "stale_version",
            );
            return;
          }

          const svBefore = captureStateVector(doc);
          applySharedMemoryStateToDoc(doc, state as SharedMemoryState);
          const newVersion = bumpRoomVersion(doc);
          await crdtRoomStore.saveDoc(roomId);
          const encoded = encodeUpdate(
            encodeIncrementalUpdate(doc, svBefore),
          );

          broadcastCrdtUpdate(io, socket, roomId, encoded);
          socket.emit(SYNC_EVENTS.STATE, {
            state: readSharedMemoryState(doc),
            version: newVersion,
          });
          return;
        }

        const room = await roomStore.getOrCreate(roomId, defaultState);

        if (baseVersion !== room.version) {
          emitConflict(socket, room, "stale_version");
          return;
        }

        room.state = state;
        room.version += 1;
        await roomStore.commit(roomId, room);

        const snapshot: SyncStatePayload = {
          state: room.state,
          version: room.version,
        };
        socket.to(roomId).emit(SYNC_EVENTS.STATE, snapshot);
        socket.emit(SYNC_EVENTS.STATE, snapshot);
      } catch (err) {
        console.error("[sync] update failed:", err);
      }
    });

    socket.on(
      SYNC_EVENTS.REQUEST_STATE,
      async (payload: Pick<SyncJoinPayload, "roomId" | "token">) => {
        if (!payload.roomId) return;

        const access = verifyRoomToken(auth, payload.roomId, payload.token);
        if (!access.ok) {
          emitSyncError(socket, {
            code: access.code,
            message: access.message,
            roomId: payload.roomId,
          });
          return;
        }

        try {
          if (useCrdtAuthority && crdtRoomStore) {
            const doc = await crdtRoomStore.getOrCreate(payload.roomId);
            socket.emit(SYNC_EVENTS.STATE, {
              state: readSharedMemoryState(doc),
              version: getRoomVersion(doc),
            } satisfies SyncStatePayload);
            return;
          }

          const room = await roomStore.getOrCreate(
            payload.roomId,
            defaultState,
          );
          socket.emit(SYNC_EVENTS.STATE, {
            state: room.state,
            version: room.version,
          } satisfies SyncStatePayload);
        } catch (err) {
          console.error("[sync] request-state failed:", err);
        }
      },
    );
  });

  return { roomStore, persistence, crdtAuthority: useCrdtAuthority };
}
