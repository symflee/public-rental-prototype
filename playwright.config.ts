import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseUrl = `http://localhost:${port}`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: baseUrl,
    trace: "off",
  },
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: baseUrl,
    reuseExistingServer,
  },
});
