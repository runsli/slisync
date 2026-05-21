/**
 * Copy example-room from local .sync-data into fixtures/crdt-rooms.example.json.
 * Run after graph:seed when demo graph structure changes.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const roomId = process.env.SYNC_ROOM?.trim() || "example-room";
const src = join(cwd, ".sync-data", "crdt-rooms.json");
const dest = join(cwd, "fixtures", "crdt-rooms.example.json");

const db = JSON.parse(readFileSync(src, "utf8"));
const encoded = db[roomId];
if (!encoded) {
  console.error(`[fixtures:refresh] room "${roomId}" not found in ${src}`);
  console.error("[fixtures:refresh] hint: npm run dev && npm run graph:seed");
  process.exit(1);
}

mkdirSync(join(cwd, "fixtures"), { recursive: true });
writeFileSync(dest, `${JSON.stringify({ [roomId]: encoded }, null, 2)}\n`, "utf8");
console.log(`[fixtures:refresh] wrote ${dest} (room=${roomId}, ${(encoded.length / 1024).toFixed(1)}KB)`);
