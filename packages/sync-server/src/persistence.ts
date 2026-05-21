import { join } from "node:path";
import Redis from "ioredis";
import { readJsonFile, writeJsonFile } from "./json-file-db";

export type RoomRecord = {
  state: unknown;
  version: number;
};

export type PersistenceBackend = "redis" | "file" | "memory";

export interface RoomPersistence {
  readonly backend: PersistenceBackend;
  load(roomId: string): Promise<RoomRecord | null>;
  save(roomId: string, room: RoomRecord): Promise<void>;
}

const REDIS_KEY_PREFIX = "sync:room:";

export function createRedisPersistence(url: string): RoomPersistence {
  const redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });

  return {
    backend: "redis",
    async load(roomId) {
      const raw = await redis.get(`${REDIS_KEY_PREFIX}${roomId}`);
      if (!raw) return null;
      return JSON.parse(raw) as RoomRecord;
    },
    async save(roomId, room) {
      await redis.set(`${REDIS_KEY_PREFIX}${roomId}`, JSON.stringify(room));
    },
  };
}

type RoomDatabase = Record<string, RoomRecord>;

export function createFilePersistence(filePath: string): RoomPersistence {
  const resolved = filePath;

  const readDb = () => readJsonFile<RoomDatabase>(resolved, {});
  const writeDb = (db: RoomDatabase) => writeJsonFile(resolved, db);

  return {
    backend: "file",
    async load(roomId) {
      const db = await readDb();
      return db[roomId] ?? null;
    },
    async save(roomId, room) {
      const db = await readDb();
      db[roomId] = room;
      await writeDb(db);
    },
  };
}

/** Process-local only; lost on restart (tests / explicit opt-out). */
export function createMemoryPersistence(): RoomPersistence {
  const store = new Map<string, RoomRecord>();
  return {
    backend: "memory",
    async load(roomId) {
      return store.get(roomId) ?? null;
    },
    async save(roomId, room) {
      store.set(roomId, room);
    },
  };
}

/**
 * Persistence factory for room state:
 * - REDIS_URL → Redis
 * - else → JSON file at SYNC_DATA_PATH or .sync-data/rooms.json
 */
export function createPersistence(): RoomPersistence {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) return createRedisPersistence(redisUrl);

  const dataPath =
    process.env.SYNC_DATA_PATH?.trim() ||
    join(process.cwd(), ".sync-data", "rooms.json");

  return createFilePersistence(dataPath);
}

/** L1 memory cache + L2 persistence (cold-start safe). */
export class RoomStore {
  private readonly cache = new Map<string, RoomRecord>();

  constructor(
    private readonly persistence: RoomPersistence,
    private readonly defaultState: unknown,
  ) {}

  get backend(): PersistenceBackend {
    return this.persistence.backend;
  }

  async getOrCreate(roomId: string, fallback?: unknown): Promise<RoomRecord> {
    const cached = this.cache.get(roomId);
    if (cached) return cached;

    const persisted = await this.persistence.load(roomId);
    if (persisted) {
      this.cache.set(roomId, persisted);
      return persisted;
    }

    const room: RoomRecord = {
      state: fallback ?? this.defaultState,
      version: 0,
    };
    this.cache.set(roomId, room);
    await this.persistence.save(roomId, room);
    return room;
  }

  async commit(roomId: string, room: RoomRecord): Promise<RoomRecord> {
    this.cache.set(roomId, room);
    await this.persistence.save(roomId, room);
    return room;
  }
}
