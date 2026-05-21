/** Factory for in-memory or persisted CRDT outboxes. */

import type { CrdtOutbox } from "./crdt-outbox-types";
import { InMemoryCrdtOutbox } from "./crdt-outbox";
import {
  createNoopLocalRoomStore,
  isIndexedDBAvailable,
  type LocalRoomStore,
} from "./local-room-store";
import { createIndexedDBRoomStore } from "./indexeddb-room-store";
import { PersistentCrdtOutbox } from "./persistent-crdt-outbox";

export type CreateCrdtOutboxOptions = {
  roomId: string;
  /** `false` = memory only; `true` = IDB when available else noop; or inject a store. */
  persistence?: boolean | LocalRoomStore;
};

/** Create an outbox for a room (memory-only or backed by LocalRoomStore). */
export function createCrdtOutbox(options: CreateCrdtOutboxOptions): CrdtOutbox {
  const { roomId, persistence = false } = options;

  if (persistence === false) {
    return new InMemoryCrdtOutbox();
  }

  const store =
    persistence === true
      ? isIndexedDBAvailable()
        ? createIndexedDBRoomStore()
        : createNoopLocalRoomStore()
      : persistence;

  return new PersistentCrdtOutbox({ roomId, store });
}
