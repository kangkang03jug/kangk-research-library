import { describe, expect, it } from 'vitest';
import worker, { configuredOwner, validPaperPatch, validUserPatch } from '../worker/src/index';

const env = {
  GITHUB_APP_ID: '1',
  GITHUB_APP_PRIVATE_KEY: 'unused',
  GITHUB_CLIENT_ID: 'client-id',
  GITHUB_CLIENT_SECRET: 'unused',
  SESSION_SECRET: 'test-session-secret',
  ALLOWED_ORIGIN: 'https://owner.github.io',
  GITHUB_INSTALLATION_ID: '2',
  GITHUB_REPOSITORY: 'owner/library',
};

describe('owner editor security boundaries', () => {
  it('reads the owner only from the Research Profile editor block', () => {
    expect(
      configuredOwner(
        `profile:\n  researcher: Example\neditor:\n  owner_github_username: 'paper-owner'\n  api_origin: ''\n`,
      ),
    ).toBe('paper-owner');
    expect(configuredOwner('profile:\n  researcher: Example\n')).toBe('');
  });

  it('allows only user-owned state fields', () => {
    expect(
      validUserPatch({
        deep_read: true,
        favorite: false,
        status: 'Reading',
        my_tags: ['Agent'],
        my_notes: 'Check the ablation.',
      }),
    ).toBe(true);
    expect(validUserPatch({ favorite: true, paper_id: 'replacement' })).toBe(false);
    expect(validUserPatch({ status: 'Deleted' })).toBe(false);
  });

  it('allows summary corrections but rejects metadata changes', () => {
    expect(
      validPaperPatch({
        quick_read: {
          tldr: '总结',
          problem_and_motivation: '问题',
          core_method: '方法',
          key_results: '结果',
          why_it_matters: '意义',
        },
        detail: {
          motivation: '动机',
          research_questions: [],
          method: '方法',
          experiments_and_key_findings: '实验',
          limitations: { author_reported: [], ai_analysis: ['分析'] },
          relation_to_research: '关系',
          what_can_be_done_next: '下一步',
        },
      }),
    ).toBe(true);
    expect(validPaperPatch({ title: 'Replacement title' })).toBe(false);
  });

  it('reports an unauthenticated session without contacting GitHub', async () => {
    const response = await worker.fetch(
      new Request('https://editor.example/api/me', {
        headers: { Origin: env.ALLOWED_ORIGIN },
      }),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });

  it('rejects foreign origins and return URLs', async () => {
    const foreign = await worker.fetch(
      new Request('https://editor.example/api/me', {
        headers: { Origin: 'https://attacker.example' },
      }),
      env,
    );
    expect(foreign.status).toBe(403);
    const badReturn = await worker.fetch(
      new Request('https://editor.example/auth/login?return_to=https://attacker.example/paper'),
      env,
    );
    expect(badReturn.status).toBe(400);
  });

  it('creates a state-bound GitHub login redirect for the configured site', async () => {
    const response = await worker.fetch(
      new Request(
        'https://editor.example/auth/login?return_to=https%3A%2F%2Fowner.github.io%2Flibrary%2Fpaper',
      ),
      env,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain(
      'https://github.com/login/oauth/authorize?client_id=client-id',
    );
    expect(response.headers.get('set-cookie')).toContain('rl_oauth_state=');
  });
});
