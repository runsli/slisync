import type { AgentGraphPolicySummary } from "@slisync/sync-schema";
import { getSyncHttpBase } from "./get-sync-http-base";

export type SyncCapabilities = {
  protocolVersion: number;
  crdtAuthority: boolean;
  features: Record<string, boolean>;
  agentGraphPolicy: AgentGraphPolicySummary;
};

export type FetchSyncCapabilitiesResult =
  | { ok: true; data: SyncCapabilities }
  | { ok: false; error: string };

/** GET /v1/sync/capabilities — server policy and feature flags. */
export async function fetchSyncCapabilities(
  baseUrl?: string,
): Promise<FetchSyncCapabilitiesResult> {
  const root = getSyncHttpBase(baseUrl);
  const url = `${root}/v1/sync/capabilities`;

  try {
    const res = await fetch(url, { method: "GET" });
    const body = (await res.json()) as {
      ok?: boolean;
      error?: string;
      protocolVersion?: number;
      crdtAuthority?: boolean;
      features?: Record<string, boolean>;
      agentGraphPolicy?: AgentGraphPolicySummary;
    };
    if (!body.ok || !body.agentGraphPolicy) {
      return {
        ok: false,
        error: body.error ?? `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      data: {
        protocolVersion: body.protocolVersion ?? 1,
        crdtAuthority: body.crdtAuthority ?? true,
        features: body.features ?? {},
        agentGraphPolicy: body.agentGraphPolicy,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}
