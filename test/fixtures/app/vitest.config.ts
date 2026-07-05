import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["dblet/vitest-global"],
    setupFiles: ["dblet/vitest"],
  },
});
