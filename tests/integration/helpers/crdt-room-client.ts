import * as Y from "yjs";
import { io, type Socket } from "socket.io-client";
import { applyRemoteUpdate, decodeUpdate, encodeUpdate } from "@slisync/sync-sdk/crdt";
import { applyGraphOps, MemoryGraph } from "@slisync/sync-sdk/graph";
import type { GraphOp } from "@slisync/sync-schema";
import {
  SYNC_EVENTS,
  type GraphActivityPayload,
  type SyncCrdtJoinAck,
  type SyncErrorPayload,
} from "@slisync/sync-sdk/protocol";
import type { MemoryGraphSnapshot } from "@slisync/sync-schema";

const DEFAULT_TIMEOUT_MS = 12_000;

export type CrdtRoomClient = {
  doc: Y.Doc;
  socket: Socket;
  roomId: string;
  graphActivities: GraphActivityPayload[];
  syncErrors: SyncErrorPayload[];
  join: () => Promise<void>;
  pushGraphOps: (graphOps: GraphOp[], actorId: string) => void;
  waitForGraph: (
    predicate: (snap: MemoryGraphSnapshot) => boolean,
    timeoutMs?: number,
  ) => Promise<MemoryGraphSnapshot>;
  waitForGraphActivity: (timeoutMs?: number) => Promise<GraphActivityPayload>;
  close: () => void;
};

export function createCrdtRoomClient(options: {
  baseUrl: string;
  roomId: string;
  token?: string;
}): CrdtRoomClient {
  const { baseUrl, roomId, token } = options;
  const doc = new Y.Doc();
  const graphActivities: GraphActivityPayload[] = [];
  const syncErrors: SyncErrorPayload[] = [];

  const socket = io(baseUrl, {
    path: "/socket.io",
    transports: ["websocket"],
    autoConnect: false,
    timeout: 10_000,
  });

  const applyEncoded = (encoded: string) => {
    applyRemoteUpdate(doc, decodeUpdate(encoded));
  };

  socket.on(SYNC_EVENTS.CRDT_SYNC, (payload: { update?: string }) => {
    if (payload?.update) applyEncoded(payload.update);
  });

  socket.on(SYNC_EVENTS.CRDT_UPDATE, (payload: { update?: string }) => {
    if (payload?.update) applyEncoded(payload.update);
  });

  socket.on(SYNC_EVENTS.GRAPH_ACTIVITY, (payload: GraphActivityPayload) => {
    graphActivities.push(payload);
  });

  socket.on(SYNC_EVENTS.ERROR, (payload: SyncErrorPayload) => {
    syncErrors.push(payload);
  });

  const join = () =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("CRDT join timed out"));
      }, DEFAULT_TIMEOUT_MS);

      const onConnectError = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };

      socket.once("connect_error", onConnectError);
      socket.once("connect", () => {
        socket.off("connect_error", onConnectError);
        socket
          .timeout(DEFAULT_TIMEOUT_MS)
          .emit(
            SYNC_EVENTS.CRDT_JOIN,
            { roomId, token },
            (err: Error | null, ack?: SyncCrdtJoinAck) => {
              clearTimeout(timer);
              if (err) {
                reject(err);
                return;
              }
              if (ack?.error) {
                reject(new Error(ack.error));
                return;
              }
              if (ack?.update) {
                applyEncoded(ack.update);
              }
              resolve();
            },
          );
      });

      socket.connect();
    });

  const waitForGraph = (
    predicate: (snap: MemoryGraphSnapshot) => boolean,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) =>
    new Promise<MemoryGraphSnapshot>((resolve, reject) => {
      const started = Date.now();

      const tick = () => {
        const snap = MemoryGraph.on(doc, "test").snapshot();
        if (snap && predicate(snap)) {
          resolve(snap);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          reject(
            new Error(
              `graph condition not met within ${timeoutMs}ms (nodes=${snap?.nodes.length ?? 0})`,
            ),
          );
          return;
        }
        setTimeout(tick, 50);
      };

      tick();
    });

  const pushGraphOps = (graphOps: GraphOp[], actorId: string) => {
    applyGraphOps(doc, graphOps, actorId);
    const update = encodeUpdate(Y.encodeStateAsUpdate(doc));
    socket.emit(SYNC_EVENTS.CRDT_UPDATE, { roomId, update });
  };

  const waitForGraphActivity = (timeoutMs = DEFAULT_TIMEOUT_MS) =>
    new Promise<GraphActivityPayload>((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const hit = graphActivities.at(-1);
        if (hit) {
          resolve(hit);
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          reject(new Error("GRAPH_ACTIVITY not received"));
          return;
        }
        setTimeout(tick, 30);
      };
      tick();
    });

  const close = () => {
    socket.removeAllListeners();
    socket.disconnect();
    doc.destroy();
  };

  return {
    doc,
    socket,
    roomId,
    graphActivities,
    syncErrors,
    join,
    pushGraphOps,
    waitForGraph,
    waitForGraphActivity,
    close,
  };
}
