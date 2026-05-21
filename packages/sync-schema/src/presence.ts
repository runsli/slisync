/** Room presence — who is connected / editing. */

export type PresenceStatus = "online" | "away";

export interface PresenceMember {
  clientId: string;
  actorId: string;
  status: PresenceStatus;
  joinedAt: number;
  lastSeen: number;
}

export interface PresenceStatePayload {
  roomId: string;
  members: PresenceMember[];
}

export interface PresenceJoinPayload {
  roomId: string;
  clientId: string;
  actorId: string;
  status?: PresenceStatus;
}

export interface PresenceUpdatePayload {
  roomId: string;
  clientId: string;
  status: PresenceStatus;
}
