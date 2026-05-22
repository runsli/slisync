-- Optional manual migration (also applied via CREATE TABLE IF NOT EXISTS on first connect).
CREATE TABLE IF NOT EXISTS sync_crdt_rooms (
  room_id TEXT PRIMARY KEY,
  update_bytea BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
