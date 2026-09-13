import { test, expect } from '@playwright/test';

test('reference library reading, locale switching, and paper-pool interactions work', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'KangK Research Library' })).toBeVisible();
  await page.getByRole('link', { name: '论文池' }).click();
  await expect(page.getByRole('heading', { name: '论文池' })).toBeVisible();
  await expect(
    page.getByText('SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering'),
  ).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveAttribute(
    'placeholder',
    '搜索标题、方法、作者、笔记…',
  );
  await page.getByRole('searchbox').fill('SWE-agent');
  await expect(page.getByText('1 篇论文')).toBeVisible();
  await page.locator('[data-filter="topic"]').selectOption('Coding Agents');
  await page.getByRole('link', { name: /SWE-agent:/ }).click();
  await expect(page.getByRole('heading', { name: '快速阅读' })).toBeVisible();
  await page.getByRole('button', { name: '阅读详情 ↓' }).click();
  await expect(page.getByRole('heading', { name: '研究问题' })).toBeVisible();
  await page.getByRole('button', { name: '切换为 English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Quick Read' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Paper Pool', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to Chinese' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.getByRole('button', { name: '切换深色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page.getByText('配置经过身份验证的写入后端后才能启用所有者编辑。此公开站点保持只读。'),
  ).toBeVisible();
});

test('reference library is usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/papers/swe-agent-agent-computer-interfaces/');
  await expect(page.getByRole('heading', { name: '快速阅读' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible');
});
