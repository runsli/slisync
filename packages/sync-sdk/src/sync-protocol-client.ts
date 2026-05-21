import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from "@slisync/sync-schema";

export { SYNC_PROTOCOL_VERSION };

/** Default protocol version clients should send on join / HTTP. */
export function defaultProtocolVersion(): number {
  return SYNC_PROTOCOL_VERSION;
}

export function withSyncProtocolHeaders(
  headers: Record<string, string> = {},
): Record<string, string> {
  return {
    ...headers,
    [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION),
  };
}
