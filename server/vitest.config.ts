import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // A stray dist/ from `npm run build` would otherwise get picked up
    // alongside the TS sources and double-run every test.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
