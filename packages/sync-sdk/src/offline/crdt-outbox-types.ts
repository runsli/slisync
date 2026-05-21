/** CRDT update outbox contract (in-memory or persisted). */

export interface CrdtOutbox {
  readonly size: number;
  enqueue(encodedUpdate: string): void | Promise<void>;
  peekAll(): readonly string[];
  drain(): string[] | Promise<string[]>;
  clear(): void | Promise<void>;
  /** Restore queued updates after loading a persisted room record. */
  hydrate?(items: readonly string[]): void | Promise<void>;
}
