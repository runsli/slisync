import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Default CRDT JSON path for export:chunks.
 * - Explicit SYNC_CRDT_DATA_PATH wins.
 * - In CI (or when local .sync-data is missing): fixtures/crdt-rooms.example.json.
 * - Otherwise: .sync-data/crdt-rooms.json from a running dev/seed.
 */
export function resolveCrdtDataPath(cwd = process.cwd()) {
  const fromEnv = process.env.SYNC_CRDT_DATA_PATH?.trim();
  if (fromEnv) {
    return resolve(cwd, fromEnv);
  }

  const local = join(cwd, ".sync-data", "crdt-rooms.json");
  const fixture = join(cwd, "fixtures", "crdt-rooms.example.json");

  const inCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
  if (inCi && existsSync(fixture)) {
    return fixture;
  }

  if (existsSync(local)) {
    return local;
  }

  return fixture;
}
