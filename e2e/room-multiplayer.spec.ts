import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const screenshots = path.resolve(process.cwd(), 'docs/screens');
mkdirSync(screenshots, { recursive: true });
const saveDocumentationScreens = !process.env.VEEL_E2E_BASE_URL;

test('host and two phones complete a scored room round', async ({ browser }) => {
  const host = await browser.newPage({ ignoreHTTPSErrors: true });
  const singerOne = await browser.newPage({ ignoreHTTPSErrors: true, permissions: ['microphone'], viewport: { width: 390, height: 844 } });
  const singerTwo = await browser.newPage({ ignoreHTTPSErrors: true, permissions: ['microphone'], viewport: { width: 390, height: 844 } });
  await host.goto('/host');
  await host.getByRole('button', { name: /CREATE ROOM/ }).click();
  const code = (await host.locator('.room-code-bar strong').textContent())!.trim();
  expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  await expect(host.getByRole('img', { name: `Scan to join room ${code}` })).toBeVisible();

  for (const [page, name] of [[singerOne, 'Anbu'], [singerTwo, 'Maya']] as const) {
    await page.goto(`/j/${code}`);
    await page.getByPlaceholder('Your name').fill(name);
    await page.getByRole('button', { name: /JOIN ROOM/ }).click();
    await expect(page.getByText('THE LINEUP.')).toBeVisible();
    await page.getByRole('button', { name: /CONNECT MICROPHONE/ }).click();
    await expect(page.getByRole('button', { name: /MIC CONNECTED/ })).toBeVisible();
    await page.getByRole('button', { name: /I AM READY/ }).click();
  }
  if (saveDocumentationScreens) {
    await host.screenshot({ path: path.join(screenshots, '09-room-host.png'), fullPage: true });
    await singerOne.screenshot({ path: path.join(screenshots, '10-room-phone.png'), fullPage: true });
  }
  await singerOne.reload();
  await expect(singerOne.getByRole('button', { name: /CONNECT MICROPHONE/ })).toBeVisible({ timeout: 10_000 });
  await singerOne.getByRole('button', { name: /CONNECT MICROPHONE/ }).click();
  await singerOne.getByRole('button', { name: /I AM READY/ }).click();
  await expect(host.locator('.room-player')).toHaveCount(2);
  await expect(host.getByText('READY ✓')).toHaveCount(2);
  await host.getByRole('button', { name: /START THE SHOW/ }).click();
  await expect(singerOne.getByRole('button', { name: /START SINGING/ })).toBeVisible();
  await singerOne.getByRole('button', { name: /START SINGING/ }).click();
  await singerTwo.getByRole('button', { name: /START SINGING/ }).click();
  await expect(singerOne.getByRole('button', { name: /TAKE SENT/ })).toBeVisible({ timeout: 25_000 });
  await expect(singerTwo.getByRole('button', { name: /TAKE SENT/ })).toBeVisible({ timeout: 25_000 });
  await expect(host.locator('.room-player', { hasText: 'PTS' })).toHaveCount(2, { timeout: 25_000 });
  await expect(host.locator('.room-player').first().locator('small')).toContainText(/^(9\d|100) PTS/);
  await host.getByRole('button', { name: /REVEAL SCORES/ }).click();
  await expect(singerOne.getByText('THE SCORES.')).toBeVisible();
  await expect(singerTwo.getByText('THE SCORES.')).toBeVisible();
  await expect(host.locator('.room-player', { hasText: 'PTS' })).toHaveCount(2);
  await expect(singerOne.locator('.room-judges')).toHaveCount(2);
  await expect(singerOne.locator('.room-judges').first()).toContainText('RHYTHM');
  await expect(singerOne.locator('.room-judges').first()).toContainText('MELODY');
  if (saveDocumentationScreens)
    await singerOne.screenshot({ path: path.join(screenshots, '11-room-judges.png'), fullPage: true });
  await host.close();
  await singerOne.close();
  await singerTwo.close();
});

