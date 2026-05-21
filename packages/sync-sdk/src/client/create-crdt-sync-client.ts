"use client";

import * as Y from "yjs";
import { io, type Socket } from "socket.io-client";
import { decodeUpdate, encodeUpdate } from "../crdt/codec";
import {
  applyRemoteUpdate,
  observeSharedMemory,
  onDocumentUpdate,
  readSharedMemoryState,
  updateMessage,
  type SharedMemoryState,
} from "../crdt/shared-memory-doc";
import { ensureMemoryGraphDoc } from "../graph/ensure-graph";
import { getRoomSyncToken } from "../get-sync-auth";
import { CrdtUpdateOutbox } from "../offline/crdt-outbox";
import { defaultProtocolVersion } from "../sync-protocol-client";
import { getSyncEndpoint } from "../get-sync-endpoint";
import {
  SYNC_EVENTS,
  type AgentActivityPayload,
  type GraphActivityPayload,
  type PresenceStatePayload,
  type SyncCrdtJoinAck,
} from "../protocol";
import type { SyncStoreHook } from "../store/create-sync-store";

export interface CrdtSyncClientOptions<T extends SharedMemoryState> {
  url?: string;
  roomId: string;
  defaultState: T;
  store: SyncStoreHook<T>;
}

const DEFAULT_RECONNECT = {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
};

const JOIN_ACK_TIMEOUT_MS = 8000;
const JOIN_RETRY_MS = 2500;

export class CrdtSyncClient<T extends SharedMemoryState> {
  private socket: Socket | null = null;
  private doc: Y.Doc | null = null;
  private unobserve: (() => void) | null = null;
  private unlisten: (() => void) | null = null;
  private joinRetryTimer: ReturnType<typeof setInterval> | null = null;
  private synced = false;
  private readonly outbox = new CrdtUpdateOutbox();
  private readonly options: CrdtSyncClientOptions<T>;

  constructor(options: CrdtSyncClientOptions<T>) {
    this.options = options;
  }

  connect() {
    if (this.socket) this.disconnect();

    const { store, roomId, defaultState, url } = this.options;
    const endpoint = getSyncEndpoint(url);

    this.synced = false;
    this.ensureClientId();
    store.getState().setSyncReady(false);
    store.getState().setStatus("connecting");

    this.doc = new Y.Doc();

    this.unobserve = observeSharedMemory(this.doc, (state) => {
      store.setState({
        data: state as T,
        lastConflict: null,
      });
    });

    this.socket = io(endpoint, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: false,
      ...DEFAULT_RECONNECT,
    });

