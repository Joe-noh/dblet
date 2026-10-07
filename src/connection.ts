import { AsyncLocalStorage } from "node:async_hooks";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DbEnvConfig, ResolvedDbletConfig } from "@/config";

// Augmented by the generated dblet.d.ts so that connection() returns Kysely<DB>.
export interface Register {}

export type RegisteredDB = Register extends { db: infer DB } ? DB : any;

type DbletState = {
  config: ResolvedDbletConfig | undefined;
  db: Kysely<any> | undefined;
  testConn: Kysely<any> | undefined;
  scope: AsyncLocalStorage<Kysely<any>>;
};

export const state: DbletState = ((globalThis as any).__DBLET_STATE__ ??= {
  config: undefined,
  db: undefined,
  testConn: undefined,
  scope: new AsyncLocalStorage(),
});

export function createKysely<DB = any>(options: DbEnvConfig): Kysely<DB> {
  const conn = options.connection;

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
    max: options.poolSize,
  });

  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

export function scopedConnection<DB = any>(): Kysely<DB> | undefined {
  return (state.testConn ?? state.scope.getStore()) as Kysely<DB> | undefined;
}

export async function withConnection<T>(
  options: DbEnvConfig,
  fn: () => T | Promise<T>,
): Promise<T> {
  // Inside a test transaction, keep every query on it.
  if (state.testConn) {
    return fn();
  }

  const db = createKysely(options);

  try {
    return await state.scope.run(db, fn);
  } finally {
    await db.destroy();
  }
}

export function setTestConnection(conn: Kysely<any>): void {
  state.testConn = conn;
}

export function clearTestConnection(): void {
  state.testConn = undefined;
}
