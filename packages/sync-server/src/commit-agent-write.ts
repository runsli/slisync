import type { Server } from "socket.io";
import { encodeUpdate } from "@slisync/sync-sdk/crdt";
import type { AgentGraphPolicy, GraphOp } from "@slisync/sync-schema";
import { validateGraphOps } from "@slisync/sync-schema";
import {
  applyAgentMemoryToDoc,
  appendAgentLogEntry,
  type AgentMemoryEntry,
  type AgentMemoryPatch,
} from "@slisync/sync-sdk/agent";
import {
  applyGraphOps,
  buildGraphActivitySummary,
  ensureMemoryGraphDoc,
  summarizeGraphOps,
} from "@slisync/sync-sdk/graph";
import {
  bumpRoomVersion,
  captureStateVector,
  encodeIncrementalUpdate,
  readSharedMemoryState,
} from "@slisync/sync-sdk/crdt";
import type { SharedMemoryState } from "@slisync/sync-sdk/shared-memory-state";
import {
  SYNC_EVENTS,
  type AgentPushAck,
} from "@slisync/sync-sdk/protocol";
import { loadAgentGraphPolicy } from "./agent-graph-policy-config";
import { loadSyncAuthConfig, verifyAgentToken, type SyncAuthConfig } from "./auth";
import type { AuditStore } from "./audit-store";
import type { CrdtRoomStore } from "./crdt-room-store";

export interface CommitAgentWriteDeps {
  crdtRoomStore: CrdtRoomStore;
  defaultState: SharedMemoryState;
  auth?: SyncAuthConfig;
  agentGraphPolicy?: AgentGraphPolicy;
  auditStore?: AuditStore;
  /** @deprecated LWW room store — reads use CRDT; kept for wiring compat only. */
  roomStore?: unknown;
}

export interface CommitAgentWriteInput {
  roomId: string;
  agentId: string;
  action: string;
  token?: string;
  graphOps?: GraphOp[];
  memory?: AgentMemoryPatch;
}

export async function commitAgentWriteToRoom(
  io: Server,
  deps: CommitAgentWriteDeps,
  input: CommitAgentWriteInput,
): Promise<AgentPushAck> {
  const { crdtRoomStore, defaultState, auditStore } = deps;
  const auth = deps.auth ?? loadSyncAuthConfig();
  const graphPolicy = deps.agentGraphPolicy ?? loadAgentGraphPolicy();

  const { roomId, agentId, action, memory, graphOps, token } = input;

  if (!roomId || !agentId || !action) {
    return { ok: false, error: "roomId, agentId, action required" };
  }

  const agentAuth = verifyAgentToken(auth, roomId, token);
  if (!agentAuth.ok) {
    return { ok: false, error: agentAuth.message };
  }

  const hasGraphOps = Array.isArray(graphOps) && graphOps.length > 0;
  const hasMemory =
    memory != null &&
    (memory.message !== undefined ||
      memory.appendToMessage !== undefined ||
      memory.counterDelta !== undefined);

  if (!hasGraphOps && !hasMemory) {
    return { ok: false, error: "memory patch or graphOps required" };
  }

  if (hasMemory && graphPolicy.denyMemoryPatch) {
    return { ok: false, error: "agent memory patch denied by policy" };
  }

  if (hasGraphOps) {
    const check = validateGraphOps(graphOps!, graphPolicy);
    if (!check.ok) {
      return { ok: false, error: check.error };
    }
  }

  try {
    const doc = await crdtRoomStore.getOrCreate(roomId);
    ensureMemoryGraphDoc(doc, roomId);
    const stateVectorBefore = captureStateVector(doc);

    const summaryParts: string[] = [];
    let entry: AgentMemoryEntry = {
      agentId,
      action,
      summary: action,
      at: Date.now(),
    };

    if (hasMemory) {
      entry = applyAgentMemoryToDoc(doc, {
        agentId,
        action,
        memory: memory!,
      });
      summaryParts.push(entry.summary);
    }

    if (hasGraphOps) {
      summaryParts.push(summarizeGraphOps(graphOps!));
    }

    if (!hasMemory) {
      entry = {
        agentId,
        action,
        summary: summaryParts.join("; ") || action,
        at: Date.now(),
      };
      appendAgentLogEntry(doc, entry);
    }

    if (hasGraphOps) {
      applyGraphOps(doc, graphOps!, agentId);
    }

    const version = bumpRoomVersion(doc);
    await crdtRoomStore.saveDoc(roomId);

    const incremental = encodeIncrementalUpdate(doc, stateVectorBefore);
    const state = readSharedMemoryState(doc);

    if (auditStore) {
      await auditStore.record({
        roomId,
        actorId: agentId,
        source: "agent",
        action,
        summary: entry.summary,
        version,
      });
    }

    io.to(roomId).emit(SYNC_EVENTS.STATE, {
      state,
      version,
    });
    io.to(roomId).emit(SYNC_EVENTS.CRDT_UPDATE, {
      roomId,
      update: encodeUpdate(incremental),
    });
    io.to(roomId).emit(SYNC_EVENTS.AGENT_ACTIVITY, {
      roomId,
      entry,
      version,
    });

    if (hasGraphOps) {
      io.to(roomId).emit(SYNC_EVENTS.GRAPH_ACTIVITY, {
        roomId,
        actorId: agentId,
        summary: buildGraphActivitySummary(graphOps!),
        at: entry.at,
        source: "agent",
      });
    }

    return { ok: true, version, entry };
  } catch (err) {
    const message = err instanceof Error ? err.message : "agent write failed";
    console.error("[sync:agent] write failed:", err);
    return { ok: false, error: message };
  }
}
