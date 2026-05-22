/** Query filters for GET /rooms/:roomId/export/chunks (aligned with SDK ExportChunksOptions). */
export type ExportChunksQuery = {
  /** Only export chunks in this workspace. */
  workspaceId?: string;
  /** Only export chunks in this session. */
  sessionId?: string;
  /** Skip chunks below this importance (inclusive threshold). */
  minImportance?: number;
  /** Include soft-deleted nodes. Default false when omitted. */
  includeDeleted?: boolean;
};

/** One exported Markdown file in an HTTP response (path + body; ids live in front matter). */
export type ExportChunksHttpFile = {
  /** Relative path under output root, e.g. `ws-demo/sess-demo/user-asked-about-crdt-sync.md`. */
  relativePath: string;
  /** Full Markdown file (YAML front matter + body). */
  markdown: string;
};

/** Successful HTTP export payload. */
export type ExportChunksHttpSuccess = {
  ok: true;
  roomId: string;
  /** ISO-8601 timestamp when the export was computed on the server. */
  exportedAt: string;
  count: number;
  files: ExportChunksHttpFile[];
};

/** Failed HTTP export payload. */
export type ExportChunksHttpError = {
  ok: false;
  error: string;
};

/** JSON body for GET /rooms/:roomId/export/chunks. */
export type ExportChunksHttpResponse =
  | ExportChunksHttpSuccess
  | ExportChunksHttpError;
