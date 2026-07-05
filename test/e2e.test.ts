import { execFile } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "pg";
import { describe, expect, test } from "vitest";

const CONNECTION = {
  host: "localhost",
  port: 54321,
  user: "dblet",
  password: "dblet",
  database: "dblet_e2e",
};

const execFileAsync = promisify(execFile);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = resolve(rootDir, "test/fixtures/app");

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
    const client = new Client(CONNECTION);
    await client.connect();

    try {
      const result = await client.query("SELECT COUNT(*)::int as count FROM users");
      expect(result.rows[0].count).toBe(0);
    } finally {
      await client.end();
    }
  });
});
