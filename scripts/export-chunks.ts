/**
 * Export memory_chunk nodes from persisted CRDT room data to Markdown.
 *
 * Usage:
 *   npm run dev              # terminal 1 (optional, to seed)
 *   npm run graph:seed       # seed scoped memory into example-room
 *   npm run export:chunks -- --room example-room --out ./markdown/chunks
 *
 * Env:
 *   SYNC_CRDT_DATA_PATH  optional override
 *   default: .sync-data/crdt-rooms.json if present, else fixtures/crdt-rooms.example.json
 *   in CI (CI=1 / GITHUB_ACTIONS): fixtures/crdt-rooms.example.json when unset
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  exportMemoryChunksFromCrdtFile,
  type ExportedChunkFile,
} from "@slisync/sync-sdk/graph";
import { resolveCrdtDataPath } from "./resolve-crdt-data-path.mjs";

function parseArgs(argv: string[]) {
  let room = process.env.SYNC_ROOM?.trim() || "example-room";
  let out = "./markdown/chunks";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--room" && argv[i + 1]) {
      room = argv[++i]!;
    } else if (a === "--out" && argv[i + 1]) {
      out = argv[++i]!;
    } else if (a === "--workspace" && argv[i + 1]) {
      process.env.SYNC_EXPORT_WORKSPACE = argv[++i]!;
    } else if (a === "--session" && argv[i + 1]) {
      process.env.SYNC_EXPORT_SESSION = argv[++i]!;
    } else if (a === "--min-importance" && argv[i + 1]) {
      process.env.SYNC_EXPORT_MIN_IMPORTANCE = argv[++i]!;
    }
  }
  return { room, outDir: resolve(out) };
}

async function writeFiles(files: ExportedChunkFile[], outDir: string) {
  for (const file of files) {
    const full = join(outDir, file.relativePath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, file.markdown, "utf8");
  }
}

async function main() {
  const { room, outDir } = parseArgs(process.argv.slice(2));
  const dataPath = resolveCrdtDataPath();

  const minRaw = process.env.SYNC_EXPORT_MIN_IMPORTANCE?.trim();
  const minImportance = minRaw ? Number(minRaw) : undefined;

  const files = await exportMemoryChunksFromCrdtFile(dataPath, room, {
    roomId: room,
    workspaceId: process.env.SYNC_EXPORT_WORKSPACE?.trim() || undefined,
    sessionId: process.env.SYNC_EXPORT_SESSION?.trim() || undefined,
    minImportance:
      minImportance !== undefined && !Number.isNaN(minImportance)
        ? minImportance
        : undefined,
  });

  if (files.length === 0) {
    console.error(
      `[export:chunks] no memory_chunk in room=${room} (file=${dataPath}).`,
    );
    console.error(
      "[export:chunks] hint: npm run dev && npm run graph:seed (local), or use committed fixture:",
    );
    console.error(
      "  SYNC_CRDT_DATA_PATH=fixtures/crdt-rooms.example.json npm run export:chunks",
    );
    process.exit(1);
  }

  await writeFiles(files, outDir);
  console.log(
    `[export:chunks] wrote ${files.length} file(s) → ${outDir} (room=${room}, data=${dataPath})`,
  );
  for (const f of files) {
    console.log(`  ${f.relativePath}`);
  }
}

main().catch((err) => {
  console.error("[export:chunks] error:", err);
  process.exit(1);
});
