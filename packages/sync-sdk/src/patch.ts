import * as jsonPatch from "fast-json-patch";
import type { Operation, PatchResult } from "fast-json-patch";

export type { Operation };

/** Build RFC 6902 patch from two plain-object snapshots. */
export function diffState<T>(previous: T, next: T): Operation[] {
  return jsonPatch.compare(
    structuredClone(previous) as object,
    structuredClone(next) as object,
  );
}

/** Apply patch to a clone of state; throws if patch is invalid. */
export function applyStatePatch<T>(state: T, patch: Operation[]): T {
  const document = structuredClone(state) as object;
  const result: PatchResult<unknown> = jsonPatch.applyPatch(
    document,
    patch,
    true,
    false,
  );
  return result.newDocument as T;
}

/** Returns true when patch can be applied without error. */
export function tryApplyStatePatch<T>(state: T, patch: Operation[]): T | null {
  try {
    return applyStatePatch(state, patch);
  } catch {
    return null;
  }
}
