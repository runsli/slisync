import * as Y from "yjs";
import {
  parseMemoryChunkData,
  type MemoryGraphSnapshot,
  type MemoryNode,
} from "@slisync/sync-schema";
import { decodeUpdate } from "../crdt/codec";
import { readMemoryGraphSnapshot } from "./graph-doc";

export type ExportChunksOptions = {
  /** Written into front matter (e.g. `example-room`). */
  roomId?: string;
  /** Only export chunks in this workspace. */
  workspaceId?: string;
  /** Only export chunks in this session. */
  sessionId?: string;
  /** Skip chunks below this importance (inclusive threshold). */
  minImportance?: number;
  /** Include soft-deleted nodes. Default false. */
  includeDeleted?: boolean;
};

export type ExportedChunkFile = {
  /** Relative path under output dir, e.g. `ws-demo/sess-demo/user-asked-about-crdt-sync.md`. */
  relativePath: string;
  workspaceId: string;
  sessionId: string;
  nodeId: string;
  /** Full Markdown file (YAML front matter + body). */
  markdown: string;
};

const UNSCOPED_SESSION = "_unsessioned";

/** Build a filesystem-safe slug from chunk title, falling back to node id. */
export function slugifyChunkFilename(title: string, nodeId: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (base.length >= 3) return base;
  const idPart = nodeId.replace(/[^a-z0-9-]/gi, "").slice(0, 16);
  return idPart.length > 0 ? idPart : "chunk";
}

function yamlScalar(value: string | number): string {
  if (typeof value === "number") return String(value);
  if (/^[\w.-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function yamlStringList(values: string[]): string {
  if (values.length === 0) return "[]";
  return `[${values.map((v) => yamlScalar(v)).join(", ")}]`;
}

function chunkRelativePath(
  workspaceId: string,
  sessionId: string,
  slug: string,
): string {
  const safeWs = sanitizePathSegment(workspaceId);
  const safeSess = sanitizePathSegment(sessionId);
  return `${safeWs}/${safeSess}/${slug}.md`;
}

function sanitizePathSegment(segment: string): string {
  const cleaned = segment
    .replace(/[/\\]/g, "-")
    .replace(/\.\./g, "-")
    .trim();
  return cleaned.length > 0 ? cleaned : "_";
}

function formatChunkMarkdown(
  node: MemoryNode,
  chunk: ReturnType<typeof parseMemoryChunkData> & object,
  options: ExportChunksOptions,
): string {
  const sessionId = chunk.scope.sessionId ?? UNSCOPED_SESSION;
  const lines: string[] = ["---"];
  lines.push(`title: ${yamlScalar(node.title)}`);
  lines.push(`date: ${yamlScalar(node.updatedAt)}`);
  lines.push(`workspaceId: ${yamlScalar(chunk.scope.workspaceId)}`);
  lines.push(`sessionId: ${yamlScalar(sessionId)}`);
  lines.push(`nodeId: ${yamlScalar(node.id)}`);
  lines.push(`kind: memory_chunk`);
  if (options.roomId) {
    lines.push(`roomId: ${yamlScalar(options.roomId)}`);
  }
  if (chunk.source) {
    lines.push(`source: ${yamlScalar(chunk.source)}`);
  }
  if (chunk.importance !== undefined) {
    lines.push(`importance: ${chunk.importance}`);
  }
  if (node.tags.length > 0) {
    lines.push(`tags: ${yamlStringList(node.tags)}`);
  }
  lines.push("---", "", chunk.content.trimEnd(), "");
  return lines.join("\n");
}

function chunkPassesFilters(
  node: MemoryNode,
  chunk: NonNullable<ReturnType<typeof parseMemoryChunkData>>,
  options: ExportChunksOptions,
): boolean {
  if (node.deletedAt && !options.includeDeleted) return false;
  if (
    options.workspaceId &&
    chunk.scope.workspaceId !== options.workspaceId
  ) {
    return false;
  }
  if (options.sessionId) {
    const sid = chunk.scope.sessionId ?? UNSCOPED_SESSION;
    if (sid !== options.sessionId) return false;
  }
  if (options.minImportance !== undefined) {
    const imp = chunk.importance ?? 0;
    if (imp < options.minImportance) return false;
  }
  return true;
}

/** Export `memory_chunk` nodes from a graph snapshot as Markdown files (in memory). */
export function exportMemoryChunksFromSnapshot(
  snapshot: MemoryGraphSnapshot,
  options: ExportChunksOptions = {},
): ExportedChunkFile[] {
  const files: ExportedChunkFile[] = [];
  const usedSlugs = new Map<string, Set<string>>();

  for (const node of snapshot.nodes) {
    if (node.kind !== "memory_chunk") continue;
    const chunk = parseMemoryChunkData(node);
    if (!chunk || !chunkPassesFilters(node, chunk, options)) continue;

    const sessionId = chunk.scope.sessionId ?? UNSCOPED_SESSION;
    const slugBase = slugifyChunkFilename(node.title, node.id);
    const pathKey = `${chunk.scope.workspaceId}/${sessionId}`;
    const slugs = usedSlugs.get(pathKey) ?? new Set<string>();
    let slug = slugBase;
    let n = 2;
    while (slugs.has(slug)) {
      slug = `${slugBase}-${n}`;
      n += 1;
    }
    slugs.add(slug);
    usedSlugs.set(pathKey, slugs);

    files.push({
      relativePath: chunkRelativePath(
        chunk.scope.workspaceId,
        sessionId,
        slug,
      ),
      workspaceId: chunk.scope.workspaceId,
      sessionId,
      nodeId: node.id,
      markdown: formatChunkMarkdown(node, chunk, options),
    });
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

/** Decode a Yjs update and read the memory graph snapshot (if present). */
export function memoryGraphSnapshotFromCrdtUpdate(
  update: Uint8Array,
): MemoryGraphSnapshot | null {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, update);
  return readMemoryGraphSnapshot(doc);
}

/** Export chunks from a base64 or raw Yjs room update. */
export function exportMemoryChunksFromCrdtUpdate(
  update: Uint8Array,
  options: ExportChunksOptions = {},
): ExportedChunkFile[] {
  const snapshot = memoryGraphSnapshotFromCrdtUpdate(update);
  if (!snapshot) return [];
  return exportMemoryChunksFromSnapshot(snapshot, options);
}

/** Load a room update from `crdt-rooms.json`-style persistence and export chunks. */
export async function exportMemoryChunksFromCrdtFile(
  filePath: string,
  roomId: string,
  options: ExportChunksOptions = {},
): Promise<ExportedChunkFile[]> {
  const { readFile } = await import("node:fs/promises");
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  let db: Record<string, string>;
  try {
    db = JSON.parse(raw) as Record<string, string>;
  } catch {
    return [];
  }
  const encoded = db[roomId];
  if (!encoded) return [];
  return exportMemoryChunksFromCrdtUpdate(decodeUpdate(encoded), {
    ...options,
    roomId: options.roomId ?? roomId,
  });
}
