import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "virtual:terminal": path.resolve(
        import.meta.dirname,
        "src/__mocks__/virtual-terminal.ts",
      ),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
