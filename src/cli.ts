import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { MigrationResult } from "kysely/migration";
import { createDatabase, dropDatabase } from "@/admin";
import { generateTypes } from "@/codegen";
import { loadConfig } from "@/config-loader";
import { createMigrator, generateTimestamp, migrationTemplate } from "@/migration";
import { connection, newConnection, getConfig, closeDbConn, setConfig } from "@/runtime";

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

  await reportResults({ results, error });

  if (results?.length === 0) {
    console.log("No pending migrations.");
  }

  await generateTypesAfter(results);
}

async function migrationDown(): Promise<void> {
  const migrator = createMigrator(await newConnection(), await getConfig());
  const { results, error } = await migrator.migrateDown();

  await reportResults({ results, error });

  if (results?.length === 1 && !results[0].migrationName) {
    console.log("No migrations to rollback.");
  }

  await generateTypesAfter(results);
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

async function dbCodegen(): Promise<void> {
  const { codegen } = await getConfig();

  if (!codegen) {
    throw new Error("Type generation is disabled by `codegen: false` in dblet config.");
  }

  if (await generateTypes(await connection(), codegen.outFile)) {
    console.log(`Generated ${relative(process.cwd(), codegen.outFile)}.`);
  }
}

// The migrations already succeeded, so a failure here only warns.
async function generateTypesAfter(results: MigrationResult[] | undefined): Promise<void> {
  const { codegen } = await getConfig();

  if (!codegen || !results?.some(({ status }) => status === "Success")) {
    return;
  }

  try {
    await dbCodegen();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Skipped type generation: ${message.split("\n")[0]}`);
  }
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

type Command = {
  usage?: string;
  description: string;
  run: (args: string[]) => Promise<void>;
};

const COMMANDS: Record<string, Command> = {
  "migration:new": {
    usage: "<name>",
    description: "Create a new migration file",
    run: ([name]) => migrationNew(name),
  },
  "migration:up": { description: "Apply all pending migrations", run: migrationUp },
  "migration:down": { description: "Revert the latest migration", run: migrationDown },
  "migration:status": { description: "Show applied and pending migrations", run: migrationStatus },
  "db:create": { description: "Create the database", run: dbCreate },
  "db:drop": { description: "Drop the database", run: dbDrop },
  "db:reset": { description: "Drop, create and migrate the database", run: dbReset },
  "db:codegen": { description: "Generate types from the database schema", run: dbCodegen },
};

const OPTIONS = [
  ["--env <name>", "Environment in dblet.config (default: $DBLET_ENV or development)"],
  ["--url <url>", "Database URL to use instead of the config environments"],
  ["-h, --help", "Show this help"],
];

function help(): string {
  const commands = Object.entries(COMMANDS).map(([name, { usage, description }]) => [
    usage ? `${name} ${usage}` : name,
    description,
  ]);
  const rows = (entries: string[][]) =>
    entries.map(([left, right]) => `  ${left.padEnd(24)}${right}`);

  return [
    "Usage: dblet <command> [options]",
    "",
    "Commands:",
    ...rows(commands),
    "",
    "Options:",
    ...rows(OPTIONS),
  ].join("\n");
}

async function main(): Promise<void> {
  try {
    const { values, positionals } = parseArgs({
      options: {
        env: { type: "string" },
        url: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
    });
    const [command, ...args] = positionals;

    if (!command || values.help) {
      console.log(help());
      return;
    }

    if (!Object.hasOwn(COMMANDS, command)) {
      throw new Error(`Unknown command '${command}'. Run 'dblet --help' for usage.`);
    }

    detectEnv(values.env);
    setConfig(await loadConfig({ env: values.env, url: values.url }));

    await COMMANDS[command].run(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await closeDbConn();
  }
}

await main();
