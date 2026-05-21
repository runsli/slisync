import type { Socket } from "socket.io";
import type { GraphActivityPayload, MemoryGraphSnapshot } from "@slisync/sync-schema";
import { summarizeGraphSnapshotDiff } from "@slisync/sync-sdk/graph";
import { SYNC_EVENTS } from "@slisync/sync-sdk/protocol";
import type { AuditStore } from "./audit-store";

export function resolveGraphActivityActorId(socket: Socket): string {
  const auth = socket.handshake.auth as { clientId?: string } | undefined;
  const fromAuth =
    typeof auth?.clientId === "string" && auth.clientId.trim()
      ? auth.clientId.trim()
      : undefined;
  return fromAuth ?? socket.id;
}

/**
 * Notify peers when a CRDT update changed the memory graph (excludes sender).
 */
export function emitGraphActivityIfSnapshotChanged(
  socket: Socket,
  roomId: string,
  before: MemoryGraphSnapshot | null,
  after: MemoryGraphSnapshot | null,
  auditStore?: AuditStore,
): void {
  const summary = summarizeGraphSnapshotDiff(before, after);
  if (!summary) return;

  const actorId = resolveGraphActivityActorId(socket);
  const at = Date.now();

  const activity: GraphActivityPayload = {
    roomId,
    actorId,
    summary,
    at,
    source: "human",
  };

  socket.to(roomId).emit(SYNC_EVENTS.GRAPH_ACTIVITY, activity);

  if (auditStore) {
    void auditStore.record({
      roomId,
      actorId,
      source: "human",
      action: "graph_edit",
      summary,
    });
  }
}
