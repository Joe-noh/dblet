import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createJiti } from "jiti";

export type DbConnectionConfig = {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  ssl?: boolean | Record<string, unknown>;
};

export type DbEnvConfig = {
  connection: DbConnectionConfig;
  poolSize?: number;
};

type DbletEnv = "test" | "development" | "production";

export type DbConfig = {
  client: "pg";
  test?: DbEnvConfig;
  development?: DbEnvConfig;
  production?: DbEnvConfig;
};

export type MigrationsConfig = {
  directory: string;
};

export type DbletConfig = {
  db: DbConfig;
  migrations?: MigrationsConfig;
};

export type ResolvedDbletConfig = {
  client: "pg";
  connection: DbConnectionConfig;
  poolSize?: number;
  migrations: MigrationsConfig;
};

const CONFIG_FILES = ["ts", "mts", "js", "mjs"].map((ext) => {
  return `dblet.config.${ext}`;
});

export function defineConfig(config: DbletConfig): DbletConfig {
  return config;
}

export function findConfigFile(cwd = process.cwd()): string | undefined {
  for (const name of CONFIG_FILES) {
    const candidate = join(cwd, name);

    if (existsSync(candidate)) {
      return candidate;
    }
  }
}

export async function loadConfig({
  cwd,
  env,
}: {
  cwd?: string;
  env?: DbletEnv;
} = {}): Promise<ResolvedDbletConfig> {
  const workingDir = cwd || process.cwd();
  const dbletEnv = env || process.env.DBLET_ENV;
  const configPath = findConfigFile(cwd);

  if (!configPath) {
    throw new Error(`dblet config not found in ${workingDir}. Create dblet.config.ts.`);
  }

  const jiti = createJiti(import.meta.url);
  const config = await jiti.import<DbletConfig>(configPath, { default: true });
  const baseDir = dirname(configPath);
  const migrationDir = config.migrations?.directory ?? "migrations";

  if (["test", "development", "production"].every((e) => e !== dbletEnv)) {
    throw new Error("DBLET_ENV is undefined. Set one of 'test', 'development' or 'production'.");
  }

  const { connection, poolSize } = config.db[dbletEnv as DbletEnv]!;

  return {
    client: config.db.client,
    connection,
    poolSize,
    migrations: {
      directory: resolve(baseDir, migrationDir),
    },
  };
}
