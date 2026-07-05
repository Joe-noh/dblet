import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { findConfigFile, defineConfig, loadConfig } from "@/config";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/app");

describe("defineConfig", () => {
  test("returns given config as-is", () => {
    const config = {
      db: {
        client: "pg" as const,
        test: {
          connection: {
            database: "postgres",
          },
        },
      },
    };

    expect(defineConfig(config)).toBe(config);
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
        database: "dblet_e2e",
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
});
