import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/index.workerd.ts",
    "src/kysely.ts",
    "src/vitest.ts",
    "src/vitest-global.ts",
    "src/cli.ts",
  ],
  format: "esm",
  platform: "node",
  dts: true,
  clean: true,
});
