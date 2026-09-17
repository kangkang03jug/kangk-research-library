import { test, expect } from '@playwright/test';

test('local Deep Read and Favorite state persists, filters, and is namespaced', async ({ page }) => {
  await page.goto('/paper-pool/');
  const rows = page.locator('[data-paper-row]');
  if ((await rows.count()) === 0) test.skip();
  const paperHref = await rows.first().locator('a[href*="/papers/"]').first().getAttribute('href');
  expect(paperHref).toBeTruthy();
  await page.goto(paperHref!);
  await page.locator('[data-local-field="deep_read"]').check();
  await page.locator('[data-local-field="favorite"]').check();
  await page.reload();
  await expect(page.locator('[data-local-field="deep_read"]')).toBeChecked();
  await expect(page.locator('[data-local-field="favorite"]')).toBeChecked();

  await page.goto('/deep-read/');
  await expect(page.locator('[data-paper-row]').filter({ has: page.locator('a[href="' + paperHref + '"]') })).toBeVisible();
  await page.goto('/favorites/');
  await expect(page.locator('[data-paper-row]').filter({ has: page.locator('a[href="' + paperHref + '"]') })).toBeVisible();

  const namespace = await page.locator('html').getAttribute('data-state-namespace');
  expect(namespace).toBeTruthy();
  const key = 'research-library-local-state:' + namespace;
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toContain(
    'deep_read',
  );
  expect(await page.evaluate(() => localStorage.getItem('research-library-local-state:/other/'))).toBeNull();
});