test('take-turns mode moves the microphone to the next singer after scoring', async ({ browser }) => {
  const host = await browser.newPage({ ignoreHTTPSErrors: true });
  const first = await browser.newPage({ ignoreHTTPSErrors: true, permissions: ['microphone'] });
  const second = await browser.newPage({ ignoreHTTPSErrors: true, permissions: ['microphone'] });
  await host.goto('/host');
  await host.getByRole('button', { name: /CREATE ROOM/ }).click();
  const code = (await host.locator('.room-code-bar strong').textContent())!.trim();
  for (const [page, name] of [[first, 'Anbu'], [second, 'Maya']] as const) {
    await page.goto(`/j/${code}`);
    await page.getByPlaceholder('Your name').fill(name);
    await page.getByRole('button', { name: /JOIN ROOM/ }).click();
    await page.getByRole('button', { name: /CONNECT MICROPHONE/ }).click();
    await expect(page.getByRole('button', { name: /MIC CONNECTED/ })).toBeVisible();
    await page.getByRole('button', { name: /I AM READY/ }).click();
  }
  await host.getByLabel('SINGING ORDER').selectOption('turns');
  await host.getByRole('button', { name: /START THE SHOW/ }).click();
  await expect(first.getByRole('button', { name: /START SINGING/ })).toBeEnabled();
  await expect(second.getByRole('button', { name: /WAIT FOR YOUR TURN/ })).toBeDisabled();
  await first.getByRole('button', { name: /START SINGING/ }).click();
  await first.waitForTimeout(1200);
  await first.getByRole('button', { name: /FINISH TAKE/ }).click();
  await expect(second.getByRole('button', { name: /START SINGING/ })).toBeEnabled({ timeout: 20_000 });
  await expect(host.getByText('ON THE MIC 🎙')).toBeVisible();
  await host.close();
  await first.close();
  await second.close();
});

test('host joins as a singer and starts a solo room', async ({ browser }) => {
  const host = await browser.newPage({ ignoreHTTPSErrors: true, permissions: ['microphone'] });
  await host.goto('/host');
  await host.getByRole('button', { name: /CREATE ROOM/ }).click();
  await expect(host.getByRole('button', { name: /START THE SHOW/ })).toBeDisabled();
  await host.getByRole('button', { name: /JOIN AS SINGER/ }).click();
  await expect(host.getByText('YOU ARE IN THE LINEUP')).toBeVisible();
  await host.reload();
  await expect(host.getByText('YOU ARE IN THE LINEUP')).toBeVisible();
  await host.getByRole('button', { name: /CONNECT MICROPHONE/ }).click();
  await expect(host.getByRole('button', { name: /MIC CONNECTED/ })).toBeVisible();
  await host.getByRole('button', { name: /I AM READY/ }).click();
  await expect(host.getByRole('button', { name: /START THE SHOW/ })).toBeEnabled();
  if (saveDocumentationScreens)
    await host.screenshot({ path: path.join(screenshots, '12-room-host-singer.png'), fullPage: true });
  await host.getByRole('button', { name: /START THE SHOW/ }).click();
  await expect(host.locator('.room-stage .arena-canvas')).toBeVisible();
  await expect.poll(() => host.locator('.room-stage').evaluate((stage) => {
    const bounds = stage.getBoundingClientRect();
    const canvas = stage.querySelector('.arena-canvas')?.getBoundingClientRect();
    return Boolean(canvas && Math.abs(canvas.top - bounds.top) < 3 && Math.abs(canvas.left - bounds.left) < 3);
  })).toBe(true);
  await host.getByRole('button', { name: /START SINGING/ }).click();
  await expect(host.getByRole('button', { name: /TAKE SENT/ })).toBeVisible({ timeout: 25_000 });
  await expect(host.locator('.room-player small')).toContainText(/\d+ PTS/);
  await host.getByRole('button', { name: /REVEAL SCORES/ }).click();
  await expect(host.locator('.room-judges')).toHaveCount(1);
  if (saveDocumentationScreens)
    await host.screenshot({ path: path.join(screenshots, '13-room-host-score.png'), fullPage: true });
  await host.close();
});

test('expired host room can be replaced with a new room', async ({ browser }) => {
  const host = await browser.newPage({ ignoreHTTPSErrors: true });
  await host.addInitScript(() => sessionStorage.setItem('veel-room-host',
    JSON.stringify({ code: 'ZZZZ', token: 'x'.repeat(32) })));
  await host.goto('/host');
  await expect(host.getByRole('button', { name: /CREATE ROOM/ })).toBeEnabled();
  await expect(host.getByRole('button', { name: /RECONNECT TO ROOM/ })).toHaveCount(0);
  await host.getByRole('button', { name: /CREATE ROOM/ }).click();
  await expect(host.locator('.room-code-bar strong')).toBeVisible();
  await host.close();
});
