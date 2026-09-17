import { describe, expect, it } from 'vitest';
import worker, {
  SESSION_AGE_SECONDS,
  configuredOwner,
  createEditorSession,
  validPaperPatch,
  validCommentPayload,
  validUserPatch,
  verifyEditorSession,
} from '../worker/src/index';

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
  it('uses a revocable 90-day session lifetime', () => {
    expect(SESSION_AGE_SECONDS).toBe(90 * 24 * 60 * 60);
  });

  it('expires sessions and invalidates them when SESSION_SECRET rotates', async () => {
    const issuedAt = Date.UTC(2026, 8, 14);
    const session = await createEditorSession('paper-owner', 'original-secret', issuedAt);
    await expect(
      verifyEditorSession(session, 'original-secret', issuedAt + 1),
    ).resolves.toMatchObject({
      login: 'paper-owner',
      expiresAt: issuedAt + SESSION_AGE_SECONDS * 1000,
    });
    await expect(verifyEditorSession(session, 'rotated-secret', issuedAt + 1)).resolves.toBeNull();
    await expect(
      verifyEditorSession(session, 'original-secret', issuedAt + SESSION_AGE_SECONDS * 1000),
    ).resolves.toBeNull();
  });

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

  it('validates bounded, plain-text public comments', () => {
    expect(validCommentPayload({ paper_id: 'paper-a', nickname: '读者', body: '很有启发。' })).toBe(
      true,
    );
    expect(validCommentPayload({ paper_id: 'paper-a', nickname: '', body: 'x' })).toBe(false);
    expect(
      validCommentPayload({
        paper_id: 'paper-a',
        nickname: 'x',
        body: '<script>alert(1)</script>',
      }),
    ).toBe(true);
    expect(
      validCommentPayload({
        paper_id: 'paper-a',
        nickname: 'x',
        body: 'https://a.test https://b.test',
      }),
    ).toBe(false);
  });

  it('stores public comments through the configured D1 binding', async () => {
    const calls: unknown[][] = [];
    const commentsDb = {
      prepare: (query: string) => ({
        bind: (...values: unknown[]) => ({
          run: async () => {
            calls.push([query, ...values]);
          },
          all: async () => ({ results: [] }),
          first: async () => null,
          bind: (...nested: unknown[]) => ({
            run: async () => {
              calls.push([query, ...nested]);
            },
          }),
        }),
      }),
    };
    const response = await worker.fetch(
      new Request('https://editor.example/api/comments', {
        method: 'POST',
        headers: {
          Origin: env.ALLOWED_ORIGIN,
          'content-type': 'application/json',
          'CF-Connecting-IP': '127.0.0.1',
        },
        body: JSON.stringify({ paper_id: 'paper-a', nickname: '读者', body: '值得复现实验。' }),
      }),
      { ...env, COMMENTS_DB: commentsDb as any },
    );
    expect(response.status).toBe(201);
    expect(calls[0]?.[0]).toContain('INSERT INTO comments');
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
          contributions: [
            { contribution: '贡献一', source: 'Sec. 1' },
            { contribution: '贡献二', source: null },
          ],
          research_questions: [
            {
              type: 'explicit',
              question: '问题一',
              original_question: null,
              how: '方法一',
              answer: '答案一',
              meaning: '含义一',
              source: 'RQ1; Sec. 3',
            },
            {
              type: 'inferred',
              question: '问题二',
              original_question: null,
              how: '方法二',
              answer: '答案二',
              meaning: '含义二',
              source: 'Introduction, Paragraph 2',
            },
          ],
          research_questions_empty_reason: null,
          research_questions_empty_source: null,
          method: '方法',
          experiments_and_key_findings: '实验',
          limitations: { author_reported: [], ai_analysis: ['分析'] },
          relation_to_research: '关系',
          what_can_be_done_next: '下一步',
        },
      }),
    ).toBe(true);
    expect(
      validPaperPatch({
        detail: {
          motivation: '动机',
          contributions: [
            { contribution: '贡献一', source: null },
            { contribution: '贡献二', source: null },
          ],
          research_questions: [
            {
              type: 'inferred',
              question: '问题',
              original_question: null,
              how: '方法',
              answer: '答案',
              meaning: '含义',
              source: '',
            },
          ],
          research_questions_empty_reason: null,
          research_questions_empty_source: null,
          method: '方法',
          experiments_and_key_findings: '实验',
          limitations: { author_reported: [], ai_analysis: [] },
          relation_to_research: '关系',
          what_can_be_done_next: '下一步',
        },
      }),
    ).toBe(false);
    expect(validPaperPatch({ title: 'Replacement title' })).toBe(false);
    expect(
      validPaperPatch(
        {
          detail: {
            motivation: '动机',
            contributions: [
              { contribution: '贡献一', source: null },
              { contribution: '贡献二', source: null },
            ],
            research_questions: [
              {
                type: 'inferred',
                question: '问题',
                original_question: null,
                how: '方法',
                answer: '答案',
                meaning: '含义',
                source: null,
              },
            ],
            research_questions_empty_reason: null,
            research_questions_empty_source: null,
            method: '方法',
            experiments_and_key_findings: '实验',
            limitations: { author_reported: [], ai_analysis: [] },
            relation_to_research: '关系',
            what_can_be_done_next: '下一步',
          },
        },
        'abstract_only',
      ),
    ).toBe(false);
  });

  it('requires an explained Introduction/Motivation locator before saving empty body-backed questions', () => {
    const detail = {
      motivation: '动机',
      contributions: [
        { contribution: '贡献一', source: null },
        { contribution: '贡献二', source: null },
      ],
      research_questions: [],
      research_questions_empty_reason:
        'Introduction discusses the paper scope but does not state a distinct research question that can be reliably extracted.',
      research_questions_empty_source: 'Introduction, PDF p. 1, paragraphs 1–3',
      method: '方法',
      experiments_and_key_findings: '实验',
      limitations: { author_reported: [], ai_analysis: [] },
      relation_to_research: '关系',
      what_can_be_done_next: '下一步',
    };
    expect(validPaperPatch({ detail }, 'full_text')).toBe(true);
    expect(
      validPaperPatch(
        {
          detail: {
            ...detail,
            research_questions_empty_reason: null,
            research_questions_empty_source: null,
          },
        },
        'full_text',
      ),
    ).toBe(false);
    expect(
      validPaperPatch(
        { detail: { ...detail, research_questions_empty_source: 'Sec. 1' } },
        'official_html',
      ),
    ).toBe(false);
    expect(
      validPaperPatch(
        {
          detail: {
            ...detail,
            research_questions_empty_reason:
              'The paper has no research question in its introduction.',
          },
        },
        'full_text',
      ),
    ).toBe(false);
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
