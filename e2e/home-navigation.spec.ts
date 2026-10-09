import { expect, test } from '@playwright/test';

test('home leads with room play and remembers the venue', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto('/?quality=low&e2e=1');
  await expect(page.getByRole('button', { name: /PLAY LOCAL/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /HOST ROOM/ })).toBeVisible();
  await page.getByRole('button', { name: /Theatre/ }).click();
  await expect(page.getByRole('button', { name: /Theatre/ })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: /Theatre/ })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'docs/screens/01-home.png', fullPage: true });
  await page.getByRole('button', { name: /HOST ROOM/ }).click();
  await expect(page).toHaveURL(/\/host$/);
  await expect(page.getByRole('button', { name: /CREATE ROOM/ })).toBeVisible();
});

test('room-first home layout fits a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?quality=low&e2e=1');
  await expect(page.getByRole('button', { name: /HOST ROOM/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /JOIN ROOM/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.cache/mobile-home.png', fullPage: true });
});
