/**
 * Export memory_chunk nodes from a live sync server via HTTP GET /export/chunks.
 *
 * Usage:
 *   npm run dev              # terminal 1
 *   npm run graph:seed       # terminal 2
 *   npm run export:chunks:http -- --room example-room --out ./markdown/chunks
 *
 * See docs/en/export-http.md (SDK + three-path comparison with export:chunks).
 *
 * Env:
 *   SYNC_EXPORT_HTTP_URL | SYNC_HTTP_URL | SYNC_URL — server base (default http://127.0.0.1:3000)
 *   SYNC_ROOM, SYNC_EXPORT_WORKSPACE, SYNC_EXPORT_SESSION, SYNC_EXPORT_MIN_IMPORTANCE
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fetchExportChunksHttp } from "@slisync/sync-sdk/graph";

function resolveHttpBase(): string {
  return (
    process.env.SYNC_EXPORT_HTTP_URL?.trim() ||
    process.env.SYNC_HTTP_URL?.trim() ||
    process.env.SYNC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SYNC_URL?.trim() ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

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
  return { room, outDir: resolve(out), baseUrl: resolveHttpBase() };
}

async function main() {
  const { room, outDir, baseUrl } = parseArgs(process.argv.slice(2));

  const minRaw = process.env.SYNC_EXPORT_MIN_IMPORTANCE?.trim();
  const minImportance = minRaw ? Number(minRaw) : undefined;

  const result = await fetchExportChunksHttp({
    baseUrl,
    roomId: room,
    workspaceId: process.env.SYNC_EXPORT_WORKSPACE?.trim() || undefined,
    sessionId: process.env.SYNC_EXPORT_SESSION?.trim() || undefined,
    minImportance:
      minImportance !== undefined && !Number.isNaN(minImportance)
        ? minImportance
        : undefined,
  });

  if (!result.ok) {
    console.error(
      `[export:chunks:http] failed (${result.status ?? "?"}):`,
      result.error,
    );
    console.error(
      "[export:chunks:http] hint: npm run dev && npm run graph:seed, or set SYNC_EXPORT_HTTP_URL",
    );
    process.exit(1);
  }

  if (result.count === 0) {
    console.error(
      `[export:chunks:http] no memory_chunk in room=${room} (server=${baseUrl}).`,
    );
    console.error("[export:chunks:http] hint: npm run dev && npm run graph:seed");
    process.exit(1);
  }

  for (const file of result.files) {
    const full = join(outDir, file.relativePath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, file.markdown, "utf8");
  }

  console.log(
    `[export:chunks:http] wrote ${result.count} file(s) → ${outDir} (room=${room}, server=${baseUrl})`,
  );
  for (const f of result.files) {
    console.log(`  ${f.relativePath}`);
  }
}

main().catch((err) => {
  console.error("[export:chunks:http] error:", err);
  process.exit(1);
});
