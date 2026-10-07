import { Kysely } from "kysely";
import { ResolvedDbletConfig } from "@/config";
import { loadConfig } from "@/config-loader";
import { createKysely, scopedConnection, state, type RegisteredDB } from "@/connection";

export { createKysely, setTestConnection, clearTestConnection } from "@/connection";

export function setConfig(config: ResolvedDbletConfig): void {
  state.config = config;
}

export async function getConfig(): Promise<ResolvedDbletConfig> {
  if (!state.config) {
    state.config = await loadConfig();
  }

  return state.config;
}

export async function connection<DB = RegisteredDB>(): Promise<Kysely<DB>> {
  const scoped = scopedConnection<DB>();

  if (scoped) {
    return scoped;
  }
  if (!state.db) {
    state.db = createKysely(await getConfig());
  }

  return state.db as Kysely<DB>;
}

export async function newConnection<DB = RegisteredDB>(): Promise<Kysely<DB>> {
  state.db = createKysely(await getConfig());

  return state.db as Kysely<DB>;
}

export async function closeDbConn(): Promise<void> {
  const db = state.db;

  state.db = undefined;
  state.testConn = undefined;

  if (db) {
    await db.destroy();
  }
}
