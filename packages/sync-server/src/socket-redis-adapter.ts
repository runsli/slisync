import type { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

export type SocketRedisAdapterHandle = {
  pub: Redis;
  sub: Redis;
  close: () => Promise<void>;
};

/** Whether to attach @socket.io/redis-adapter (requires REDIS_URL). */
export function shouldEnableSocketRedisAdapter(): boolean {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return false;

  const flag = process.env.SYNC_SOCKET_ADAPTER?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off" || flag === "no") {
    return false;
  }

  return true;
}

function waitReady(client: Redis): Promise<void> {
  if (client.status === "ready") return Promise.resolve();
  return new Promise((resolve, reject) => {
    client.once("ready", () => resolve());
    client.once("error", (err) => reject(err));
  });
}

/**
 * Cross-process Socket.IO broadcast via Redis pub/sub.
 * Enabled when REDIS_URL is set (disable with SYNC_SOCKET_ADAPTER=0).
 */
export async function attachSocketRedisAdapter(
  io: SocketIOServer,
): Promise<SocketRedisAdapterHandle | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!shouldEnableSocketRedisAdapter() || !url) {
    return null;
  }

  const pub = new Redis(url, { maxRetriesPerRequest: 2 });
  const sub = pub.duplicate();

  await Promise.all([waitReady(pub), waitReady(sub)]);
  io.adapter(createAdapter(pub, sub));

  console.log("[sync:cluster] Socket.IO Redis adapter attached");

  return {
    pub,
    sub,
    close: async () => {
      await Promise.all([
        new Promise<void>((resolve) => {
          pub.quit(() => resolve());
        }),
        new Promise<void>((resolve) => {
          sub.quit(() => resolve());
        }),
      ]);
    },
  };
}
