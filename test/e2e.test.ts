import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "pg";
import { beforeEach, describe, expect, test } from "vitest";

const CONNECTION = {
  host: "localhost",
  port: 54321,
  user: "dblet",
  password: "dblet",
  database: "dblet_e2e",
};

const execFileAsync = promisify(execFile);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(rootDir, "test/fixtures/app");
const cliPath = join(rootDir, "dist/cli.mjs");

function runCli(args: string[], cwd = fixtureDir) {
  return execFileAsync(process.execPath, [cliPath, ...args], { cwd });
}

describe("help", () => {
  test("prints usage without arguments or with --help", async () => {
    // No dblet.config in `dir`: help must not need one.
    const dir = mkdtempSync(join(tmpdir(), "dblet-cli-"));

    expect((await runCli([], dir)).stdout).toContain("Usage: dblet <command> [options]");
    expect((await runCli(["--help"], dir)).stdout).toContain("Usage: dblet <command> [options]");
  });

  test("rejects an unknown command", async () => {
    await expect(runCli(["migrate"])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Unknown command 'migrate'"),
    });
  });
});

describe("migration:new", () => {
  test("creates timestamped file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dblet-cli-"));

    writeFileSync(
      join(dir, "dblet.config.ts"),
      `export default { db: { environments: { development: { connection: { database: 'x' } } } } }`,
    );

    const { stdout } = await runCli(["migration:new", "add_users_table"], dir);
    expect(stdout).toMatch(/Created migrations\/\d{14}_add_users_table\.ts\./);

    const files = readdirSync(join(dir, "migrations"));
    const content = readFileSync(join(dir, "migrations", files[0]), "utf8");

    expect(content).toContain("export async function up(db: Kysely<any>): Promise<void> {");
    expect(content).toContain("export async function down(db: Kysely<any>): Promise<void> {");
  });

  test("rejects invalid name", async () => {
    await expect(runCli(["migration:new", "../../evil"])).rejects.toMatchObject({ code: 1 });
  });
});

describe("--env option", () => {
  test("selects the environment", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dblet-cli-"));

    writeFileSync(
      join(dir, "dblet.config.ts"),
      `export default { db: { environments: { staging: { connection: { database: 'x' } } } } }`,
    );

    await expect(runCli(["migration:new", "add_users_table"], dir)).rejects.toMatchObject({
      code: 1,
    });

    const { stdout } = await runCli(["migration:new", "add_users_table", "--env", "staging"], dir);
    expect(stdout).toMatch(/Created migrations\/\d{14}_add_users_table\.ts\./);
  });

  test("rejects an undefined environment", async () => {
    await expect(runCli(["migration:status", "--env=staging"])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Environment 'staging' is not defined"),
    });
  });
});

describe("--url option", () => {
  test("runs commands against the given database", async () => {
    const { host, port, user, password } = CONNECTION;
    const url = `postgres://${user}:${password}@${host}:${port}/dblet_e2e_url`;
    // `staging` is not defined in the fixture config, but --url makes the environment irrelevant.
    const run = (command: string) => runCli([command, "--env=staging", `--url=${url}`]);

    const { stdout } = await run("db:reset");
    expect(stdout).toContain("Created database dblet_e2e_url");
    expect(stdout).toContain("✓ applied 20260705000000_create_users");

    expect((await run("db:drop")).stdout).toContain("Dropped database dblet_e2e_url");
  });
});

describe("migration round-trip", () => {
  beforeEach(async () => {
    await runCli(["db:reset"]);
  });

  test("can apply and revert", async () => {
    let result = await runCli(["migration:status"]);
    expect(result.stdout).toContain("[applied] 20260705000000_create_users");

    result = await runCli(["migration:down"]);
    expect(result.stdout).toContain("✓ reverted 20260705000000_create_users");

    result = await runCli(["migration:status"]);
    expect(result.stdout).toContain("[pending] 20260705000000_create_users");

    result = await runCli(["migration:up"]);
    expect(result.stdout).toContain("✓ applied 20260705000000_create_users");

    result = await runCli(["migration:up"]);
    expect(result.stdout).toContain("No pending migrations.");
  });
});

describe("db:reset", () => {
  test("recreates database", async () => {
    const { stdout } = await runCli(["db:reset"]);

    expect(stdout).toContain("Dropped database dblet_e2e_dev");
    expect(stdout).toContain("Created database dblet_e2e_dev");
    expect(stdout).toContain("✓ applied 20260705000000_create_users");
  });
});

describe("vitest setup", () => {
  test("runs tests inside transactions", async () => {
    const admin = new Client({ ...CONNECTION, database: "postgres" });
    await admin.connect();

    try {
      await admin.query(`DROP DATABASE IF EXISTS ${CONNECTION.database} WITH (FORCE)`);
    } finally {
      await admin.end();
    }

    const vitest = join(rootDir, "node_modules/vitest/vitest.mjs");
    const { stdout, stderr } = await execFileAsync(process.execPath, [vitest, "run"], {
      cwd: fixtureDir,
      env: { DBLET_ENV: "test" },
    });

    expect(stdout + stderr).toContain("passed");
    expect(stdout + stderr).not.toContain("failed");

    // Confirm everything rolled back.
    const client = new Client({ ...CONNECTION, database: "dblet_e2e_test" });
    await client.connect();

    try {
      const result = await client.query("SELECT COUNT(*)::int as count FROM users");
      expect(result.rows[0].count).toBe(0);
    } finally {
      await client.end();
    }
  });
});
