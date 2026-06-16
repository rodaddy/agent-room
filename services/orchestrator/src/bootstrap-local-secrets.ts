import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteStore } from "@agent-room/persistence";

interface BootstrapSecret {
  id: string;
  name: string;
  envName: string;
  secretRef: string;
  scopes: string[];
}

const secrets: BootstrapSecret[] = [
  {
    id: "admin-api-key",
    name: "Agent Room Admin API Key",
    envName: "AGENT_ROOM_ADMIN_KEY",
    secretRef:
      process.env.AGENT_ROOM_ADMIN_KEY_REF ??
      "vaultwarden://agent-room/admin-api-key",
    scopes: ["admin"],
  },
  {
    id: "orchestrator-local-token",
    name: "Agent Room Orchestrator Local Token",
    envName: "ORCHESTRATOR_LOCAL_TOKEN",
    secretRef:
      process.env.AGENT_ROOM_ORCHESTRATOR_TOKEN_REF ??
      "vaultwarden://agent-room/orchestrator-local-token",
    scopes: [
      "room:connect",
      "context:write",
      "transcript:read",
      "voice:session",
    ],
  },
];

const databasePath = process.env.AGENT_ROOM_DB_PATH ?? "data/agent-room.sqlite";
mkdirSync(dirname(databasePath), { recursive: true });

const storeOptions: ConstructorParameters<typeof SqliteStore>[0] = {
  databasePath,
};
if (process.env.AGENT_ROOM_ARTIFACT_DIR) {
  storeOptions.artifactDir = process.env.AGENT_ROOM_ARTIFACT_DIR;
}

const store = new SqliteStore(storeOptions);

try {
  const registered = [];
  for (const secret of secrets) {
    const token = process.env[secret.envName];
    if (!token) {
      continue;
    }
    const record = store.registerApiKey({
      id: secret.id,
      name: secret.name,
      secretRef: secret.secretRef,
      token,
      scopes: secret.scopes,
    });
    registered.push({
      id: record.id,
      name: record.name,
      secretRef: record.secretRef,
      scopes: record.scopes,
    });
  }

  console.log(
    JSON.stringify({
      ok: true,
      registered,
      skippedEnv: secrets
        .filter((secret) => !process.env[secret.envName])
        .map((secret) => secret.envName),
    }),
  );
} finally {
  store.close();
}
