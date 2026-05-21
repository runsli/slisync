const AUTH_KEYS = [
  "SYNC_API_KEY",
  "SYNC_AGENT_API_KEY",
  "SYNC_AUTH_REQUIRED",
  "SYNC_ROOM_KEYS",
  "SYNC_AGENT_DENY_MEMORY",
  "SYNC_AGENT_GRAPH_RELATIONS",
  "SYNC_AUDIT_MEMORY",
] as const;

type AuthKey = (typeof AUTH_KEYS)[number];

export type AuthEnv = {
  required?: boolean;
  apiKey?: string;
  agentApiKey?: string;
  roomKeys?: Record<string, string>;
};

function snapshotAuthEnv(): Partial<Record<AuthKey, string | undefined>> {
  const snap: Partial<Record<AuthKey, string | undefined>> = {};
  for (const key of AUTH_KEYS) {
    snap[key] = process.env[key];
  }
  return snap;
}

function applyAuthEnv(auth?: AuthEnv) {
  for (const key of AUTH_KEYS) {
    delete process.env[key];
  }
  if (!auth) return;

  if (auth.required) {
    process.env.SYNC_AUTH_REQUIRED = "1";
  }
  if (auth.apiKey) {
    process.env.SYNC_API_KEY = auth.apiKey;
  }
  if (auth.agentApiKey) {
    process.env.SYNC_AGENT_API_KEY = auth.agentApiKey;
  }
  if (auth.roomKeys) {
    process.env.SYNC_ROOM_KEYS = JSON.stringify(auth.roomKeys);
  }
}

function restoreAuthEnv(prev: Partial<Record<AuthKey, string | undefined>>) {
  for (const key of AUTH_KEYS) {
    const value = prev[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

export async function withAuthEnv<T>(
  auth: AuthEnv | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = snapshotAuthEnv();
  applyAuthEnv(auth);
  try {
    return await fn();
  } finally {
    restoreAuthEnv(prev);
  }
}
