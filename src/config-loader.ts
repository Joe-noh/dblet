import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createJiti } from "jiti";
import { parseIntoClientConfig } from "pg-connection-string";
import {
  resolveEnvironment,
  type DbConnectionConfig,
  type DbletConfig,
  type ResolvedDbletConfig,
  type ResolvedEnvironment,
} from "@/config";

const CONFIG_FILES = ["ts", "mts", "js", "mjs"].map((ext) => {
  return `dblet.config.${ext}`;
});

export function findConfigFile(cwd = process.cwd()): string | undefined {
  for (const name of CONFIG_FILES) {
    const candidate = join(cwd, name);

    if (existsSync(candidate)) {
      return candidate;
    }
  }
}

export function parseDatabaseUrl(url: string): DbConnectionConfig {
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error("Database URL must start with postgres:// or postgresql://.");
  }

  const { host, port, user, password, database, ssl } = parseIntoClientConfig(url);

  if (!database) {
    throw new Error("Database URL must include a database name.");
  }

  return {
    host,
    port,
    user,
    // Parsed from a string, so these are always plain values.
    password: password as string | undefined,
    ssl: ssl as DbConnectionConfig["ssl"],
    database,
  };
}

async function importConfig(configPath: string): Promise<DbletConfig> {
  const jiti = createJiti(import.meta.url);

  return jiti.import<DbletConfig>(configPath, { default: true });
}

export async function loadConfig({
  cwd,
  env,
  url,
}: {
  cwd?: string;
  env?: string;
  url?: string;
} = {}): Promise<ResolvedDbletConfig> {
  const workingDir = cwd || process.cwd();
  const configPath = findConfigFile(cwd);
  const config = configPath ? await importConfig(configPath) : undefined;

  let environment: ResolvedEnvironment;

  if (url) {
    environment = { client: "pg", connection: parseDatabaseUrl(url) };
  } else if (config) {
    environment = resolveEnvironment(config, env || process.env.DBLET_ENV);
  } else {
    throw new Error(`dblet config not found in ${workingDir}. Create dblet.config.ts.`);
  }

  const baseDir = configPath ? dirname(configPath) : workingDir;
  const migrationDir = config?.migrations?.directory ?? "migrations";

  return {
    ...environment,
    migrations: {
      directory: resolve(baseDir, migrationDir),
    },
  };
}
