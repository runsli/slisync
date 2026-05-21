import { createIndexedDBRoomStore } from "./indexeddb-room-store";
import {
  createNoopLocalRoomStore,
  isIndexedDBAvailable,
  type LocalRoomStore,
} from "./local-room-store";

/** Resolve `localPersistence` option to a store or null (memory-only). */
export function resolveLocalRoomStore(
  option?: boolean | LocalRoomStore,
): LocalRoomStore | null {
  if (option === false) return null;
  if (option && typeof option === "object") return option;
  if (typeof window === "undefined") return null;
  if (isIndexedDBAvailable()) return createIndexedDBRoomStore();
  return createNoopLocalRoomStore();
}
