import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createMigrator, generateTimestamp, migrationTemplate } from "@/migration";
import { rawDbConn, getConfig, closeDbConn } from "@/runtime";

async function migrationNew(name: string | undefined) {
  if (!name) {
    throw new Error("Usage: dblet migration:new <name>");
  }

  if (!/^[0-9a-zA-Z_-]+$/.test(name)) {
    throw new Error("Migration name may only contain letters, numbers, '_' and '-'.");
  }

  const config = await getConfig();
  const dir = config.migrations.directory ?? "migrations";

  await mkdir(dir, { recursive: true });

  const file = join(dir, `${generateTimestamp()}_${name}.ts`);
  await writeFile(file, migrationTemplate());

  console.log(`Created ${resolve(process.cwd(), file)}.`);
}

async function migrationUp(): Promise<void> {
  const migrator = createMigrator(await rawDbConn(), await getConfig());
  const { results, error } = await migrator.migrateToLatest();

  console.log(results, error);
}

function detectEnv() {
  const env = process.env.DBLET_ENV

  if (!env) {
    process.env.DBLET_ENV = 'development'
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  detectEnv();

  try {
    switch (command) {
      case "migration:new":
        await migrationNew(args[0]);
        break;
      case "migration:up":
        await migrationUp();
        break;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await closeDbConn();
  }
}

await main();
