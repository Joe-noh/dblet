import { describe, expect, test } from "vitest";
import { defineConfig } from "@/config";

describe("defineConfig", () => {
  test("returns given config as-is", () => {
    const config = {
      db: {
        client: "pg" as const,
        connection: {
          database: "postgres",
        },
      },
    };

    expect(defineConfig(config)).toBe(config);
  });
});
