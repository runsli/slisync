/** Room / agent authentication payloads (token passed on wire). */

export type SyncClientRole = "human" | "agent";

export interface SyncRoomAuth {
  /** Room or agent API token (see server SYNC_* env). */
  token?: string;
}

export type SyncAuthErrorCode =
  | "auth_required"
  | "invalid_token"
  | "forbidden"
  | "policy_violation"
  | "incompatible_protocol";

export interface SyncErrorPayload {
  code: SyncAuthErrorCode;
  message: string;
  roomId?: string;
}
