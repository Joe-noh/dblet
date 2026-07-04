import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/vitest.ts"],
  format: "esm",
  platform: "node",
  dts: true,
  clean: true,
});
