"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_AGENT_GRAPH_POLICY,
  summarizeAgentGraphPolicy,
  type AgentGraphPolicySummary,
} from "@slisync/sync-schema";
import {
  fetchSyncCapabilities,
  SYNC_STRATEGY_DETAILS,
  type SyncStrategy,
} from "@slisync/sync-sdk";

type Props = {
  strategy: SyncStrategy;
  syncEndpoint: string;
  protocolVersion?: number;
  syncReady: boolean;
  outboxSize: number;
  presenceCount: number;
};

export function SyncStrategyPanel({
  strategy,
  syncEndpoint,
  protocolVersion = 1,
  syncReady,
  outboxSize,
  presenceCount,
}: Props) {
  const [policy, setPolicy] = useState<AgentGraphPolicySummary | null>(null);
  const [policySource, setPolicySource] = useState<"server" | "default">(
    "default",
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const base =
        syncEndpoint ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const res = await fetchSyncCapabilities(base || undefined);
      if (cancelled) return;
      if (res.ok) {
        setPolicy(res.data.agentGraphPolicy);
        setPolicySource("server");
      } else {
        setPolicy(summarizeAgentGraphPolicy(DEFAULT_AGENT_GRAPH_POLICY));
        setPolicySource("default");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncEndpoint]);

  const p = policy ?? summarizeAgentGraphPolicy(DEFAULT_AGENT_GRAPH_POLICY);

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        同步策略 · Agent 策略
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
              <th className="py-1.5 pr-2 font-medium">维度</th>
              <th className="py-1.5 pr-2 font-medium">CRDT</th>
              <th className="py-1.5 font-medium">LWW</th>
            </tr>
          </thead>
          <tbody>
            {SYNC_STRATEGY_DETAILS.map((row) => (
              <tr
                key={row.label}
                className="border-b border-zinc-100 dark:border-zinc-800/80"
              >
                <td className="py-1.5 pr-2 text-zinc-600 dark:text-zinc-400">
                  {row.label}
                </td>
                <td
                  className={`py-1.5 pr-2 ${
                    strategy === "crdt"
                      ? "font-medium text-violet-700 dark:text-violet-300"
                      : "text-zinc-500"
                  }`}
                >
                  {row.crdt}
                </td>
                <td
                  className={`py-1.5 ${
                    strategy === "lww"
                      ? "font-medium text-amber-700 dark:text-amber-300"
                      : "text-zinc-500"
                  }`}
                >
                  {row.lww}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <dt>protocol</dt>
        <dd>v{protocolVersion}</dd>
        <dt>syncReady</dt>
        <dd>{strategy === "crdt" ? (syncReady ? "yes" : "no") : "n/a"}</dd>
        <dt>presence</dt>
        <dd>{presenceCount}</dd>
        <dt>outbox</dt>
        <dd>{outboxSize}</dd>
      </dl>

      <details className="text-xs">
        <summary className="cursor-pointer text-zinc-500">
          Agent graph policy ({policySource})
        </summary>
        <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
          <li>
            <span className="text-zinc-500">ops</span>{" "}
            {p.allowedOps.join(", ")}
          </li>
          <li>
            <span className="text-zinc-500">kinds</span>{" "}
            {p.allowedNodeKinds.join(", ")}
          </li>
          <li>
            <span className="text-zinc-500">relations</span>{" "}
            {p.allowedRelations.join(", ")}
          </li>
          <li>
            maxOpsPerPush={p.maxOpsPerPush} · denyMemoryPatch=
            {p.denyMemoryPatch ? "1" : "0"}
          </li>
          {p.deniedOps.length > 0 ? (
            <li className="text-amber-700 dark:text-amber-400">
              denied ops: {p.deniedOps.join(", ")}
            </li>
          ) : null}
        </ul>
        <p className="mt-2 text-[10px] text-zinc-400">
          服务端可通过 SYNC_AGENT_GRAPH_* 覆盖；见 .env.example
        </p>
      </details>
    </section>
  );
}
