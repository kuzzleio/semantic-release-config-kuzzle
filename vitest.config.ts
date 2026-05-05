import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
