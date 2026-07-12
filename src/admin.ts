import { Client } from "pg";
import type { ResolvedDbletConfig } from "@/config";

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

async function maintenanceClient(config: ResolvedDbletConfig): Promise<Client> {
  const conn = config.connection;

  if (!conn) {
    throw new Error("Failed to get connection settings.");
  }

  const client = new Client({
    host: conn.host,
    port: conn.port,
    user: conn.user,
    password: conn.password,
    ssl: conn.ssl,
  });

  await client.connect();

  return client;
}

export async function createDatabase(config: ResolvedDbletConfig): Promise<boolean> {
  const name = config.connection.database;
  const client = await maintenanceClient(config);

  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (existing.rowCount) {
      return false;
    }

    try {
      await client.query(`CREATE DATABASE ${quoteIdent(name)}`);
    } catch (error) {
      if ((error as { code: string }).code !== "42P04") {
        // 42P04 = duplicate_database
        // Another process created it.
        return false;
      }

      throw error;
    }

    return true;
  } finally {
    await client.end();
  }
}

export async function dropDatabase(config: ResolvedDbletConfig): Promise<void> {
  const name = config.connection.database;
  const client = await maintenanceClient(config);

  try {
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`);
  } finally {
    await client.end();
  }
}
