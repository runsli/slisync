import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJsonFile<T extends object>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;

    if (err instanceof SyntaxError) {
      const backup = `${filePath}.corrupt-${Date.now()}.bak`;
      console.error(
        `[sync] Corrupt JSON in ${filePath} (${err.message}). Backing up to ${backup}`,
      );
      try {
        await rename(filePath, backup);
      } catch {
        // ignore if backup fails
      }
      return fallback;
    }

    throw err;
  }
}

/** Atomic write: temp file + rename avoids torn/corrupt JSON under concurrent saves. */
export async function writeJsonFile<T extends object>(
  filePath: string,
  data: T,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  const body = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, filePath);
}
