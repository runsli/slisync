import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const targets = [
  join(root, ".sync-data", "crdt-rooms.json"),
  join(root, ".sync-data", "rooms.json"),
];

for (const path of targets) {
  try {
    await rm(path, { force: true });
    console.log(`[infra] removed ${path}`);
  } catch (err) {
    console.warn(`[infra] could not remove ${path}:`, err);
  }
}

console.log("[infra] Sync data cleared. Restart: npm run dev");
