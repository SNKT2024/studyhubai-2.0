import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Absolute repo root, with forward slashes so the alias works on Windows too. */
const root = fileURLToPath(new URL("./", import.meta.url)).replace(/\\/g, "/");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // A few tests build multi-megabyte request bodies; the default 5s is tight on a cold run.
    testTimeout: 20_000,
  },
  resolve: {
    alias: [
      // Mirrors the `"@/*": ["./*"]` mapping in tsconfig.json. A regex keeps `@scope/pkg`
      // specifiers from ever being caught by it.
      { find: /^@\//, replacement: root },
      // Next resolves `server-only` internally; outside Next it would be an unresolved import.
      { find: "server-only", replacement: `${root}tests/stubs/server-only.ts` },
    ],
  },
});
