/** In-memory FIFO queue of CRDT updates (offline or before first sync). */

import type { CrdtOutbox } from "./crdt-outbox-types";

export class InMemoryCrdtOutbox implements CrdtOutbox {
  private readonly queue: string[] = [];

  get size(): number {
    return this.queue.length;
  }

  enqueue(encodedUpdate: string) {
    if (!encodedUpdate) return;
    this.queue.push(encodedUpdate);
  }

  /** Drain queued updates in FIFO order (does not clear on read). */
  peekAll(): readonly string[] {
    return this.queue;
  }

  drain(): string[] {
    const items = [...this.queue];
    this.queue.length = 0;
    return items;
  }

  clear() {
    this.queue.length = 0;
  }

  /** Replace queue contents (e.g. after loading a persisted room record). */
  hydrate(items: readonly string[]) {
    this.queue.length = 0;
    for (const item of items) {
      if (item) this.queue.push(item);
    }
  }
}

/** Back-compat alias for InMemoryCrdtOutbox. */
export class CrdtUpdateOutbox extends InMemoryCrdtOutbox {}
