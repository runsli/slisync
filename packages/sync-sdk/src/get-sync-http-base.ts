/**
 * HTTP base URL for sync server REST APIs (no Socket.IO path).
 */
export function getSyncHttpBase(override?: string): string {
  if (override?.trim()) return override.trim().replace(/\/$/, "");

  if (typeof process !== "undefined") {
    const fromEnv =
      process.env.SYNC_HTTP_URL?.trim() ||
      process.env.SYNC_URL?.trim() ||
      process.env.NEXT_PUBLIC_SYNC_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3001";
}
