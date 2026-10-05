import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { MigrationResult } from "kysely/migration";
import { createDatabase, dropDatabase } from "@/admin";
import { createMigrator, generateTimestamp, migrationTemplate } from "@/migration";
import { newConnection, getConfig, closeDbConn } from "@/runtime";

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

  console.log(`Created ${relative(process.cwd(), file)}.`);
}

async function migrationUp(): Promise<void> {
  const migrator = createMigrator(await newConnection(), await getConfig());
  const { results, error } = await migrator.migrateToLatest();

  reportResults({ results, error });

  if (results?.length === 0) {
    console.log("No pending migrations.");
  }
}

async function migrationDown(): Promise<void> {
  const migrator = createMigrator(await newConnection(), await getConfig());
  const { results, error } = await migrator.migrateDown();
  console.error(results, error);

  reportResults({ results, error });

  console.error(results);

  if (results?.length === 1 && !results[0].migrationName) {
    console.log("No migrations to rollback.");
  }
}

async function migrationStatus(): Promise<void> {
  const migrator = createMigrator(await newConnection(), await getConfig());
  const migrations = await migrator.getMigrations();

  if (migrations.length === 0) {
    console.log("No migration filed found.");
  } else {
    for (const migration of migrations) {
      const status = migration.executedAt ? "applied" : "pending";
      const name = migration.name;

      console.log(`[${status}] ${name}`);
    }
  }
}

async function dbCreate(): Promise<void> {
  const config = await getConfig();
  const name = config.connection.database;

  await createDatabase(config);
  console.log(`Created database ${name}`);
}

async function dbDrop(): Promise<void> {
  const config = await getConfig();
  const name = config.connection.database;

  await dropDatabase(config);
  console.log(`Dropped database ${name}`);
}

async function dbReset(): Promise<void> {
  const config = await getConfig();
  const name = config.connection.database;

  await dropDatabase(config);
  console.log(`Dropped database ${name}`);
  await createDatabase(config);
  console.log(`Created database ${name}`);

  await migrationUp();
}

function detectEnv(env: string | undefined) {
  if (env) {
    process.env.DBLET_ENV = env;
  } else if (!process.env.DBLET_ENV) {
    process.env.DBLET_ENV = "development";
  }
}

async function reportResults({ results, error }: { results?: MigrationResult[]; error?: unknown }) {
  for (const result of results ?? []) {
    const { migrationName, direction, status } = result;

    if (!migrationName) continue;

    const verb = direction === "Up" ? "applied" : "reverted";
    const mark = status === "Success" ? "✓" : "✘";

    console.log(`${mark} ${verb} ${migrationName}`);
  }

  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

async function main(): Promise<void> {
  try {
    const { values, positionals } = parseArgs({
      options: { env: { type: "string" } },
      allowPositionals: true,
    });
    const [command, ...args] = positionals;

    detectEnv(values.env);

    switch (command) {
      case "migration:new":
        await migrationNew(args[0]);
        break;
      case "migration:up":
        await migrationUp();
        break;
      case "migration:down":
        await migrationDown();
        break;
      case "migration:status":
        await migrationStatus();
        break;
      case "db:create":
        await dbCreate();
        break;
      case "db:drop":
        await dbDrop();
        break;
      case "db:reset":
        await dbReset();
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
