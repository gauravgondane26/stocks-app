import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fromRoot("./") },
      // server-only throws outside React Server Components. Its react-server build
      // is an empty module, which is what server code gets in the real app.
      { find: /^server-only$/, replacement: fromRoot("./node_modules/server-only/empty.js") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
