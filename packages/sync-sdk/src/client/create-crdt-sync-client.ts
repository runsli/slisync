"use client";

import * as Y from "yjs";
import { io, type Socket } from "socket.io-client";
import { decodeUpdate, encodeUpdate } from "../crdt/codec";
import {
  encodeDocumentSnapshot,
  initSharedMemoryDoc,
  observeSharedMemory,
  onDocumentUpdate,
  readSharedMemoryState,
  updateMessage,
  type SharedMemoryState,
} from "../crdt/shared-memory-doc";
import { ensureMemoryGraphDoc } from "../graph/ensure-graph";
import { getRoomSyncToken } from "../get-sync-auth";
import { createCrdtOutbox } from "../offline/create-crdt-outbox";
import type { CrdtOutbox } from "../offline/crdt-outbox-types";
import type { LocalRoomStore } from "../offline/local-room-store";
import { applyServerSnapshotToDoc } from "../offline/merge-local-remote";
import { createEmptyRoomLocalRecord } from "../offline/room-record";
import { resolveLocalRoomStore } from "../offline/resolve-local-room-store";
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
  /**
   * Persist doc snapshot and outbox locally.
   * Default: `true` in the browser (IndexedDB when available, else noop Map).
   */
  localPersistence?: boolean | LocalRoomStore;
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
const SNAPSHOT_PERSIST_DEBOUNCE_MS = 200;

export class CrdtSyncClient<T extends SharedMemoryState> {
  private socket: Socket | null = null;
  private doc: Y.Doc | null = null;
  private unobserve: (() => void) | null = null;
  private unlisten: (() => void) | null = null;
  private joinRetryTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private synced = false;
  private readonly localStore: LocalRoomStore | null;
  private readonly outbox: CrdtOutbox;
  private readonly options: CrdtSyncClientOptions<T>;

  constructor(options: CrdtSyncClientOptions<T>) {
    this.options = options;
    this.localStore = resolveLocalRoomStore(options.localPersistence);
    this.outbox = createCrdtOutbox({
      roomId: options.roomId,
      persistence: this.localStore ?? false,
    });
  }

  connect() {
    if (this.socket) this.disconnect();

    const { store, defaultState } = this.options;

    this.synced = false;
    store.getState().setSyncReady(false);
    store.getState().setStatus("connecting");
    store.getState().setLocalRestored(null);
    store.getState().setLastSyncedAt(null);

    this.doc = new Y.Doc();

    this.unobserve = observeSharedMemory(this.doc, (state) => {
      store.setState({
        data: state as T,
        lastConflict: null,
      });
    });

    void this.bootstrapThenConnect(defaultState);
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
    this.clearSnapshotPersistTimer();

    const encodedSnapshot =
      this.localStore && this.doc
        ? encodeUpdate(encodeDocumentSnapshot(this.doc))
        : undefined;

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

    if (encodedSnapshot) {
      void this.persistLocalRoom({ docSnapshot: encodedSnapshot });
    }
  }

  private async bootstrapThenConnect(defaultState: T) {
    const { store, url } = this.options;

    try {
      await this.hydrateFromLocalStore(defaultState);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load local room state";
      store.getState().setConnectionError(message);
    }

    this.ensureClientId();

    const endpoint = getSyncEndpoint(url);
    this.socket = io(endpoint, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: false,
      ...DEFAULT_RECONNECT,
    });

    this.attachSocketHandlers();
    this.socket.connect();
  }

  private async hydrateFromLocalStore(defaultState: T) {
    const { store, roomId } = this.options;
    if (!this.doc) return;

    if (!this.localStore) {
      store.getState().setLocalRestored(null);
      initSharedMemoryDoc(this.doc, defaultState as SharedMemoryState);
      return;
    }

    const record = await this.localStore.get(roomId);
    store.getState().setLocalRestored(Boolean(record?.docSnapshot));
    if (record?.lastSyncedAt != null) {
      store.getState().setLastSyncedAt(record.lastSyncedAt);
    }

    if (record?.docSnapshot) {
      try {
        applyServerSnapshotToDoc(this.doc, record.docSnapshot);
      } catch (err) {
        console.error("[crdt] local snapshot apply failed:", err);
        initSharedMemoryDoc(this.doc, defaultState as SharedMemoryState);
      }
    } else {
      initSharedMemoryDoc(this.doc, defaultState as SharedMemoryState);
    }

    if (record?.clientId) {
      store.setState({ clientId: record.clientId });
    }

    if (record?.outbox?.length && this.outbox.hydrate) {
      await this.outbox.hydrate(record.outbox);
      store.getState().setOutboxSize(this.outbox.size);
    }
  }

  private attachSocketHandlers() {
    const { store, roomId } = this.options;
    const socket = this.socket;
    if (!socket || !this.doc) return;

    this.unlisten = onDocumentUpdate(this.doc, (update) => {
      const encoded = encodeUpdate(update);
      if (this.canEmitCrdt()) {
        socket.emit(SYNC_EVENTS.CRDT_UPDATE, { roomId, update: encoded });
      } else {
        this.outbox.enqueue(encoded);
        store.getState().setOutboxSize(this.outbox.size);
      }
      this.scheduleSnapshotPersist();
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
        applyServerSnapshotToDoc(this.doc, payload.update);
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
        if (res?.update != null) {
          this.applySnapshot(res.update);
        } else if (!this.synced) {
          this.markSynced();
        }
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
      applyServerSnapshotToDoc(this.doc, encoded);
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
    const syncedAt = Date.now();
    if (pending.length === 0) {
      this.options.store.getState().setOutboxSize(0);
      this.options.store.getState().setLastSyncedAt(syncedAt);
      void this.persistLocalRoom({ lastSyncedAt: syncedAt, clearOutbox: true });
      return;
    }

    for (const update of pending) {
      socket.emit(SYNC_EVENTS.CRDT_UPDATE, { roomId, update });
    }
    this.options.store.getState().setOutboxSize(0);
    this.options.store.getState().setLastSyncedAt(syncedAt);
    void this.persistLocalRoom({ lastSyncedAt: syncedAt, clearOutbox: true });
  }

  private scheduleSnapshotPersist() {
    if (!this.localStore) return;
    if (this.snapshotPersistTimer) clearTimeout(this.snapshotPersistTimer);
    this.snapshotPersistTimer = setTimeout(() => {
      this.snapshotPersistTimer = null;
      void this.persistLocalRoom();
    }, SNAPSHOT_PERSIST_DEBOUNCE_MS);
  }

  private clearSnapshotPersistTimer() {
    if (this.snapshotPersistTimer) {
      clearTimeout(this.snapshotPersistTimer);
      this.snapshotPersistTimer = null;
    }
  }

  private async persistLocalRoom(options?: {
    docSnapshot?: string;
    lastSyncedAt?: number | null;
    clearOutbox?: boolean;
  }) {
    if (!this.localStore) return;

    const docSnapshot =
      options?.docSnapshot ??
      (this.doc ? encodeUpdate(encodeDocumentSnapshot(this.doc)) : null);
    if (!docSnapshot) return;

    const { roomId, store } = this.options;
    const existing = await this.localStore.get(roomId);
    const base = existing ?? createEmptyRoomLocalRecord(roomId);

    await this.localStore.put({
      ...base,
      docSnapshot,
      outbox: options?.clearOutbox ? [] : [...this.outbox.peekAll()],
      clientId: store.getState().clientId,
      lastSyncedAt:
        options?.lastSyncedAt !== undefined
          ? options.lastSyncedAt
          : base.lastSyncedAt,
    });
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
