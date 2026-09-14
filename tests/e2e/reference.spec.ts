import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const paper = JSON.parse(
  readFileSync('data/papers/swe-agent-agent-computer-interfaces.json', 'utf8'),
);
const userState = JSON.parse(
  readFileSync('data/user/swe-agent-agent-computer-interfaces.json', 'utf8'),
);

test('home hero stays on one desktop line and localizes cleanly', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const heroTitle = page.locator('.hero h1');
  await expect(heroTitle).toHaveText('KangK Research Library');
  await expect(
    page.getByText(
      '一个持续更新的个人研究知识库，用于整理论文、记录阅读进展，并沉淀长期研究笔记与思考。',
      { exact: true },
    ),
  ).toBeVisible();
  const titleMetrics = await heroTitle.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(style.lineHeight),
      whiteSpace: style.whiteSpace,
    };
  });
  expect(titleMetrics.whiteSpace).toBe('nowrap');
  expect(titleMetrics.height).toBeLessThan(titleMetrics.lineHeight * 1.25);
  await page.getByRole('button', { name: '切换为 English' }).click();
  await expect(
    page.getByText(
      'A continuously evolving personal research knowledge base for organizing papers, tracking reading progress, and accumulating long-term research notes and reflections.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Switch to Chinese' }).click();
  await expect(
    page.getByText(
      '一个持续更新的个人研究知识库，用于整理论文、记录阅读进展，并沉淀长期研究笔记与思考。',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '论文池', exact: true })).toBeVisible();
});

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
  const chineseSummary = page
    .locator('.quick-read')
    .getByText(/SWE-agent 研究语言模型与软件仓库之间的交互界面如何影响 Agent 能力/);
  await expect(chineseSummary).toBeVisible();
  await page.getByRole('button', { name: '阅读详情 ↓' }).click();
  await expect(page.getByRole('heading', { name: '研究问题' })).toBeVisible();
  await expect(
    page
      .locator('#motivation')
      .getByText(
        /本文从一个关键观察出发：解决软件任务的语言模型 Agent 需要适合仓库级工作的交互界面/,
      ),
  ).toBeVisible();
  await expect(
    page.locator('#method').getByText(/SWE-agent 将语言模型与 Agent-Computer Interface 结合/),
  ).toBeVisible();
  await page.locator('.abstract summary').click();
  await expect(page.locator('.abstract p')).toContainText(
    'Language model (LM) agents are increasingly being used',
  );
  await page.getByRole('button', { name: '切换为 English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Quick Read' })).toBeVisible();
  await expect(chineseSummary).toBeVisible();
  await expect(page.locator('.abstract p')).toContainText(
    'Language model (LM) agents are increasingly being used',
  );
  await expect(page.getByRole('link', { name: 'Paper Pool', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to Chinese' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.getByRole('button', { name: '切换深色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('编辑后端当前不可用。公开页面继续保持只读。')).toBeVisible();
});

test('research question types and evidence limits are visible', async ({ page }) => {
  await page.goto('/papers/survey-code-generation-llm-agents/');
  for (const width of [1440, 1680]) {
    await page.setViewportSize({ width, height: 900 });
    const lines = await page.locator('.paper-head h1').evaluate((element) => {
      const text = element.firstChild;
      if (!text) return [];
      const value = text.textContent || '';
      const groups = new Map<number, number>();
      for (const word of value.split(/\s+/u).filter(Boolean)) {
        const start = value.indexOf(word);
        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, start + word.length);
        const top = Math.round(range.getBoundingClientRect().top);
        groups.set(top, (groups.get(top) || 0) + 1);
      }
      return [...groups.values()];
    });
    expect(lines.length).toBeLessThanOrEqual(2);
    if (lines.length > 1) expect(lines.at(-1)).toBeGreaterThan(1);
  }
  await page.getByRole('button', { name: '阅读详情 ↓' }).click();
  await expect(page.getByText('隐含研究问题 / Inferred Research Question')).toBeVisible();
  await expect(
    page.locator('.rq dd').filter({ hasText: 'Sec. 1; Sec. 2.1 Literature Collection' }),
  ).toBeVisible();

  await page.goto('/papers/swe-agent-agent-computer-interfaces/');
  await page.getByRole('button', { name: '阅读详情 ↓' }).click();
  await expect(
    page.getByText('当前阅读依据未覆盖 Introduction / Motivation，无法可靠推断研究问题。'),
  ).toBeVisible();
});

