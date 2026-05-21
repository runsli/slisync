#!/usr/bin/env node
/** @slisync/sync-server CLI — run after `npm run build` in this package. */
import { getLanIPv4Addresses } from "./network";
import { createSyncHttpServer } from "./create-sync-http-server";
import { loadSyncAuthConfig } from "./auth";

const auth = loadSyncAuthConfig();
const port = Number(process.env.SYNC_PORT ?? 3001);
const host = process.env.SYNC_HOST ?? "0.0.0.0";

const sync = createSyncHttpServer({ port, host });

sync.listen().then(() => {
  console.log(`> @slisync/sync-server listening on ${host}:${port}`);
  console.log(`> Health: http://localhost:${port}/health`);
  console.log(`> Graph HTTP: POST http://localhost:${port}/v1/graphs/:roomId/ops`);
  console.log(
    `> Graph HTTP: GET http://localhost:${port}/v1/graphs/:roomId/traverse?startId=...`,
  );
  console.log(`> Socket.IO path: /socket.io`);
  console.log(`> LWW persistence: ${sync.persistence.backend}`);
  console.log(
    `> Socket Redis adapter: ${sync.socketRedisAdapter ? "enabled" : "disabled"}`,
  );
  console.log(`> Sync auth: ${auth.enabled ? "enabled" : "disabled"}`);
  for (const ip of getLanIPv4Addresses()) {
    console.log(`> LAN: http://${ip}:${port}`);
  }
  console.log(
    "> Point the demo at this host with NEXT_PUBLIC_SYNC_URL if UI runs elsewhere",
  );
});

function shutdown() {
  sync.close().then(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
