import { mkdirSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export default function setup() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const nodeModules = join(root, "test/fixtures/app/node_modules");

  mkdirSync(nodeModules, { recursive: true });

  try {
    symlinkSync(root, join(nodeModules, "dblet"), "dir");
  } catch (error) {
    if ((error as { code: string }).code !== "EEXIST") {
      throw error;
    }
  }
}
