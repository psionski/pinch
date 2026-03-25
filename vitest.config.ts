import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    exclude: ["e2e/**", "node_modules/**", ".next/**", "dist/**"],
    pool: "forks",
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/lib/db/**", "src/lib/api/**", "src/lib/mcp/**"],
      reporter: [["text", { maxCols: 200 }], "html"],
      reportsDirectory: "./coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
