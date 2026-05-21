/** Wire protocol version (independent of graph SCHEMA_VERSION). */

export const SYNC_PROTOCOL_HEADER = "X-Sync-Protocol-Version";

/** Current server/SDK protocol generation. Bump on breaking wire changes. */
export const SYNC_PROTOCOL_VERSION = 1;

/** Oldest client protocol this server accepts. */
export const SYNC_PROTOCOL_MIN_VERSION = 1;

/** Newest client protocol this server accepts. */
export const SYNC_PROTOCOL_MAX_VERSION = 1;

export type ProtocolErrorCode = "incompatible_protocol";

export type ProtocolNegotiationResult =
  | { ok: true; version: number }
  | {
      ok: false;
      code: ProtocolErrorCode;
      message: string;
      clientVersion?: number;
      serverVersion: number;
      minVersion: number;
      maxVersion: number;
    };

export function parseProtocolVersion(
  value: unknown,
): number | undefined {
  if (value == null || value === "") return undefined;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

/**
 * Negotiate client protocol. Missing version is treated as v1 (legacy clients).
 */
export function negotiateProtocolVersion(
  clientVersion?: number,
): ProtocolNegotiationResult {
  const resolved = clientVersion ?? SYNC_PROTOCOL_MIN_VERSION;

  if (resolved < SYNC_PROTOCOL_MIN_VERSION) {
    return {
      ok: false,
      code: "incompatible_protocol",
      message: `protocol version ${resolved} is too old (min ${SYNC_PROTOCOL_MIN_VERSION})`,
      clientVersion: resolved,
      serverVersion: SYNC_PROTOCOL_VERSION,
      minVersion: SYNC_PROTOCOL_MIN_VERSION,
      maxVersion: SYNC_PROTOCOL_MAX_VERSION,
    };
  }

  if (resolved > SYNC_PROTOCOL_MAX_VERSION) {
    return {
      ok: false,
      code: "incompatible_protocol",
      message: `protocol version ${resolved} is too new (max ${SYNC_PROTOCOL_MAX_VERSION})`,
      clientVersion: resolved,
      serverVersion: SYNC_PROTOCOL_VERSION,
      minVersion: SYNC_PROTOCOL_MIN_VERSION,
      maxVersion: SYNC_PROTOCOL_MAX_VERSION,
    };
  }

  return { ok: true, version: resolved };
}
