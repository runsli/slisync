import { join } from "node:path";
import Redis from "ioredis";
import { decodeUpdate, encodeUpdate } from "@slisync/sync-sdk/crdt";
import { readJsonFile, writeJsonFile } from "./json-file-db";

const REDIS_KEY_PREFIX = "sync:crdt:";

type CrdtDatabase = Record<string, string>;

export interface CrdtPersistence {
  readonly backend: "redis" | "file";
  load(roomId: string): Promise<Uint8Array | null>;
  save(roomId: string, update: Uint8Array): Promise<void>;
}

export function createCrdtFilePersistence(filePath: string): CrdtPersistence {
  const resolved = filePath;

  const readDb = () => readJsonFile<CrdtDatabase>(resolved, {});
  const writeDb = (db: CrdtDatabase) => writeJsonFile(resolved, db);

  return {
    backend: "file",
    async load(roomId) {
      const db = await readDb();
      const encoded = db[roomId];
      return encoded ? decodeUpdate(encoded) : null;
    },
    async save(roomId, update) {
      const db = await readDb();
      db[roomId] = encodeUpdate(update);
      await writeDb(db);
    },
  };
}

export function createCrdtRedisPersistence(url: string): CrdtPersistence {
  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    enableOfflineQueue: false,
  });
  return {
    backend: "redis",
    async load(roomId) {
      const raw = await redis.get(`${REDIS_KEY_PREFIX}${roomId}`);
      return raw ? decodeUpdate(raw) : null;
    },
    async save(roomId, update) {
      await redis.set(`${REDIS_KEY_PREFIX}${roomId}`, encodeUpdate(update));
    },
  };
}

export function createCrdtPersistence(): CrdtPersistence {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) return createCrdtRedisPersistence(redisUrl);

  const dataPath =
    process.env.SYNC_CRDT_DATA_PATH?.trim() ||
    join(process.cwd(), ".sync-data", "crdt-rooms.json");

  return createCrdtFilePersistence(dataPath);
}
