import { expect, test } from '@playwright/test';
import type { Page, Browser } from '@playwright/test';

async function room(browser: Browser, hostAsAudience = true) {
  const host = await browser.newPage({ ignoreHTTPSErrors: true });
  await host.goto('/host?e2e=1');
  if (hostAsAudience) await host.getByLabel('Host as audience only').check();
  await host.getByRole('button', { name: /CREATE ROOM/ }).click();
  const code = (await host.locator('.room-code-bar strong').textContent())!.trim();
  return { host, code };
}
async function singer(browser: Browser, code: string, name: string) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, permissions: ['microphone'], viewport: { width: 390, height: 844 } });
  await page.goto(`/j/${code}?e2e=1`);
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: /JOIN AS SINGER/ }).click();
  await page.getByRole('button', { name: /CONNECT MICROPHONE/ }).click();
  await expect(page.getByRole('button', { name: /MIC CONNECTED/ })).toBeVisible();
  await page.getByRole('button', { name: /I AM READY/ }).click();
  return page;
}
test('two singers automatically listen, record, hear each take, then see scores', async ({ browser }) => {
  test.setTimeout(360000);
  const { host, code } = await room(browser);
  await host.getByRole('combobox', { name: 'ROUNDS', exact: true }).selectOption('15');
  await host.getByRole('combobox', { name: 'ROUNDS', exact: true }).selectOption('7');
  await host.getByRole('combobox', { name: 'ROUNDS', exact: true }).selectOption('10');
  await host.getByRole('combobox', { name: 'ROUNDS', exact: true }).selectOption('15');
  const first = await singer(browser, code, 'Anbu');
  await expect(host.getByRole('button', { name: /START THE SHOW/ })).toBeDisabled();
  const second = await singer(browser, code, 'Maya');
  await first.reload();
  await first.getByRole('button', { name: /CONNECT MICROPHONE/ }).click();
  await first.getByRole('button', { name: /I AM READY/ }).click();
  await first.getByLabel('Voice mode').selectOption('push');
  await expect(host.getByRole('combobox', { name: 'ROUNDS', exact: true })).toHaveValue('15');
  await host.getByRole('combobox', { name: 'ROUNDS', exact: true }).selectOption('5');
  await host.getByRole('button', { name: /START THE SHOW/ }).click();
  await expect(first.getByRole('button', { name: /HOLD TO TALK/ })).toBeDisabled();
  await Promise.all([
    expect(first.getByText('● REC · MICROPHONE ON')).toBeVisible({ timeout: 25000 }),
    expect(second.getByText('● REC · MICROPHONE ON')).toBeVisible({ timeout: 25000 }),
  ]);
  await expect(first.getByRole('region', { name: 'Recording studio' })).toBeInViewport();
  await first.screenshot({ path: '.cache/recording-mobile.png', fullPage: true });
  await expect(first.getByText('✓ TAKE SAVED FOR THIS ROUND', { exact: true })).toBeVisible({ timeout: 25000 });
  await expect(first.getByRole('region', { name: 'Take comparison' })).toBeVisible({ timeout: 20000 });
  await expect(first.getByRole('button', { name: /HOLD TO TALK/ })).toBeEnabled();
  await expect(first.getByText('THE SCORES.')).toBeVisible({ timeout: 35000 });
  await expect(second.getByText('THE SCORES.')).toBeVisible();
  await expect(first.locator('.room-judges')).toHaveCount(2);
  await expect(first.locator('.room-judges').first()).toContainText('RHYTHM');
  await host.screenshot({ path: 'docs/screens/14-party-reveal.png', fullPage: true });
  await expect(host.locator('.round-intermission')).toContainText('NEXT SOUND');
  await expect(first.getByText(/ROUND 02/)).toBeVisible({ timeout: 15000 });
  await expect(first.getByRole('button', { name: /HOLD TO TALK/ })).toBeDisabled();
  for (let round = 2; round <= 5; round++) {
    await expect(first.getByText(new RegExp(`ROUND 0${round}`))).toBeVisible({ timeout: 15000 });
    await expect(first.getByText('THE SCORES.')).toBeVisible({ timeout: 90000 });
    await expect(host.locator('.round-intermission')).toContainText(round === 5 ? 'FINAL PODIUM' : 'NEXT SOUND');
  }
  await expect(first.getByText('THE FINAL PODIUM', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(second.getByText('THE FINAL PODIUM', { exact: true })).toBeVisible();
  await Promise.all([host.close(), first.close(), second.close()]);
});

test('host singer needs a friend and five seats is the maximum', async ({ browser }) => {
  const { host, code } = await room(browser, false);
  await expect(host.getByText('Host · HOST')).toBeVisible();
  await host.getByRole('button', { name: /CONNECT MICROPHONE/ }).click();
  await host.getByRole('button', { name: /I AM READY/ }).click();
  await expect(host.getByRole('button', { name: /START THE SHOW/ })).toBeDisabled();
  const guests: Page[] = [];
  for (let i = 0; i < 4; i++) guests.push(await singer(browser, code, `Singer ${i}`));
  await expect(host.getByRole('button', { name: /START THE SHOW/ })).toBeEnabled();
  const extra = await browser.newPage({ ignoreHTTPSErrors: true });
  await extra.goto(`/j/${code}?e2e=1`);
  await extra.getByPlaceholder('Your name').fill('Sixth singer');
  await extra.getByRole('button', { name: /JOIN AS SINGER/ }).click();
  await expect(extra.getByRole('alert')).toContainText('five singers');
  await extra.getByLabel('Audience').check();
  await extra.getByRole('button', { name: /JOIN AS AUDIENCE/ }).click();
  await expect(extra.getByText('YOU ARE IN THE AUDIENCE')).toBeVisible();
  await host.getByRole('button', { name: /START THE SHOW/ }).click();
  await expect(host.getByText('● REC · MICROPHONE ON')).toBeVisible({ timeout: 25000 });
  await expect(host.getByText('THE SCORES.')).toBeVisible({ timeout: 65000 });
  await expect(host.locator('.room-judges')).toHaveCount(5);
  await Promise.all([host.close(), extra.close(), ...guests.map((p) => p.close())]);
});

test('mobile invite lets an audience member watch without microphone or singer seat', async ({ browser }) => {
  const { host, code } = await room(browser, false);
  const mobile = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const viewer = await mobile.newPage();
  await viewer.goto(`/j/${code}?e2e=1`);
  await viewer.getByPlaceholder('Your name').fill('Fan');
  await viewer.getByLabel('Audience').check();
  await viewer.getByRole('button', { name: /JOIN AS AUDIENCE/ }).click();
  await expect(viewer.getByText('YOU ARE IN THE AUDIENCE')).toBeVisible();
  await expect(viewer.getByRole('button', { name: /I AM READY/ })).toHaveCount(0);
  await expect(viewer.locator('.room-code-bar')).toContainText('1 WATCHING');
  await expect.poll(() => viewer.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await viewer.screenshot({ path: '.cache/mobile-audience.png', fullPage: true });
  await viewer.reload();
  await expect(viewer.getByText('YOU ARE IN THE AUDIENCE')).toBeVisible();
  await Promise.all([host.close(), mobile.close()]);
});

test('expired host room can be replaced with a new room', async ({ browser }) => {
  const host = await browser.newPage({ ignoreHTTPSErrors: true });
  await host.addInitScript(() => sessionStorage.setItem('veel-room-host', JSON.stringify({ code: 'ZZZZ', token: 'x'.repeat(32) })));
  await host.goto('/host?e2e=1');
  await expect(host.getByRole('button', { name: /CREATE ROOM/ })).toBeEnabled();
  await expect(host.getByRole('button', { name: /RECONNECT TO ROOM/ })).toHaveCount(0);
  await host.getByRole('button', { name: /CREATE ROOM/ }).click();
  await expect(host.locator('.room-code-bar strong')).toBeVisible();
  await host.close();
});
