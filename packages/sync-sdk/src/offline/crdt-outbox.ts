/** Queue CRDT updates while offline or before first sync. */

export class CrdtUpdateOutbox {
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
}