test('owner editor authenticates once and writes user state and summary with SHAs', async ({
  page,
}) => {
  const requests: Array<Record<string, unknown>> = [];
  let expectedSession = 'signed-owner-session';
  await page.addInitScript(() =>
    sessionStorage.setItem('research-library-editor-session', 'signed-owner-session'),
  );
  await page.route('https://editor.test/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.headers().authorization).toBe(`Bearer ${expectedSession}`);
    if (url.pathname === '/api/me') {
      expectedSession = 'renewed-from-me';
      return route.fulfill({
        json: {
          authenticated: true,
          login: 'kangkang03jug',
          session: expectedSession,
        },
      });
    }
    if (url.pathname === '/api/content') {
      const path = url.searchParams.get('path');
      return route.fulfill({
        json: path?.startsWith('data/user/')
          ? { path, sha: 'user-sha', content: userState }
          : { path, sha: 'paper-sha', content: paper },
      });
    }
    if (url.pathname === '/api/update') {
      requests.push(request.postDataJSON());
      expectedSession = requests.length === 1 ? 'renewed-after-user' : 'renewed-after-paper';
      return route.fulfill({
        json: {
          ok: true,
          sha: requests.length === 1 ? 'new-user-sha' : 'new-paper-sha',
          commitUrl: `https://github.com/example/commit/${requests.length}`,
          session: expectedSession,
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: 'Not found' } });
  });

  await page.goto('/papers/swe-agent-agent-computer-interfaces/');
  await expect(page.getByText('@kangkang03jug')).toBeVisible();
  await expect(page.getByText('已验证 GitHub Owner。可安全编辑并写回仓库。')).toBeVisible();
  await page.locator('[data-user-field="deep_read"]').check();
  await page.locator('[data-user-field="favorite"]').uncheck();
  await page.locator('[data-user-field="status"]').selectOption('Reading');
  await page.locator('[data-user-field="my_tags"]').fill('AI4SE, Agent, AI4SE');
  await page.locator('[data-user-field="my_notes"]').fill('精读时核对实验设置。');
  await page.getByRole('button', { name: '保存阅读状态与笔记' }).click();
  await expect(page.getByText(/保存成功。GitHub Pages workflow 已触发/)).toBeVisible();
  expect(requests[0]).toMatchObject({
    path: 'data/user/swe-agent-agent-computer-interfaces.json',
    sha: 'user-sha',
    patch: {
      deep_read: true,
      favorite: false,
      status: 'Reading',
      my_tags: ['AI4SE', 'Agent'],
      my_notes: '精读时核对实验设置。',
    },
  });

  await page.locator('[data-summary-editor] > summary').click();
  await page.locator('[data-summary-field="tldr"]').fill('经 Owner 核正的中文总结。');
  await page.getByRole('button', { name: '保存 AI 总结修正' }).click();
  await expect(page.getByText(/保存成功。GitHub Pages workflow 已触发/)).toBeVisible();
  expect(requests[1]).toMatchObject({
    path: 'data/papers/swe-agent-agent-computer-interfaces.json',
    sha: 'paper-sha',
    patch: { quick_read: { tldr: '经 Owner 核正的中文总结。' } },
  });
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('research-library-editor-session')))
    .toBe('renewed-after-paper');
  await expect(page.getByRole('link', { name: '查看 GitHub commit ↗' })).toBeVisible();
});

test('owner editor keeps visitors read-only and reports optimistic conflicts', async ({ page }) => {
  let authenticated = false;
  await page.route('https://editor.test/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/me')
      return route.fulfill({
        json: authenticated
          ? { authenticated: true, login: 'kangkang03jug' }
          : { authenticated: false },
      });
    if (url.pathname === '/api/content') {
      const path = url.searchParams.get('path');
      return route.fulfill({
        json: path?.startsWith('data/user/')
          ? { path, sha: 'stale-user-sha', content: userState }
          : { path, sha: 'paper-sha', content: paper },
      });
    }
    if (url.pathname === '/api/update')
      return route.fulfill({ status: 409, json: { error: 'Conflict' } });
    return route.fulfill({ status: 404, json: { error: 'Not found' } });
  });

  await page.goto('/papers/swe-agent-agent-computer-interfaces/');
  await expect(page.getByRole('button', { name: '使用 GitHub 登录' })).toBeVisible();
  await expect(page.locator('[data-user-editor]')).toBeHidden();

  authenticated = true;
  await page.addInitScript(() =>
    sessionStorage.setItem('research-library-editor-session', 'signed-owner-session'),
  );
  await page.reload();
  await expect(page.locator('[data-user-editor]')).toBeVisible();
  await page.getByRole('button', { name: '保存阅读状态与笔记' }).click();
  await expect(page.getByText(/保存冲突：仓库数据已变化/)).toBeVisible();
});

test('reference library is usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/papers/swe-agent-agent-computer-interfaces/');
  await expect(page.getByRole('heading', { name: '快速阅读' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible');
});
