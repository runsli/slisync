import * as Y from "yjs";
import {
  applyRemoteUpdate,
  encodeDocumentSnapshot,
  initSharedMemoryDoc,
  initRoomMeta,
  REMOTE_ORIGIN,
  type SharedMemoryState,
} from "@slisync/sync-sdk/crdt";
import { ensureMemoryGraphDoc } from "@slisync/sync-sdk/graph";
import { createCrdtPersistence, type CrdtPersistence } from "./crdt-persistence";

export class CrdtRoomStore {
  private readonly docs = new Map<string, Y.Doc>();

  constructor(
    private readonly persistence: CrdtPersistence,
    private readonly defaultState: SharedMemoryState,
  ) {}

  get backend() {
    return this.persistence.backend;
  }

  async getOrCreate(roomId: string): Promise<Y.Doc> {
    const cached = this.docs.get(roomId);
    if (cached) return cached;

    const doc = new Y.Doc();
    const snapshot = await this.persistence.load(roomId);

    if (snapshot) {
      Y.applyUpdate(doc, snapshot, REMOTE_ORIGIN);
    } else {
      initSharedMemoryDoc(doc, this.defaultState);
      initRoomMeta(doc, 0);
      ensureMemoryGraphDoc(doc, roomId);
      await this.persistence.save(roomId, encodeDocumentSnapshot(doc));
    }

    ensureMemoryGraphDoc(doc, roomId);
    initRoomMeta(doc);

    this.docs.set(roomId, doc);
    return doc;
  }

  async applyUpdate(roomId: string, update: Uint8Array) {
    const doc = await this.getOrCreate(roomId);
    applyRemoteUpdate(doc, update);
    await this.persistence.save(roomId, encodeDocumentSnapshot(doc));
  }

  snapshot(doc: Y.Doc) {
    return encodeDocumentSnapshot(doc);
  }

  async saveDoc(roomId: string) {
    const doc = await this.getOrCreate(roomId);
    await this.persistence.save(roomId, encodeDocumentSnapshot(doc));
  }
}

export function createCrdtRoomStore(defaultState: SharedMemoryState) {
  return new CrdtRoomStore(createCrdtPersistence(), defaultState);
}
