import { io } from "socket.io-client";
import { getAgentSyncToken } from "../get-sync-auth";
import { defaultProtocolVersion } from "../sync-protocol-client";
import { getSyncEndpoint } from "../get-sync-endpoint";
import { SYNC_EVENTS } from "../protocol";
import type { AgentPushAck, AgentPushPayload } from "./types";

const PUSH_TIMEOUT_MS = 8000;

export type PushAgentMemoryOptions = AgentPushPayload & {
  url?: string;
};

/** Headless one-shot agent write (Node or browser). */
export function pushAgentMemory(
  options: PushAgentMemoryOptions,
): Promise<AgentPushAck> {
  const { url, roomId, agentId, action, memory, graphOps, token } = options;
  const authToken = token ?? getAgentSyncToken();
  const endpoint = getSyncEndpoint(url);

  return new Promise((resolve) => {
    const socket = io(endpoint, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
      timeout: PUSH_TIMEOUT_MS,
    });

    const finish = (result: AgentPushAck) => {
      socket.removeAllListeners();
      socket.disconnect();
      resolve(result);
    };

    socket.on("connect_error", (err) => {
      finish({ ok: false, error: err.message });
    });

    socket.on("connect", () => {
      socket
        .timeout(PUSH_TIMEOUT_MS)
        .emit(
          SYNC_EVENTS.AGENT_PUSH,
          {
            roomId,
            agentId,
            action,
            memory,
            graphOps,
            token: authToken,
            protocolVersion: defaultProtocolVersion(),
          } satisfies AgentPushPayload,
          (err: Error | null, ack: AgentPushAck) => {
            if (err) {
              finish({ ok: false, error: err.message });
              return;
            }
            finish(ack ?? { ok: false, error: "empty ack" });
          },
        );
    });
  });
}
