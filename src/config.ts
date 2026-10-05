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
  environments: Record<string, DbEnvConfig>;
};

export type MigrationsConfig = {
  directory: string;
};

export type DbletConfig = {
  db: DbConfig;
  migrations?: MigrationsConfig;
};

export type ResolvedEnvironment = DbEnvConfig & {
  client: "pg";
};

export type ResolvedDbletConfig = ResolvedEnvironment & {
  migrations: MigrationsConfig;
};

export function defineConfig(config: DbletConfig): DbletConfig {
  return config;
}

export function resolveEnvironment(
  config: DbletConfig,
  env: string | undefined,
): ResolvedEnvironment {
  const environments = config.db.environments;
  const available = Object.keys(environments)
    .map((e) => `'${e}'`)
    .join(", ");

  if (!env) {
    throw new Error(`DBLET_ENV is undefined. Set one of ${available}.`);
  }

  if (!Object.hasOwn(environments, env)) {
    throw new Error(
      `Environment '${env}' is not defined in db.environments. Set one of ${available}.`,
    );
  }

  const { connection, poolSize } = environments[env];

  return {
    client: config.db.client,
    connection,
    poolSize,
  };
}
