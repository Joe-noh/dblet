import { existsSync } from "node:fs";
import { join } from "node:path";

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

export type DbConfig = {
  client: "pg";
  test?: DbEnvConfig;
  development?: DbEnvConfig;
  production?: DbEnvConfig;
};

export type MigrationsConfig = {
  directory?: string;
};

export type DbletConfig = {
  db: DbConfig;
  migrations?: MigrationsConfig;
};

const CONFIG_FILES = ["ts", "mts", "js", "mjs"].map((ext) => {
  return `dblet.config.${ext}`;
});

export function defineConfig(config: DbletConfig) {
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