    this.attachSocketHandlers();
    this.socket.connect();
  }

  getDocument() {
    return this.doc;
  }

  /** Relay local graph edits to other clients in the room. */
  notifyGraphActivity(summary: string) {
    const { roomId } = this.options;
    const actorId = this.options.store.getState().clientId || "anonymous";
    if (!this.socket?.connected || !summary.trim()) return;
    this.socket.emit(SYNC_EVENTS.GRAPH_NOTIFY, {
      roomId,
      actorId,
      summary: summary.trim(),
    });
  }

  isSynced() {
    return this.synced;
  }

  disconnect() {
    this.emitPresenceLeave();
    this.outbox.clear();
    this.options.store.getState().setOutboxSize(0);
    this.clearJoinRetry();
    this.unobserve?.();
    this.unlisten?.();
    this.unobserve = null;
    this.unlisten = null;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.doc?.destroy();
    this.doc = null;
    this.synced = false;
    this.options.store.getState().setSyncReady(false);
    this.options.store.getState().setStatus("disconnected");
  }

  private attachSocketHandlers() {
    const { store, roomId } = this.options;
    const socket = this.socket;
    if (!socket || !this.doc) return;

    this.unlisten = onDocumentUpdate(this.doc, (update) => {
      const encoded = encodeUpdate(update);
      if (this.canEmitCrdt()) {
        socket.emit(SYNC_EVENTS.CRDT_UPDATE, { roomId, update: encoded });
        return;
      }
      this.outbox.enqueue(encoded);
      this.options.store.getState().setOutboxSize(this.outbox.size);
    });

    const onSocketConnect = () => {
      store.getState().setStatus("connected");
      store.getState().setConnectionError(null);
      this.requestJoin();
    };

    socket.on("connect", onSocketConnect);

    socket.io.on("reconnect_attempt", () => {
      this.synced = false;
      store.getState().setSyncReady(false);
      store.getState().setStatus("reconnecting");
    });

    socket.io.on("reconnect", () => {
      this.synced = false;
      store.getState().setSyncReady(false);
      store.getState().setStatus("connected");
      this.requestJoin();
    });

    socket.on("disconnect", () => {
      this.clearJoinRetry();
      this.synced = false;
      store.getState().setStatus("disconnected");
      store.getState().setSyncReady(false);
      store.getState().setPresenceMembers([]);
      this.emitPresenceLeave();
    });

    socket.on(SYNC_EVENTS.CRDT_SYNC, (payload: { update?: string }) => {
      if (payload?.update != null) this.applySnapshot(payload.update);
    });

    socket.on(SYNC_EVENTS.AGENT_ACTIVITY, (payload: AgentActivityPayload) => {
      if (payload?.entry) {
        store.getState().setLastAgentActivity(payload);
      }
    });

    socket.on(SYNC_EVENTS.GRAPH_ACTIVITY, (payload: GraphActivityPayload) => {
      if (payload?.summary) {
        store.getState().setLastGraphActivity(payload);
      }
    });

    socket.on(SYNC_EVENTS.CRDT_UPDATE, (payload: { update?: string }) => {
      if (!this.doc || payload?.update == null) return;
      try {
        applyRemoteUpdate(this.doc, decodeUpdate(payload.update));
        this.markSynced();
        store.setState({ version: store.getState().version + 1 });
      } catch (err) {
        console.error("[crdt] apply update failed:", err);
      }
    });

    socket.on(SYNC_EVENTS.PRESENCE_STATE, (payload: PresenceStatePayload) => {
      if (payload?.roomId === roomId && Array.isArray(payload.members)) {
        store.getState().setPresenceMembers(payload.members);
      }
    });

    socket.on(SYNC_EVENTS.ERROR, (payload: { message?: string }) => {
      if (payload?.message) {
        store.getState().setConnectionError(payload.message);
      }
    });

    socket.on("connect_error", (err) => {
      store.getState().setStatus("reconnecting");
      store.getState().setConnectionError(err.message);
    });
  }

  private requestJoin() {
    this.joinRoomWithAck();
    this.startJoinRetry();
  }

  private joinRoomWithAck() {
    const { store, roomId, defaultState } = this.options;
    const socket = this.socket;
    if (!socket?.connected) return;

    const token = getRoomSyncToken(roomId);

    socket.timeout(JOIN_ACK_TIMEOUT_MS).emit(
      SYNC_EVENTS.CRDT_JOIN,
      {
        roomId,
        defaultState,
        token,
        protocolVersion: defaultProtocolVersion(),
      },
      (err: Error | null, res: SyncCrdtJoinAck) => {
        if (err) {
          store.getState().setConnectionError(err.message);
          return;
        }
        if (res?.error) {
          store.getState().setConnectionError(res.error);
          return;
        }
        if (res?.update != null) this.applySnapshot(res.update);
      },
    );
  }

  private startJoinRetry() {
    this.clearJoinRetry();
    this.joinRetryTimer = setInterval(() => {
      if (this.synced || !this.socket?.connected) {
        this.clearJoinRetry();
        return;
      }
      this.joinRoomWithAck();
    }, JOIN_RETRY_MS);
  }

  private clearJoinRetry() {
    if (this.joinRetryTimer) {
      clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }
  }

  private applySnapshot(encoded: string) {
    if (!this.doc) return;

    const { store } = this.options;
    try {
      applyRemoteUpdate(this.doc, decodeUpdate(encoded));
      this.markSynced();
      store.setState({ version: store.getState().version + 1 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to apply CRDT snapshot";
      console.error("[crdt] apply snapshot failed:", err);
      store.getState().setConnectionError(message);
    }
  }

  private markSynced() {
    if (this.synced) return;
    this.synced = true;
    this.clearJoinRetry();
    this.options.store.getState().setSyncReady(true);
    if (this.doc) {
      ensureMemoryGraphDoc(this.doc, this.options.roomId);
    }
    this.mergePendingMessageEdits();
    this.flushOutbox();
    this.emitPresenceJoin();
  }

  private canEmitCrdt(): boolean {
    return Boolean(this.synced && this.socket?.connected);
  }

  private flushOutbox() {
    const { roomId } = this.options;
    const socket = this.socket;
    if (!socket?.connected) return;

    const pending = this.outbox.drain();
    if (pending.length === 0) {
      this.options.store.getState().setOutboxSize(0);
      return;
    }

    for (const update of pending) {
      socket.emit(SYNC_EVENTS.CRDT_UPDATE, { roomId, update });
    }
    this.options.store.getState().setOutboxSize(0);
  }

  private emitPresenceJoin() {
    const { store, roomId } = this.options;
    const clientId = store.getState().clientId;
    if (!this.socket?.connected || !clientId) return;
    this.socket.emit(SYNC_EVENTS.PRESENCE_JOIN, {
      roomId,
      clientId,
      actorId: clientId,
      status: "online",
    });
  }

  private emitPresenceLeave() {
    if (!this.socket?.connected) return;
    this.socket.emit(SYNC_EVENTS.PRESENCE_LEAVE, {});
  }

  private mergePendingMessageEdits() {
    if (!this.doc) return;
    const { store } = this.options;
    const uiMessage = (store.getState().data as SharedMemoryState).message;
    const docMessage = readSharedMemoryState(this.doc).message;
    if (uiMessage !== docMessage) {
      updateMessage(this.doc, docMessage, uiMessage);
    }
  }

  private ensureClientId() {
    const { store } = this.options;
    if (store.getState().clientId) return;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `client-${Date.now()}`;
    store.setState({ clientId: id });
  }
}

export function createCrdtSyncClient<T extends SharedMemoryState>(
  options: CrdtSyncClientOptions<T>,
) {
  return new CrdtSyncClient(options);
}
