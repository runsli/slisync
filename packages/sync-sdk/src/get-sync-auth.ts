/**
 * Client / script tokens for sync server auth.
 * Browser: NEXT_PUBLIC_SYNC_API_KEY / NEXT_PUBLIC_SYNC_AGENT_API_KEY
 * Node: SYNC_API_KEY / SYNC_AGENT_API_KEY
 */

export function getRoomSyncToken(roomId?: string): string | undefined {
  if (typeof process !== "undefined" && roomId) {
    const mapRaw = process.env.SYNC_ROOM_KEYS?.trim();
    if (mapRaw) {
      try {
        const map = JSON.parse(mapRaw) as Record<string, string>;
        if (map[roomId]) return map[roomId];
      } catch {
        /* ignore */
      }
    }
  }

  if (typeof process !== "undefined") {
    const node = process.env.SYNC_API_KEY?.trim();
    if (node) return node;
    const pub = process.env.NEXT_PUBLIC_SYNC_API_KEY?.trim();
    if (pub) return pub;
  }

  return undefined;
}

export function getAgentSyncToken(): string | undefined {
  if (typeof process !== "undefined") {
    const agent = process.env.SYNC_AGENT_API_KEY?.trim();
    if (agent) return agent;
    const pubAgent = process.env.NEXT_PUBLIC_SYNC_AGENT_API_KEY?.trim();
    if (pubAgent) return pubAgent;
    return getRoomSyncToken();
  }
  return undefined;
}
