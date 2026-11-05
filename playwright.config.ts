import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const Y4M = "test-results/camera-qr.y4m";

const PORTA = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${PORTA}`, trace: "retain-on-failure" },
  // Roda contra `next start` (exercita CSP e service worker). Exige `npm run build` antes.
  webServer: {
    command: `npx next start -p ${PORTA}`,
    url: `http://localhost:${PORTA}`,
    // Nunca reaproveita um servidor já em pé: ele poderia estar servindo um build antigo.
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        // Câmera simulada: aceita o pedido de permissão e usa o vídeo gerado no globalSetup.
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            ...(existsSync(Y4M) ? [`--use-file-for-fake-video-capture=${Y4M}`] : []),
          ],
        },
      },
    },
  ],
});
