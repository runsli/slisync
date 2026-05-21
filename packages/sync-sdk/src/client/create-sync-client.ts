"use client";

import { io, type Socket } from "socket.io-client";
import type { Operation } from "../patch";
import {
  SYNC_EVENTS,
  type AgentActivityPayload,
  type SyncConflictPayload,
  type SyncPatchBroadcast,
  type SyncStatePayload,
} from "../protocol";
import { getRoomSyncToken } from "../get-sync-auth";
import { defaultProtocolVersion } from "../sync-protocol-client";
import { getSyncEndpoint } from "../get-sync-endpoint";
import type { SyncStoreHook } from "../store/create-sync-store";

export interface SyncClientOptions<T> {
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

/**
 * Thin transport layer: Socket.IO ↔ Zustand store.
 * Handles sync:conflict and baseVersion optimistic concurrency (LWW).
 */
export class SyncClient<T extends Record<string, unknown>> {
  private socket: Socket | null = null;
  private readonly options: SyncClientOptions<T>;

  constructor(options: SyncClientOptions<T>) {
    this.options = options;
  }

  connect() {
    if (this.socket?.connected) return;

    const { store, roomId, defaultState, url } = this.options;
    const endpoint = getSyncEndpoint(url);

    this.ensureClientId();
    store.getState().setStatus("connecting");

    this.socket = io(endpoint, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
      ...DEFAULT_RECONNECT,
    });

    store.getState().bindEmitter({
      emitPatch: (patch: Operation[], baseVersion: number) => {
        this.socket?.emit(SYNC_EVENTS.PATCH, { roomId, patch, baseVersion });
      },
      emitFull: (state: T, baseVersion: number) => {
        this.socket?.emit(SYNC_EVENTS.UPDATE, { roomId, state, baseVersion });
      },
    });

    this.socket.on("connect", () => {
      store.getState().setStatus("connected");
      store.getState().setConnectionError(null);
      this.joinRoom();
    });

    this.socket.io.on("reconnect_attempt", () => {
      store.getState().setStatus("reconnecting");
    });

    this.socket.io.on("reconnect", () => {
      store.getState().setStatus("connected");
      this.joinRoom();
    });

    this.socket.on("disconnect", () => {
      store.getState().setStatus("disconnected");
    });

    this.socket.on(SYNC_EVENTS.STATE, (payload: SyncStatePayload<T>) => {
      store.getState().applyRemote(payload);
    });

    this.socket.on(SYNC_EVENTS.PATCH, (payload: SyncPatchBroadcast) => {
      store.getState().applyRemotePatch(payload);
    });

    this.socket.on(SYNC_EVENTS.AGENT_ACTIVITY, (payload: AgentActivityPayload) => {
      if (payload?.entry) {
        store.getState().setLastAgentActivity(payload);
      }
    });

    this.socket.on(SYNC_EVENTS.CONFLICT, (payload: SyncConflictPayload<T>) => {
      store.getState().applyConflict({
        state: payload.state,
        version: payload.version,
        reason: payload.reason,
      });
    });

    this.socket.on(SYNC_EVENTS.ERROR, (payload: { message?: string }) => {
      if (payload?.message) {
        store.getState().setConnectionError(payload.message);
      }
    });

    this.socket.on("connect_error", (err) => {
      store.getState().setStatus("reconnecting");
      store.getState().setConnectionError(err.message);
    });
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.options.store.getState().setStatus("disconnected");
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

  /** Re-join room and pull authoritative snapshot (also used after reconnect). */
  private joinRoom() {
    const { roomId, defaultState } = this.options;
    const token = getRoomSyncToken(roomId);
    this.socket?.emit(SYNC_EVENTS.JOIN, {
      roomId,
      defaultState,
      token,
      protocolVersion: defaultProtocolVersion(),
    });
  }
}

export function createSyncClient<T extends Record<string, unknown>>(
  options: SyncClientOptions<T>,
) {
  return new SyncClient(options);
}
