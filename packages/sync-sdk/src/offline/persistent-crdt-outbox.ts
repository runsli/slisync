/** CRDT outbox with debounced persistence of the `outbox` field on LocalRoomStore. */

import type { CrdtOutbox } from "./crdt-outbox-types";
import { InMemoryCrdtOutbox } from "./crdt-outbox";
import type { LocalRoomStore } from "./local-room-store";
import { createEmptyRoomLocalRecord, type RoomLocalRecord } from "./room-record";

const PERSIST_DEBOUNCE_MS = 200;

export type PersistentCrdtOutboxOptions = {
  roomId: string;
  store: LocalRoomStore;
  debounceMs?: number;
};

/** Wraps InMemoryCrdtOutbox and mirrors `outbox` to IndexedDB or a noop store. */
export class PersistentCrdtOutbox implements CrdtOutbox {
  private readonly inner = new InMemoryCrdtOutbox();
  private readonly roomId: string;
  private readonly store: LocalRoomStore;
  private readonly debounceMs: number;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(options: PersistentCrdtOutboxOptions) {
    this.roomId = options.roomId;
    this.store = options.store;
    this.debounceMs = options.debounceMs ?? PERSIST_DEBOUNCE_MS;
  }

  get size(): number {
    return this.inner.size;
  }

  enqueue(encodedUpdate: string) {
    this.inner.enqueue(encodedUpdate);
    this.schedulePersist();
  }

  peekAll(): readonly string[] {
    return this.inner.peekAll();
  }

  drain(): string[] {
    const items = this.inner.drain();
    void this.persistNow();
    return items;
  }

  clear() {
    this.inner.clear();
    void this.persistNow();
  }

  hydrate(items: readonly string[]) {
    this.inner.hydrate(items);
    void this.persistNow();
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistNow();
    }, this.debounceMs);
  }

  private persistNow(): Promise<void> {
    this.persistChain = this.persistChain.then(() => this.writeOutboxToStore());
    return this.persistChain;
  }

  private async writeOutboxToStore() {
    const existing = await this.store.get(this.roomId);
    const base: RoomLocalRecord = existing ?? createEmptyRoomLocalRecord(this.roomId);
    await this.store.put({
      ...base,
      outbox: [...this.inner.peekAll()],
    });
  }
}
