import { createIndexedDBRoomStore } from "./indexeddb-room-store";
import {
  createNoopLocalRoomStore,
  isIndexedDBAvailable,
  type LocalRoomStore,
} from "./local-room-store";

/** Remove persisted local state for a room (IndexedDB or in-memory noop). */
export async function clearLocalRoom(
  roomId: string,
  store?: LocalRoomStore,
): Promise<void> {
  const resolved =
    store ??
    (isIndexedDBAvailable()
      ? createIndexedDBRoomStore()
      : createNoopLocalRoomStore());
  await resolved.delete(roomId);
}
