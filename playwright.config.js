import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.js",
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: "http://localhost:4180",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4180",
    url: "http://localhost:4180",
    reuseExistingServer: true,
  },
});
