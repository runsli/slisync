import type { ConflictReason } from "@slisync/sync-sdk/protocol";

/** Optimistic concurrency: client baseVersion must match authoritative room version. */
export function isStaleWrite(
  baseVersion: number | undefined,
  roomVersion: number,
): boolean {
  if (baseVersion === undefined) return true;
  return baseVersion !== roomVersion;
}

export function conflictReasonForPatch(
  baseVersion: number | undefined,
  roomVersion: number,
  patchValid: boolean,
): ConflictReason | null {
  if (isStaleWrite(baseVersion, roomVersion)) return "stale_version";
  if (!patchValid) return "invalid_patch";
  return null;
}
