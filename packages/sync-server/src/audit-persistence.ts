import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AuditEntry } from "@slisync/sync-schema";

export interface AuditPersistence {
  readonly backend: "file" | "memory";
  append(entry: AuditEntry): Promise<void>;
  list(roomId: string, limit: number): Promise<AuditEntry[]>;
}

const DEFAULT_PATH = join(process.cwd(), ".sync-data", "audit.jsonl");
const MAX_LIMIT = 200;

export function createFileAuditPersistence(
  filePath = process.env.SYNC_AUDIT_PATH?.trim() || DEFAULT_PATH,
): AuditPersistence {
  return {
    backend: "file",
    async append(entry) {
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
    },
    async list(roomId, limit) {
      const cap = Math.min(Math.max(limit, 1), MAX_LIMIT);
      try {
        const raw = await readFile(filePath, "utf8");
        const lines = raw.trim().split("\n").filter(Boolean);
        const entries: AuditEntry[] = [];
        for (let i = lines.length - 1; i >= 0 && entries.length < cap; i--) {
          try {
            const row = JSON.parse(lines[i]!) as AuditEntry;
            if (row.roomId === roomId) entries.push(row);
          } catch {
            /* skip corrupt line */
          }
        }
        return entries.reverse();
      } catch {
        return [];
      }
    },
  };
}

export function createMemoryAuditPersistence(): AuditPersistence {
  const rows: AuditEntry[] = [];
  return {
    backend: "memory",
    async append(entry) {
      rows.push(entry);
    },
    async list(roomId, limit) {
      const cap = Math.min(Math.max(limit, 1), MAX_LIMIT);
      return rows.filter((r) => r.roomId === roomId).slice(-cap);
    },
  };
}

export function createAuditPersistence(): AuditPersistence {
  if (process.env.SYNC_AUDIT_MEMORY === "1") {
    return createMemoryAuditPersistence();
  }
  return createFileAuditPersistence();
}

export function newAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
