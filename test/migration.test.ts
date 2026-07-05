import { describe, expect, test } from "vitest";
import { generateTimestamp } from "@/migration";

describe("generateTimestamp", () => {
  test("returns timestamp string", () => {
    expect(generateTimestamp(new Date("2026-07-05T08:58:30Z"))).toBe("20260705085830");
  });
});
