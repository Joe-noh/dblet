import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createJiti } from "jiti";
import { resolveEnvironment, type DbletConfig, type ResolvedDbletConfig } from "@/config";

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

export async function loadConfig({
  cwd,
  env,
}: {
  cwd?: string;
  env?: string;
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

  return {
    ...resolveEnvironment(config, dbletEnv),
    migrations: {
      directory: resolve(baseDir, migrationDir),
    },
  };
}
