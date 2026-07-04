export type DbConnectionConfig = {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  ssl?: boolean | Record<string, unknown>;
};

export type DbConfig = {
  client: "pg";
  connection: DbConnectionConfig;
  poolSize?: number;
};

export type MigrationsConfig = {
  directory?: string;
};

export type DbletConfig = {
  db: DbConfig;
  migrations?: MigrationsConfig;
};

export function defineConfig(config: DbletConfig) {
  return config;
}
