import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const IMPORT_PATTERNS = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
];

// Follows relative imports from `file` and returns every non-relative specifier.
function collectImports(file: string, seen = new Set<string>()): Set<string> {
  const specifiers = new Set<string>();

  if (seen.has(file)) {
    return specifiers;
  }
  seen.add(file);

  const source = readFileSync(file, "utf8");

  for (const pattern of IMPORT_PATTERNS) {
    for (const [, specifier] of source.matchAll(pattern)) {
      if (specifier.startsWith(".")) {
        for (const nested of collectImports(join(dirname(file), specifier), seen)) {
          specifiers.add(nested);
        }
      } else {
        specifiers.add(specifier);
      }
    }
  }

  return specifiers;
}

test("workerd condition points to the workerd entry", () => {
  const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));

  expect(pkg.exports["."].workerd).toBe("./dist/index.workerd.mjs");
});

test("workerd entry does not import node-only modules", () => {
  const specifiers = [...collectImports(join(rootDir, "dist/index.workerd.mjs"))];

  expect(specifiers.filter((s) => /^(jiti|node:fs|node:path)/.test(s))).toEqual([]);
});
