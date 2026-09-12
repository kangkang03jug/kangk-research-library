import { test, expect } from '@playwright/test';

test('reference library reading and paper-pool interactions work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'KangK Research Library' })).toBeVisible();
  await page.getByRole('link', { name: 'Paper Pool' }).click();
  await expect(page.getByRole('heading', { name: 'Paper Pool' })).toBeVisible();
  await expect(
    page.getByText('SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering'),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('SWE-agent');
  await expect(page.getByText('1 paper')).toBeVisible();
  await page.getByLabel('Topic').selectOption('Coding Agents');
  await expect(
    page.getByText('SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering'),
  ).toBeVisible();
  await page.getByRole('link', { name: /SWE-agent:/ }).click();
  await expect(page.getByRole('heading', { name: 'Quick Read' })).toBeVisible();
  await page.getByRole('button', { name: 'Read Detail' }).click();
  await expect(page.getByRole('heading', { name: 'Research Questions' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Original Abstract' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText(/Owner editing is disabled/)).toBeVisible();
});

test('reference library is usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/papers/swe-agent-agent-computer-interfaces/');
  await expect(page.getByRole('heading', { name: 'Quick Read' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible');
});
