import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const screenshots = path.resolve(process.cwd(), 'docs/screens');
mkdirSync(screenshots, { recursive: true });

test('five-round Mic Drop and festival/theatre theme screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto('/?quality=low&e2e=1');
  await expect(page.getByText(/TAMIL PACK|MEME MIX/)).toBeVisible();
  await page.screenshot({ path: path.join(screenshots, '01-home.png'), fullPage: true });

  await page.getByRole('button', { name: /PLAY LOCAL/ }).click();
  await expect(page.getByRole('heading', { name: 'MIC CHECK' })).toBeVisible();
  await page.getByRole('button', { name: /CONNECT MIC/ }).click();
  await expect(page.getByLabel('Choose microphone')).toContainText('Microphone connected', {
    timeout: 10_000,
  });
  await page.screenshot({ path: path.join(screenshots, '02-mic-setup.png'), fullPage: true });
  await page.getByRole('button', { name: /CALIBRATE ROOM NOISE/ }).click();
  await expect(page.getByRole('button', { name: /ROOM CALIBRATED/ })).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole('button', { name: /TEST MY VOICE/ }).click();
  await expect(page.getByRole('button', { name: /READY UP/ })).toBeEnabled({ timeout: 8_000 });
  await page.getByRole('button', { name: /READY UP/ }).click();
  await page.screenshot({ path: path.join(screenshots, '03-lobby.png'), fullPage: true });
  await page.locator('input[type="checkbox"]').uncheck({ force: true });
  await page.getByRole('button', { name: /LET'S PLAY/ }).click();
  await expect(page.getByText(/THE SOUND/)).toBeVisible();
  await page.screenshot({ path: path.join(screenshots, '05-hud-listen.png'), fullPage: true });

  for (let round = 0; round < 5; round += 1) {
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible({
      timeout: 25_000,
    });
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByText(/THE JUDGES HAVE SPOKEN/)).toBeVisible({ timeout: 25_000 });
    if (round === 0) {
      // Fake capture loops continuously through calibration and listening, so
      // this take starts partway through the clip and passes through the noise
      // filter. Exact aligned source identity is covered at 95+ in DSP tests.
      await expect(page.locator('.big-score')).toContainText(/^([89]\d|100)/);
      await page.getByRole('button', { name: /REPLAY THE ROAST/ }).click();
      await page.getByRole('button', { name: /HEAR .* BOT TAKE/ }).click();
      await page.getByRole('button', { name: '✦ GOLDEN BUZZER' }).click();
      await expect(page.locator('.big-score')).toContainText(/^100/);
    }
    if (round === 1)
      await expect(page.getByRole('button', { name: /USED THIS GAME/ })).toBeDisabled();
    if (round === 0)
      await page.screenshot({
        path: path.join(screenshots, '06-judge-reveal.png'),
        fullPage: true,
      });
    await page.getByRole('button', { name: round === 4 ? /SEE THE PODIUM/ : /ONCE MORE/ }).click();
  }
  await expect(page.getByText(/ABSOLUTE/)).toBeVisible();
  await page.screenshot({ path: path.join(screenshots, '07-podium.png'), fullPage: true });
  await page.goto('/arena?quality=low&e2e=1');
  await expect(page.getByRole('heading', { name: /TEST DRIVE/ })).toBeVisible();
  await page.screenshot({ path: path.join(screenshots, '04-arena-festival.png'), fullPage: true });
  await page.getByRole('button', { name: /FDFS Theatre/ }).click();
  await page.screenshot({ path: path.join(screenshots, '08-arena-theatre.png'), fullPage: true });
});
