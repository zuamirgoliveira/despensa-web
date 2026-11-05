import { defineConfig, devices } from "@playwright/test";

const PORTA = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${PORTA}`, trace: "retain-on-failure" },
  // Roda contra `next start` (exercita CSP e service worker). Exige `npm run build` antes.
  webServer: {
    command: `npx next start -p ${PORTA}`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } }],
});
