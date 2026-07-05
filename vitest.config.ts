import { resolve } from "node:path";
import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...defaultExclude, "**/fixtures/**"],
    globalSetup: ["test/global-setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
