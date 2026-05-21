import type { Server, Socket } from "socket.io";
import type { SharedMemoryState } from "@slisync/sync-sdk/shared-memory-state";
import {
  SYNC_EVENTS,
  type AgentPushAck,
  type AgentPushPayload,
} from "@slisync/sync-sdk/protocol";
import { parseProtocolVersion, type AgentGraphPolicy } from "@slisync/sync-schema";
import { assertSocketProtocol } from "./protocol-guard";
import {
  commitAgentWriteToRoom,
  type CommitAgentWriteDeps,
} from "./commit-agent-write";
import { emitSyncError, loadSyncAuthConfig, markRoomAuthenticated } from "./auth";
import { loadAgentGraphPolicy } from "./agent-graph-policy-config";
import type { CrdtRoomStore } from "./crdt-room-store";
import type { RoomStore } from "./persistence";

export interface AttachAgentServerDeps extends CommitAgentWriteDeps {}

export function attachAgentServer(io: Server, deps: AttachAgentServerDeps) {
  const commitDeps: CommitAgentWriteDeps = {
    crdtRoomStore: deps.crdtRoomStore,
    defaultState: deps.defaultState,
    auth: deps.auth ?? loadSyncAuthConfig(),
    agentGraphPolicy: deps.agentGraphPolicy ?? loadAgentGraphPolicy(),
    auditStore: deps.auditStore,
    roomStore: deps.roomStore,
  };

  io.on("connection", (socket: Socket) => {
    socket.on(
      SYNC_EVENTS.AGENT_PUSH,
      async (payload: AgentPushPayload, ack?: (res: AgentPushAck) => void) => {
        const { roomId } = payload;

        if (
          !assertSocketProtocol(
            socket,
            roomId,
            parseProtocolVersion(payload.protocolVersion),
          )
        ) {
          ack?.({ ok: false, error: "incompatible protocol version" });
          return;
        }

        const result = await commitAgentWriteToRoom(io, commitDeps, payload);

        if (!result.ok) {
          if (roomId) {
            emitSyncError(socket, {
              code: result.error?.includes("token")
                ? "invalid_token"
                : "policy_violation",
              message: result.error ?? "agent push failed",
              roomId,
            });
          }
        } else if (roomId) {
          socket.join(roomId);
          markRoomAuthenticated(socket, roomId, "agent");
        }

        ack?.(result);
      },
    );
  });
}
