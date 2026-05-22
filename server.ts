import "./server-globals";
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import {
  attachAgentServer,
  attachCrdtServer,
  attachGraphNotify,
  attachPresenceServer,
  attachSyncServer,
  createPersistence,
  getLanIPv4Addresses,
  loadSyncAuthConfig,
  createExportHttpHandler,
  createGraphHttpHandler,
  handleSyncCapabilitiesGet,
} from "@slisync/sync-server";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const lanIps = getLanIPv4Addresses();
/** Address the HTTP server listens on (all interfaces in dev). */
const bindHost = process.env.HOST ?? (dev ? "0.0.0.0" : "localhost");
/**
 * Hostname Next uses for dev allowlist — must be a real LAN IP or localhost,
 * NOT 0.0.0.0, or phones get 403 on /_next/* assets.
 */
const nextHostname =
  process.env.NEXT_DEV_HOST?.trim() || lanIps[0] || "localhost";

const app = next({ dev, hostname: nextHostname, port });
const handle = app.getRequestHandler();

const demoDefaultState = {
  message: "Hello from shared memory",
  counter: 0,
  agentLog: [] as { agentId: string; action: string; summary: string; at: number }[],
};

app.prepare().then(() => {
  let exportHttpHandler: ReturnType<typeof createExportHttpHandler> | null = null;
  let graphHttpHandler: ReturnType<typeof createGraphHttpHandler> | null = null;

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    if (parsedUrl.pathname?.startsWith("/socket.io")) {
      return;
    }
    void (async () => {
      const path = parsedUrl.pathname;
      if (
        path === "/v1/sync/capabilities" ||
        path === "/sync/capabilities"
      ) {
        handleSyncCapabilitiesGet(req, res, { crdtAuthority: true });
        return;
      }
      if (exportHttpHandler && (await exportHttpHandler(req, res))) {
        return;
      }
      if (graphHttpHandler && (await graphHttpHandler(req, res))) {
        return;
      }
      handle(req, res, parsedUrl);
    })();
  });

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
    connectTimeout: 20000,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.engine.on("connection_error", (err) => {
    console.error("[socket.io] connection_error:", err.message, err.context);
  });

  io.on("connection", (socket) => {
    console.log(
      "[socket.io] connected",
      socket.id,
      socket.handshake.address,
      socket.handshake.headers.origin ?? "no-origin",
    );
  });

  const persistence = createPersistence();
  const auth = loadSyncAuthConfig();
  const { roomStore } = attachSyncServer(io, demoDefaultState, {
    persistence,
    auth,
  });
  const { crdtRoomStore } = attachCrdtServer(io, demoDefaultState, { auth });
  attachAgentServer(io, {
    roomStore,
    crdtRoomStore,
    defaultState: demoDefaultState,
    auth,
  });
  attachGraphNotify(io, { auth });
  attachPresenceServer(io);

  exportHttpHandler = createExportHttpHandler({ crdtRoomStore, auth });
  graphHttpHandler = createGraphHttpHandler({
    io,
    roomStore,
    crdtRoomStore,
    defaultState: demoDefaultState,
    auth,
  });

  httpServer.listen(port, bindHost, () => {
    console.log(`> Listen on ${bindHost}:${port}`);
    console.log(`> Next dev host: ${nextHostname} (allowedDevOrigins)`);
    console.log(`> Local:  http://localhost:${port}`);
    for (const ip of lanIps) {
      console.log(`> LAN:    http://${ip}:${port}`);
    }
    if (lanIps.length === 0) {
      console.log(`> LAN:    set NEXT_DEV_HOST=<your-ip> if needed`);
    }
    console.log(`> Socket.IO: same URL as page, path /socket.io`);
    console.log(`> LWW persistence: ${persistence.backend}`);
    console.log(
      `> Sync auth: ${auth.enabled ? "enabled" : "disabled (set SYNC_API_KEY + SYNC_AUTH_REQUIRED=1)"}`,
    );
    console.log(`> Graph HTTP: POST /v1/graphs/:roomId/ops`);
    console.log(`> Export HTTP: GET /v1/rooms/:roomId/export/chunks`);
  });
});
