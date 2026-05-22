import type { IncomingMessage, ServerResponse } from "node:http";

export function extractBearerToken(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  const header = req.headers["x-sync-agent-key"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  return undefined;
}

export function jsonResponse(
  res: ServerResponse,
  status: number,
  body: unknown,
) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function writeCorsPreflight(
  res: ServerResponse,
  methods: string,
) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Sync-Agent-Key, Idempotency-Key, X-Sync-Protocol-Version, Accept",
  });
  res.end();
}
