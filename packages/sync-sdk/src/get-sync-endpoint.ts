/**
 * Socket.IO endpoint for the browser.
 * Use NEXT_PUBLIC_SYNC_URL when the page origin is not the sync host (rare).
 */
export function getSyncEndpoint(override?: string): string {
  if (override) return override;

  if (typeof window !== "undefined") {
    const fromEnv = process.env.NEXT_PUBLIC_SYNC_URL?.trim();
    if (fromEnv) return fromEnv;
    return window.location.origin;
  }

  return "";
}
