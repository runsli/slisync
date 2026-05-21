export { encodeUpdate, decodeUpdate } from "./codec";
export {
  REMOTE_ORIGIN,
  readSharedMemoryState,
  initSharedMemoryDoc,
  updateMessage,
  adjustCounter,
  observeSharedMemory,
  onDocumentUpdate,
  applyRemoteUpdate,
  encodeDocumentSnapshot,
  type SharedMemoryState,
} from "./shared-memory-doc";
export { applySharedMemoryStateToDoc } from "./apply-shared-state";
export {
  captureStateVector,
  encodeIncrementalUpdate,
} from "./encode-incremental";
export { bumpRoomVersion, getRoomVersion, initRoomMeta } from "./room-meta";
