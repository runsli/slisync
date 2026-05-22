import pg from "pg";
import { decodeUpdate, encodeUpdate } from "@slisync/sync-sdk/crdt";
import type { CrdtPersistence } from "./crdt-persistence";

const { Pool } = pg;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sync_crdt_rooms (
  room_id TEXT PRIMARY KEY,
  update_bytea BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/** Persist Yjs room snapshots in PostgreSQL (one row per room). */
export function createCrdtPostgresPersistence(
  connectionString: string,
): CrdtPersistence {
  const pool = new Pool({ connectionString });

  let schemaReady: Promise<void> | null = null;

  const ensureSchema = async () => {
    if (!schemaReady) {
      schemaReady = pool.query(CREATE_TABLE_SQL).then(() => undefined);
    }
    await schemaReady;
  };

  return {
    backend: "postgres",
    async load(roomId) {
      await ensureSchema();
      const result = await pool.query<{ update_bytea: Buffer }>(
        `SELECT update_bytea FROM sync_crdt_rooms WHERE room_id = $1`,
        [roomId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return decodeUpdate(row.update_bytea.toString("utf8"));
    },
    async save(roomId, update) {
      await ensureSchema();
      const encoded = encodeUpdate(update);
      await pool.query(
        `INSERT INTO sync_crdt_rooms (room_id, update_bytea, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (room_id)
         DO UPDATE SET update_bytea = EXCLUDED.update_bytea, updated_at = NOW()`,
        [roomId, Buffer.from(encoded, "utf8")],
      );
    },
  };
}
