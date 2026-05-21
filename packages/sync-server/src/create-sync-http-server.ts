import { createServer, type Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import type { SharedMemoryState } from "@slisync/sync-sdk/crdt";
import { attachAgentServer } from "./attach-agent-server";
import { attachCrdtServer } from "./attach-crdt-server";
import { attachGraphNotify } from "./attach-graph-notify";
import { attachPresenceServer } from "./attach-presence-server";
import { attachSyncServer } from "./attach-sync-server";
import { loadSyncAuthConfig } from "./auth";
import { createAuditHttpHandler } from "./audit-http";
import { AuditStore } from "./audit-store";
import { createAuditPersistence } from "./audit-persistence";
import { createGraphHttpHandler } from "./graph-http";
import { handleSyncCapabilitiesGet } from "./sync-capabilities-http";
import { SYNC_PROTOCOL_VERSION } from "@slisync/sync-schema";
import { createPersistence, type RoomPersistence } from "./persistence";
import {
  attachSocketRedisAdapter,
  type SocketRedisAdapterHandle,
} from "./socket-redis-adapter";

export interface CreateSyncHttpServerOptions {
  port?: number;
  host?: string;
  defaultState?: SharedMemoryState;
  persistence?: RoomPersistence;
}

export interface SyncHttpServer {
  httpServer: HttpServer;
  io: SocketIOServer;
  persistence: RoomPersistence;
  socketRedisAdapter: SocketRedisAdapterHandle | null;
  listen: () => Promise<void>;
  close: () => Promise<void>;
}

const DEFAULT_STATE: SharedMemoryState = {
  message: "Hello from shared memory",
  counter: 0,
  agentLog: [],
};

export function createSyncHttpServer(
  options: CreateSyncHttpServerOptions = {},
): SyncHttpServer {
  const port = options.port ?? Number(process.env.SYNC_PORT ?? 3001);
  const host = options.host ?? process.env.SYNC_HOST ?? "0.0.0.0";
  const defaultState = options.defaultState ?? DEFAULT_STATE;
  const persistence = options.persistence ?? createPersistence();

  const auth = loadSyncAuthConfig();

  let graphHttpHandler: ReturnType<typeof createGraphHttpHandler> | null = null;
  let auditHttpHandler: ReturnType<typeof createAuditHttpHandler> | null = null;
  let socketRedisAdapterActive = false;
  let crdtAuthorityActive = false;
  const auditStore = new AuditStore(createAuditPersistence());

  const httpServer = createServer((req, res) => {
    void (async () => {
      const path = req.url?.split("?")[0];
      if (
        path === "/v1/sync/capabilities" ||
        path === "/sync/capabilities"
      ) {
        handleSyncCapabilitiesGet(req, res, {
          crdtAuthority: crdtAuthorityActive,
        });
        return;
      }
      if (path === "/health" || path === "/healthz") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            protocolVersion: SYNC_PROTOCOL_VERSION,
            socketRedisAdapter: socketRedisAdapterActive,
            crdtAuthority: crdtAuthorityActive,
            capabilitiesPath: "/v1/sync/capabilities",
          }),
        );
        return;
      }
      if (auditHttpHandler && (await auditHttpHandler(req, res))) {
        return;
      }
      if (graphHttpHandler && (await graphHttpHandler(req, res))) {
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    })();
  });

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
    connectTimeout: 20000,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  const { crdtRoomStore } = attachCrdtServer(io, defaultState, {
    auth,
    auditStore,
  });
  const { roomStore, crdtAuthority } = attachSyncServer(io, defaultState, {
    persistence,
    auth,
    crdtRoomStore,
    defaultState,
    auditStore,
  });
  crdtAuthorityActive = crdtAuthority;
  attachAgentServer(io, {
    crdtRoomStore,
    defaultState,
    auth,
    auditStore,
    roomStore,
  });
  attachGraphNotify(io, { auth, crdtRoomStore, auditStore });
  attachPresenceServer(io);

  auditHttpHandler = createAuditHttpHandler(auditStore, auth);
  graphHttpHandler = createGraphHttpHandler({
    io,
    crdtRoomStore,
    defaultState,
    auth,
    auditStore,
    roomStore,
  });

  const server: SyncHttpServer = {
    httpServer,
    io,
    persistence,
    socketRedisAdapter: null,
    listen: async () => {
      server.socketRedisAdapter = await attachSocketRedisAdapter(io);
      socketRedisAdapterActive = Boolean(server.socketRedisAdapter);
      await new Promise<void>((resolve) => {
        httpServer.listen(port, host, () => resolve());
      });
    },
    close: async () => {
      io.close();
      await server.socketRedisAdapter?.close();
      server.socketRedisAdapter = null;
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };

  return server;
}
