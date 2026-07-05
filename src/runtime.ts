import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { loadConfig, ResolvedDbletConfig } from "@/config";

type DbletState = {
  config: ResolvedDbletConfig | undefined;
  db: Kysely<any> | undefined;
  testConn: Kysely<any> | undefined;
};

const state: DbletState = ((globalThis as any).__DBLET_STATE__ ??= {
  config: undefined,
  db: undefined,
  testConn: undefined,
});

export function createKysely<DB = any>(config: ResolvedDbletConfig): Kysely<DB> {
  const conn = config.connection;

  if (!conn) {
    throw new Error("Failed to get connection settings.");
  }

  const pool = new Pool({
    host: conn.host,
    port: conn.port,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    ssl: conn.ssl,
    max: config.poolSize,
  });

  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

export async function getConfig(): Promise<ResolvedDbletConfig> {
  if (!state.config) {
    state.config = await loadConfig();
  }

  return state.config;
}

export async function dbConn<DB = any>(): Promise<Kysely<DB>> {
  if (state.testConn) {
    return state.testConn as Kysely<DB>;
  }
  if (!state.db) {
    state.db = createKysely(await getConfig());
  }

  return state.db as Kysely<DB>;
}

export async function rawDbConn<DB = any>(): Promise<Kysely<DB>> {
  if (!state.db) {
    state.db = createKysely(await getConfig());
  }

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

export function setTestConnection(conn: Kysely<any>): void {
  state.testConn = conn;
}

export function clearTestConnection(): void {
  state.testConn = undefined;
}
