import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { findConfigFile, defineConfig } from "@/config";

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
