import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "browser-performance.test.mjs",
  timeout: 150_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: process.env.STATIC_SITE_URL || "http://127.0.0.1:43173",
    navigationTimeout: 90_000,
    launchOptions: { args: ["--no-proxy-server"] },
    trace: "retain-on-failure"
  },
  webServer: process.env.STATIC_SITE_URL
    ? undefined
    : {
        command: "python -m http.server 43173 --directory public/static-site",
        url: "http://127.0.0.1:43173/",
        reuseExistingServer: false
      }
});
