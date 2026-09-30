import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const root = process.cwd();
const pack = JSON.parse(readFileSync(path.join(root, 'packs/tamil-meme/pack.json'), 'utf8')) as {
  clips: Array<{ audio: string; defaultRotation: boolean }>;
};
const fakeMic = path.resolve(
  root,
  'packs/tamil-meme',
  pack.clips.find((clip) => clip.defaultRotation)?.audio ?? pack.clips[0]!.audio,
);
const baseURL = 'https://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  timeout: 180_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    ignoreHTTPSErrors: true,
    permissions: ['microphone'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--ignore-certificate-errors',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${fakeMic}`,
      ],
    },
  },
  webServer: [
    {
      command: 'pnpm --filter @veel-veel/server dev',
      port: 8787,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm --filter @veel-veel/client exec vite --config vite.config.ts --host 127.0.0.1 --port 5173 --strictPort',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
