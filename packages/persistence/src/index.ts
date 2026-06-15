import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createRoomEvent,
  parseRoomEvent,
  type Participant,
  type RoomEvent,
} from "@agent-room/room-events";

export interface PersistenceOptions {
  databasePath?: string;
  artifactDir?: string;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  secretRef: string;
  tokenHash: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface ProviderConfigRecord {
  id: string;
  provider: string;
  mode: "mock" | "openai" | "litellm" | "local";
  secretRef?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface ContextItemRecord {
  contextId: string;
  roomId: string;
  kind: "snippet" | "file" | "url" | "note";
  name: string;
  preview?: string;
  bytes?: number;
  artifactPath?: string;
  createdAt: string;
}

export interface TranscriptExport {
  artifactPath: string;
  markdown: string;
}

export class SqliteStore {
  private readonly db: Database;
  readonly artifactDir: string;

  constructor(options: PersistenceOptions = {}) {
    const databasePath =
      options.databasePath ??
      process.env.AGENT_ROOM_DB_PATH ??
      "data/agent-room.sqlite";
    mkdirSync(dirname(databasePath), { recursive: true });
    this.artifactDir =
      options.artifactDir ??
      process.env.AGENT_ROOM_ARTIFACT_DIR ??
      join(dirname(databasePath), "artifacts");
    mkdirSync(this.artifactDir, { recursive: true });
    this.db = new Database(databasePath);
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  migrate(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_identity_id TEXT,
        state TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_event_at TEXT
      );

      CREATE TABLE IF NOT EXISTS participants (
        id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        display_name TEXT NOT NULL,
        route_names_json TEXT NOT NULL,
        state TEXT NOT NULL,
        color TEXT,
        voice_enabled INTEGER NOT NULL DEFAULT 0,
        last_seen_at TEXT,
        PRIMARY KEY (room_id, id)
      );

      CREATE TABLE IF NOT EXISTS room_events (
        id TEXT PRIMARY KEY,
        schema_version TEXT NOT NULL,
        room_id TEXT NOT NULL,
        thread_id TEXT,
        kind TEXT NOT NULL,
        from_participant_id TEXT NOT NULL,
        to_participant_ids_json TEXT NOT NULL,
        reply_to TEXT,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        inserted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_room_events_room_created
        ON room_events(room_id, created_at, inserted_at);
      CREATE INDEX IF NOT EXISTS idx_room_events_reply_to
        ON room_events(reply_to);

      CREATE TABLE IF NOT EXISTS messages (
        event_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        participant_id TEXT NOT NULL,
        source TEXT NOT NULL,
        text TEXT NOT NULL,
        is_final INTEGER NOT NULL,
        context_ids_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_dispatches (
        event_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL,
        reply_to TEXT,
        text TEXT,
        reason TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS receipts (
        event_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        verification TEXT NOT NULL,
        label TEXT NOT NULL,
        summary TEXT NOT NULL,
        artifact_id TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS context_items (
        context_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        preview TEXT,
        bytes INTEGER,
        artifact_path TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS voice_sessions (
        session_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        state TEXT NOT NULL,
        participant_id TEXT,
        started_at TEXT,
        ended_at TEXT,
        reason TEXT
      );

      CREATE TABLE IF NOT EXISTS handoffs (
        event_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        target TEXT NOT NULL,
        summary TEXT NOT NULL,
        action_items_json TEXT NOT NULL,
        blockers_json TEXT NOT NULL,
        artifact_path TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS identities (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        subject TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT
      );

      CREATE TABLE IF NOT EXISTS room_members (
        room_id TEXT NOT NULL,
        identity_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (room_id, identity_id)
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        secret_ref TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        scopes_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT
      );

      CREATE TABLE IF NOT EXISTS provider_configs (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        mode TEXT NOT NULL,
        secret_ref TEXT,
        base_url TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  appendEvent(event: RoomEvent): void {
    const parsed = parseRoomEvent(event);
    const transaction = this.db.transaction((roomEvent: RoomEvent) => {
      this.ensureRoom(roomEvent.roomId, `Room ${roomEvent.roomId}`);
      const insertResult = this.db
        .query(
          `INSERT OR IGNORE INTO room_events
          (id, schema_version, room_id, thread_id, kind, from_participant_id,
           to_participant_ids_json, reply_to, created_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          roomEvent.id,
          roomEvent.schemaVersion,
          roomEvent.roomId,
          roomEvent.threadId ?? null,
          roomEvent.kind,
          roomEvent.from,
          JSON.stringify(roomEvent.to),
          roomEvent.replyTo ?? null,
          roomEvent.createdAt,
          JSON.stringify(roomEvent.payload),
        );
      if (insertResult.changes === 0) {
        return;
      }
      this.projectEvent(roomEvent);
      this.db
        .query(
          `UPDATE rooms SET updated_at = ?, last_event_at = ? WHERE id = ?`,
        )
        .run(new Date().toISOString(), roomEvent.createdAt, roomEvent.roomId);
    });
    transaction(parsed);
  }

  getRoomHistory(roomId: string): RoomEvent[] {
    const rows = this.db
      .query(
        `SELECT id, schema_version, room_id, thread_id, kind, from_participant_id,
                to_participant_ids_json, reply_to, created_at, payload_json
         FROM room_events
         WHERE room_id = ?
         ORDER BY created_at ASC, inserted_at ASC`,
      )
      .all(roomId) as StoredEventRow[];
    return rows.map(rowToRoomEvent);
  }

  listContextItems(roomId: string): ContextItemRecord[] {
    const rows = this.db
      .query(
        `SELECT context_id, room_id, kind, name, preview, bytes, artifact_path, created_at
         FROM context_items
         WHERE room_id = ?
         ORDER BY created_at ASC`,
      )
      .all(roomId) as ContextItemRow[];
    return rows.map((row) => {
      const item: ContextItemRecord = {
        contextId: row.context_id,
        roomId: row.room_id,
        kind: row.kind,
        name: row.name,
        createdAt: row.created_at,
      };
      if (row.preview !== null) item.preview = row.preview;
      if (row.bytes !== null) item.bytes = row.bytes;
      if (row.artifact_path !== null) item.artifactPath = row.artifact_path;
      return item;
    });
  }

  upsertProviderConfig(
    input: Omit<ProviderConfigRecord, "enabled"> & { enabled?: boolean },
  ): void {
    const now = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO provider_configs
         (id, provider, mode, secret_ref, base_url, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           provider = excluded.provider,
           mode = excluded.mode,
           secret_ref = excluded.secret_ref,
           base_url = excluded.base_url,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
      )
      .run(
        input.id,
        input.provider,
        input.mode,
        input.secretRef ?? null,
        input.baseUrl ?? null,
        input.enabled === false ? 0 : 1,
        now,
        now,
      );
  }

  registerApiKey(input: {
    id: string;
    name: string;
    secretRef: string;
    token: string;
    scopes: string[];
  }): ApiKeyRecord {
    const createdAt = new Date().toISOString();
    const tokenHash = hashToken(input.token);
    this.db
      .query(
        `INSERT INTO api_keys
         (id, name, secret_ref, token_hash, scopes_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           secret_ref = excluded.secret_ref,
           token_hash = excluded.token_hash,
           scopes_json = excluded.scopes_json`,
      )
      .run(
        input.id,
        input.name,
        input.secretRef,
        tokenHash,
        JSON.stringify(input.scopes),
        createdAt,
      );
    return {
      id: input.id,
      name: input.name,
      secretRef: input.secretRef,
      tokenHash,
      scopes: input.scopes,
      createdAt,
    };
  }

  verifyApiKey(token: string): ApiKeyRecord | undefined {
    const row = this.db
      .query(
        `SELECT id, name, secret_ref, token_hash, scopes_json, created_at, last_used_at, revoked_at
         FROM api_keys
         WHERE token_hash = ? AND revoked_at IS NULL`,
      )
      .get(hashToken(token)) as ApiKeyRow | null;
    if (!row) {
      return undefined;
    }
    const lastUsedAt = new Date().toISOString();
    this.db
      .query(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`)
      .run(lastUsedAt, row.id);
    const record: ApiKeyRecord = {
      id: row.id,
      name: row.name,
      secretRef: row.secret_ref,
      tokenHash: row.token_hash,
      scopes: parseJsonArray(row.scopes_json),
      createdAt: row.created_at,
      lastUsedAt,
    };
    if (row.revoked_at !== null) record.revokedAt = row.revoked_at;
    return record;
  }

  exportTranscript(roomId: string): TranscriptExport {
    const history = this.getRoomHistory(roomId);
    const markdown = renderTranscriptMarkdown(roomId, history);
    const artifactPath = join(
      this.artifactDir,
      `${roomId}-${new Date().toISOString().replace(/[:.]/g, "-")}.md`,
    );
    Bun.write(artifactPath, markdown);
    return { artifactPath, markdown };
  }

  private ensureRoom(roomId: string, name: string): void {
    const now = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO rooms (id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run(roomId, name, now, now);
  }

  private projectEvent(event: RoomEvent): void {
    switch (event.kind) {
      case "participant.joined":
        this.projectParticipantJoined(event);
        return;
      case "participant.left":
      case "participant.state_changed":
        this.projectParticipantState(event);
        return;
      case "message.created":
      case "message.transcript_partial":
      case "message.transcript_final":
        this.projectMessage(event);
        return;
      case "agent.dispatch":
      case "agent.started":
      case "agent.progress":
      case "agent.completed":
      case "agent.blocked":
      case "agent.cancelled":
        this.projectAgentLifecycle(event);
        return;
      case "receipt.created":
        this.projectReceipt(event);
        return;
      case "context.attached":
      case "workspace.file_observed":
      case "workspace.file_changed":
        this.projectContext(event);
        return;
      case "voice.session_started":
      case "voice.session_ended":
        this.projectVoiceSession(event);
        return;
      case "handoff.created":
        this.projectHandoff(event);
        return;
      default:
        return;
    }
  }

  private projectParticipantJoined(event: RoomEvent): void {
    const participant = normalizeParticipant(event.payload.participant);
    if (!participant) {
      return;
    }
    this.db
      .query(
        `INSERT INTO participants
         (id, room_id, kind, display_name, route_names_json, state, color, voice_enabled, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(room_id, id) DO UPDATE SET
           kind = excluded.kind,
           display_name = excluded.display_name,
           route_names_json = excluded.route_names_json,
           state = excluded.state,
           color = excluded.color,
           voice_enabled = excluded.voice_enabled,
           last_seen_at = excluded.last_seen_at`,
      )
      .run(
        participant.id,
        event.roomId,
        participant.kind,
        participant.displayName,
        JSON.stringify(participant.routeNames),
        participant.state,
        participant.color ?? null,
        participant.voiceEnabled ? 1 : 0,
        event.createdAt,
      );
  }

  private projectParticipantState(event: RoomEvent): void {
    const participantId =
      typeof event.payload.participantId === "string"
        ? event.payload.participantId
        : "";
    if (!participantId) {
      return;
    }
    const state =
      event.kind === "participant.left"
        ? "offline"
        : typeof event.payload.state === "string"
          ? event.payload.state
          : "idle";
    this.db
      .query(
        `UPDATE participants
         SET state = ?, last_seen_at = ?
         WHERE room_id = ? AND id = ?`,
      )
      .run(state, event.createdAt, event.roomId, participantId);
  }

  private projectMessage(event: RoomEvent): void {
    const text =
      typeof event.payload.text === "string" ? event.payload.text : "";
    const source =
      typeof event.payload.source === "string" ? event.payload.source : "text";
    const contextIds = Array.isArray(event.payload.contextIds)
      ? event.payload.contextIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    this.db
      .query(
        `INSERT OR REPLACE INTO messages
         (event_id, room_id, participant_id, source, text, is_final, context_ids_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.roomId,
        event.from,
        source,
        text,
        event.kind === "message.transcript_partial" ? 0 : 1,
        JSON.stringify(contextIds),
        event.createdAt,
      );
  }

  private projectAgentLifecycle(event: RoomEvent): void {
    this.db
      .query(
        `INSERT OR REPLACE INTO agent_dispatches
         (event_id, room_id, agent_id, status, reply_to, text, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.roomId,
        stringPayload(event, "agentId"),
        stringPayload(event, "status"),
        event.replyTo ?? null,
        optionalStringPayload(event, "text"),
        optionalStringPayload(event, "reason"),
        event.createdAt,
      );
  }

  private projectReceipt(event: RoomEvent): void {
    this.db
      .query(
        `INSERT OR REPLACE INTO receipts
         (event_id, room_id, verification, label, summary, artifact_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.roomId,
        stringPayload(event, "verification"),
        stringPayload(event, "label"),
        stringPayload(event, "summary"),
        optionalStringPayload(event, "artifactId"),
        JSON.stringify(event.payload.metadata ?? {}),
        event.createdAt,
      );
  }

  private projectContext(event: RoomEvent): void {
    this.db
      .query(
        `INSERT OR REPLACE INTO context_items
         (context_id, room_id, kind, name, preview, bytes, artifact_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        stringPayload(event, "contextId"),
        event.roomId,
        stringPayload(event, "kind"),
        stringPayload(event, "name"),
        optionalStringPayload(event, "preview"),
        typeof event.payload.bytes === "number" ? event.payload.bytes : null,
        optionalStringPayload(event, "artifactPath"),
        event.createdAt,
      );
  }

  private projectVoiceSession(event: RoomEvent): void {
    const sessionId = stringPayload(event, "sessionId");
    const state = stringPayload(event, "state");
    this.db
      .query(
        `INSERT INTO voice_sessions
         (session_id, room_id, provider, state, started_at, ended_at, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           state = excluded.state,
           ended_at = excluded.ended_at,
           reason = excluded.reason`,
      )
      .run(
        sessionId,
        event.roomId,
        stringPayload(event, "provider"),
        state,
        state === "started" ? event.createdAt : null,
        state === "ended" || state === "blocked" ? event.createdAt : null,
        optionalStringPayload(event, "reason"),
      );
  }

  private projectHandoff(event: RoomEvent): void {
    this.db
      .query(
        `INSERT OR REPLACE INTO handoffs
         (event_id, room_id, target, summary, action_items_json, blockers_json, artifact_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.roomId,
        stringPayload(event, "target"),
        stringPayload(event, "summary"),
        JSON.stringify(event.payload.actionItems ?? []),
        JSON.stringify(event.payload.blockers ?? []),
        optionalStringPayload(event, "artifactPath"),
        event.createdAt,
      );
  }
}

interface StoredEventRow {
  id: string;
  schema_version: string;
  room_id: string;
  thread_id: string | null;
  kind: string;
  from_participant_id: string;
  to_participant_ids_json: string;
  reply_to: string | null;
  created_at: string;
  payload_json: string;
}

interface ContextItemRow {
  context_id: string;
  room_id: string;
  kind: ContextItemRecord["kind"];
  name: string;
  preview: string | null;
  bytes: number | null;
  artifact_path: string | null;
  created_at: string;
}

interface ApiKeyRow {
  id: string;
  name: string;
  secret_ref: string;
  token_hash: string;
  scopes_json: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function rowToRoomEvent(row: StoredEventRow): RoomEvent {
  return parseRoomEvent({
    id: row.id,
    schemaVersion: row.schema_version,
    roomId: row.room_id,
    threadId: row.thread_id ?? undefined,
    kind: row.kind,
    from: row.from_participant_id,
    to: parseJsonArray(row.to_participant_ids_json),
    replyTo: row.reply_to ?? undefined,
    createdAt: row.created_at,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
  });
}

function renderTranscriptMarkdown(
  roomId: string,
  history: RoomEvent[],
): string {
  const lines = [`# Agent Room Transcript: ${roomId}`, ""];
  for (const event of history) {
    if (
      event.kind === "message.created" ||
      event.kind === "message.transcript_final" ||
      event.kind === "agent.completed" ||
      event.kind === "agent.blocked"
    ) {
      lines.push(
        `- ${event.createdAt} ${event.from}: ${typeof event.payload.text === "string" ? event.payload.text : JSON.stringify(event.payload)}`,
      );
    }
    if (event.kind === "receipt.created") {
      lines.push(
        `  - receipt ${event.payload.verification}: ${event.payload.label} - ${event.payload.summary}`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

function normalizeParticipant(value: unknown): Participant | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.displayName !== "string") {
    return undefined;
  }
  return {
    id: record.id,
    kind:
      record.kind === "agent" ||
      record.kind === "moderator" ||
      record.kind === "system"
        ? record.kind
        : "human",
    displayName: record.displayName,
    routeNames: Array.isArray(record.routeNames)
      ? record.routeNames.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    state:
      record.state === "reading" ||
      record.state === "thinking" ||
      record.state === "speaking" ||
      record.state === "blocked" ||
      record.state === "offline"
        ? record.state
        : "idle",
    color: typeof record.color === "string" ? record.color : undefined,
    voiceEnabled: record.voiceEnabled === true,
  };
}

function parseJsonArray(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function stringPayload(event: RoomEvent, key: string): string {
  const value = event.payload[key];
  return typeof value === "string" ? value : "";
}

function optionalStringPayload(event: RoomEvent, key: string): string | null {
  const value = event.payload[key];
  return typeof value === "string" ? value : null;
}

function hashToken(token: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(token);
  return hasher.digest("hex");
}

export function createContextAttachedEvent(input: {
  roomId: string;
  from: string;
  contextId: string;
  name: string;
  kind: "snippet" | "file" | "url" | "note";
  preview?: string;
  bytes?: number;
}): RoomEvent {
  return createRoomEvent({
    id: crypto.randomUUID(),
    roomId: input.roomId,
    kind: "context.attached",
    from: input.from,
    payload: {
      contextId: input.contextId,
      name: input.name,
      kind: input.kind,
      preview: input.preview,
      bytes: input.bytes,
    },
  });
}
