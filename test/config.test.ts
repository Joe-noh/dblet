import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { defineConfig, resolveEnvironment } from "@/config";
import { findConfigFile, loadConfig, parseDatabaseUrl } from "@/config-loader";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/app");

function writeStagingConfig(): string {
  const dir = mkdtempSync(join(tmpdir(), "dblet-"));

  writeFileSync(
    join(dir, "dblet.config.mjs"),
    `export default { db: { client: "pg", environments: { staging: { connection: { database: "staging_db" } } } }, migrations: { directory: "db/migrations" } }`,
  );

  return dir;
}

describe("defineConfig", () => {
  test("returns given config as-is", () => {
    const config = {
      db: {
        client: "pg" as const,
        environments: {
          test: {
            connection: {
              database: "postgres",
            },
          },
        },
      },
    };

    expect(defineConfig(config)).toBe(config);
  });
});

describe("resolveEnvironment", () => {
  const config = defineConfig({
    db: {
      client: "pg",
      environments: {
        staging: { connection: { database: "staging_db" }, poolSize: 3 },
      },
    },
  });

  test("returns the given environment", () => {
    expect(resolveEnvironment(config, "staging")).toStrictEqual({
      client: "pg",
      connection: { database: "staging_db" },
      poolSize: 3,
    });
  });

  test("throws if the environment is not defined", () => {
    expect(() => resolveEnvironment(config, "production")).toThrow(/not defined/);
    expect(() => resolveEnvironment(config, "constructor")).toThrow(/not defined/);
  });

  test("throws if no environment is given", () => {
    expect(() => resolveEnvironment(config, undefined)).toThrow(/DBLET_ENV is undefined/);
  });
});

describe("parseDatabaseUrl", () => {
  test("parses connection settings", () => {
    expect(parseDatabaseUrl("postgres://us%40er:p%40ss@db.example.com:6543/my_db")).toEqual({
      host: "db.example.com",
      port: 6543,
      user: "us@er",
      password: "p@ss",
      database: "my_db",
    });
  });

  test("parses ssl settings", () => {
    expect(parseDatabaseUrl("postgresql://localhost/my_db?sslmode=verify-full").ssl).toBeTruthy();
    expect(parseDatabaseUrl("postgresql://localhost/my_db?sslmode=disable").ssl).toBe(false);
  });

  test("throws on invalid urls", () => {
    expect(() => parseDatabaseUrl("mysql://localhost/my_db")).toThrow(/must start with/);
    expect(() => parseDatabaseUrl("localhost:5432/my_db")).toThrow(/must start with/);
    expect(() => parseDatabaseUrl("postgres://localhost:5432")).toThrow(/database name/);
  });
});

describe("findConfigFile", () => {
  test("finds dblet.config.ts in the given dir", () => {
    expect(findConfigFile(fixtureDir)).toBe(join(fixtureDir, "dblet.config.ts"));
  });

  test("returns undefined if no config file found", () => {
    const dir = mkdtempSync(join(tmpdir(), "dblet-"));

    expect(findConfigFile(dir)).toBeUndefined();
  });
});

describe("loadConfig", () => {
  test("loads the config file", async () => {
    const config = {
      client: "pg",
      connection: {
        host: "localhost",
        port: 54321,
        user: "dblet",
        password: "dblet",
        database: "dblet_e2e_test",
      },
      poolSize: undefined,
      migrations: {
        directory: join(fixtureDir, "migrations"),
      },
    };

    expect(await loadConfig({ cwd: fixtureDir, env: "test" })).toStrictEqual(config);
  });

  test("throws if no config file found", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dblet-"));

    await expect(loadConfig({ cwd: dir })).rejects.toThrow(/not found/);
  });

  test("loads an arbitrary environment", async () => {
    const config = await loadConfig({ cwd: writeStagingConfig(), env: "staging" });

    expect(config.connection.database).toBe("staging_db");
  });

  test("throws if the environment is not defined", async () => {
    const dir = writeStagingConfig();

    await expect(loadConfig({ cwd: dir, env: "production" })).rejects.toThrow(/not defined/);
    await expect(loadConfig({ cwd: dir, env: "constructor" })).rejects.toThrow(/not defined/);
  });

  test("uses the url instead of the environment", async () => {
    const dir = writeStagingConfig();
    const config = await loadConfig({
      cwd: dir,
      env: "production",
      url: "postgres://localhost/url_db",
    });

    expect(config.connection.database).toBe("url_db");
    expect(config.migrations.directory).toBe(join(dir, "db/migrations"));
  });

  test("does not need a config file when the url is given", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dblet-"));
    const config = await loadConfig({ cwd: dir, url: "postgres://localhost/url_db" });

    expect(config.connection.database).toBe("url_db");
    expect(config.migrations.directory).toBe(join(dir, "migrations"));
  });
});
