import { test, expect, type Page } from '@playwright/test';

async function expectOnlySelectedRow(page: Page, paperHref: string) {
  const rows = page.locator('[data-paper-row]');
  await expect(rows.first()).toBeVisible();
  await expect(rows.filter({ has: page.locator('a[href="' + paperHref + '"]') })).toBeVisible();
  for (let index = 1; index < (await rows.count()); index += 1) {
    await expect(rows.nth(index)).toBeHidden();
  }
  await expect(page.locator('[data-local-count]')).toHaveAttribute('data-count-value', '1');
}

async function expectNoRows(page: Page) {
  const rows = page.locator('[data-paper-row]');
  for (let index = 0; index < (await rows.count()); index += 1) {
    await expect(rows.nth(index)).toBeHidden();
  }
  await expect(page.locator('[data-local-count]')).toHaveAttribute('data-count-value', '0');
  await expect(page.locator('[data-local-empty]')).toBeVisible();
}

test('local Deep Read and Favorite state persists, filters, and is namespaced', async ({
  page,
}) => {
  await page.goto('/paper-pool/');
  const rows = page.locator('[data-paper-row]');
  if ((await rows.count()) === 0) test.skip();
  const paperHref = await rows.first().locator('a[href*="/papers/"]').first().getAttribute('href');
  expect(paperHref).toBeTruthy();
  await page.goto(paperHref!);
  await page.locator('[data-read-detail]').click();
  await expect(page.locator('[data-local-paper-state]')).toBeVisible();
  await page.locator('[data-local-field="deep_read"]').check();
  await page.locator('[data-local-field="favorite"]').check();
  await page.reload();
  await expect(page.locator('[data-local-field="deep_read"]')).toBeChecked();
  await expect(page.locator('[data-local-field="favorite"]')).toBeChecked();

  await page.goto('/deep-read/');
  await expectOnlySelectedRow(page, paperHref!);
  await page.reload();
  await expectOnlySelectedRow(page, paperHref!);
  await page.goto('/favorites/');
  await expectOnlySelectedRow(page, paperHref!);
  await page.reload();
  await expectOnlySelectedRow(page, paperHref!);

  await page.goto(paperHref!);
  await page.locator('[data-read-detail]').click();
  await page.locator('[data-local-field="deep_read"]').uncheck();
  await page.locator('[data-local-field="favorite"]').uncheck();
  await page.goto('/deep-read/');
  await expectNoRows(page);
  await page.reload();
  await expectNoRows(page);
  await page.goto('/favorites/');
  await expectNoRows(page);

  const namespace = await page.locator('html').getAttribute('data-state-namespace');
  expect(namespace).toBeTruthy();
  const key = 'research-library-local-state:' + namespace;
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toContain(
    'deep_read',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('research-library-local-state:/other/')),
  ).toBeNull();
});
