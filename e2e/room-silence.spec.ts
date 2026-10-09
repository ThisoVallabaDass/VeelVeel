import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
const fixture = path.resolve('.cache/room-hum.wav');
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${fixture}`,
    ],
  },
});
test.beforeAll(() => {
  mkdirSync(path.dirname(fixture), { recursive: true });
  const rate = 22050,
    count = rate * 3,
    wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    wav.writeInt16LE(
      Math.round(0.012 * 32767 * Math.sin((i * 2 * Math.PI * 80) / rate)),
      44 + i * 2,
    );
  writeFileSync(fixture, wav);
});
test('background hum without singing receives zero in an actual room round', async ({
  browser,
}) => {
  const host = await browser.newPage();
  await host.goto('/host?e2e=1');
  await host.getByLabel('Host as audience only').check();
  await host.getByRole('button', { name: /CREATE ROOM/ }).click();
  const code = (await host.locator('.room-code-bar strong').textContent())!.trim();
  const guests = [];
  for (const name of ['Quiet One', 'Quiet Two']) {
    const guest = await browser.newPage({ permissions: ['microphone'] });
    await guest.goto(`/j/${code}?e2e=1`);
    await guest.getByPlaceholder('Your name').fill(name);
    await guest.getByRole('button', { name: /JOIN AS SINGER/ }).click();
    await guest.getByRole('button', { name: /CONNECT MICROPHONE/ }).click();
    await expect(guest.getByRole('button', { name: /MIC CONNECTED/ })).toBeVisible();
    await guest.getByRole('button', { name: /I AM READY/ }).click();
    guests.push(guest);
  }
  await host.getByRole('button', { name: /START THE SHOW/ }).click();
  await expect(guests[0]!.getByText('● REC · MICROPHONE ON')).toBeVisible({ timeout: 25000 });
  await expect(guests[0]!.getByText('No sound detected — sing closer to your mic')).toBeVisible();
  await expect(host.getByText('THE SCORES.')).toBeVisible({ timeout: 45000 });
  for (const result of await host.locator('.room-result-body > div:first-child small').all())
    await expect(result).toHaveText('0 PTS TOTAL · 0 THIS ROUND');
  await expect(host.locator('.room-result')).toHaveCount(2);
  await Promise.all([host.close(), ...guests.map((p) => p.close())]);
});
