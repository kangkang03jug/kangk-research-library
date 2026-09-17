import { describe, expect, it } from 'vitest';
import {
  normalizedTitle,
  rankingScore,
  relevanceScore,
  sortPapers,
  matchesSearch,
  joinState,
} from '../src/lib/library';
import { PaperSchema, type Paper } from '../src/lib/schema';
import { localStateStorageKey, parseLocalState, serializeLocalState } from '../src/lib/local-state';
const paper = (overrides: Partial<Paper> = {}) =>
  ({
    id: 'paper-a',
    title: 'A Paper',
    authors: ['A'],
    year: 2024,
    publication_date: '2024-01-01',
    venue_or_source: 'Venue',
    venue_type: 'Conference',
    ranking: { ccf: 'CCF-A', cas: null, jcr: null, ranking_year: null, ranking_source: null },
    identifiers: { doi: null, arxiv: null, openreview: null },
    urls: { paper: 'https://example.com/paper', code: null },
    topics: ['Agents'],
    relevance: 'High',
    reading_basis: 'abstract_only',
    quick_read: {
      tldr: 'searchable tldr',
      problem_and_motivation: 'problem',
      core_method: 'method',
      key_results: 'results',
      why_it_matters: 'matters',
    },
    detail: {
      motivation: 'motivation',
      contributions: [
        { contribution: 'contribution one', source: 'Sec. 1' },
        { contribution: 'contribution two', source: null },
      ],
      research_questions: [],
      research_questions_empty_reason: null,
      research_questions_empty_source: null,
      method: 'method',
      experiments_and_key_findings: 'findings',
      limitations: {
        author_reported: ['Abstract-only fixture; full text unavailable.'],
        ai_analysis: [],
      },
      relation_to_research: 'relation',
      what_can_be_done_next: 'next',
    },
    original_abstract: null,
    bibtex: null,
    figures: [],
    evidence: [],
    generated_by: 'Test',
    generated_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    owner_edited: false,
    ...overrides,
  }) as Paper;
describe('library helpers', () => {
  it('normalizes titles for deduplication', () =>
    expect(normalizedTitle('SWE-agent: An Approach!')).toBe('swe agent an approach'));
  it('scores configured ranking and relevance', () => {
    expect(rankingScore(paper())).toBe(4);
    expect(relevanceScore('High')).toBe(3);
  });
  it('sorts deterministically', () =>
    expect(sortPapers([paper({ id: 'b', title: 'B' }), paper()], 'title').map((p) => p.id)).toEqual(
      ['paper-a', 'b'],
    ));
  it('searches generated content and joined notes', () =>
    expect(matchesSearch(paper(), undefined, 'searchable tldr')).toBe(true));
  it('joins user state without changing paper records', () =>
    expect(joinState([paper()], [])[0].state).toBeUndefined());
  it('requires a locator for explicit Research Questions', () => {
    const record = paper({
      reading_basis: 'official_html',
      detail: {
        ...paper().detail,
        research_questions: [
          {
            type: 'explicit',
            question: 'RQ1?',
            original_question: null,
            how: 'Method.',
            answer: 'Answer.',
            meaning: 'Meaning.',
            source: null,
          },
        ],
      },
    });
    expect(PaperSchema.safeParse(record).success).toBe(false);
  });
  it('does not allow inferred Research Questions without Introduction or Motivation evidence', () => {
    const record = paper({
      detail: {
        ...paper().detail,
        research_questions: [
          {
            type: 'inferred',
            question: 'Question?',
            original_question: null,
            how: 'Method.',
            answer: 'Answer.',
            meaning: 'Meaning.',
            source: 'Introduction, Sec. 1',
          },
        ],
      },
    });
    expect(PaperSchema.safeParse(record).success).toBe(false);
    expect(PaperSchema.safeParse({ ...record, reading_basis: 'official_html' }).success).toBe(true);
  });
  it('accepts an inferred Research Question after full-text Introduction review', () => {
    const record = paper({
      reading_basis: 'full_text',
      detail: {
        ...paper().detail,
        research_questions: [
          {
            type: 'inferred',
            question: 'Can the proposed representation improve robust recognition?',
            original_question: null,
            how: "The method is evaluated across the paper's benchmark settings.",
            answer: 'The reported results support the objective.',
            meaning: 'This summarizes the author objective and is not an original RQ label.',
            source: 'Introduction, Sec. 1, PDF p. 2',
          },
        ],
      },
    });
    expect(PaperSchema.safeParse(record).success).toBe(true);
  });
  it('requires a reason and Introduction/Motivation locator for empty body-backed questions', () => {
    const base = paper({ reading_basis: 'full_text' });
    expect(PaperSchema.safeParse(base).success).toBe(false);
    const explained = {
      ...base,
      detail: {
        ...base.detail,
        research_questions_empty_reason:
          'The Introduction states the survey scope but does not identify a single author-framed research question to extract reliably.',
        research_questions_empty_source: 'Introduction, PDF p. 1, paragraphs 1–3',
      },
    };
    expect(PaperSchema.safeParse(explained).success).toBe(true);
    expect(
      PaperSchema.safeParse({
        ...explained,
        detail: { ...explained.detail, research_questions_empty_source: 'Sec. 1' },
      }).success,
    ).toBe(false);
    expect(
      PaperSchema.safeParse({
        ...explained,
        detail: {
          ...explained.detail,
          research_questions_empty_reason:
            'The paper has no research question in its introduction.',
        },
      }).success,
    ).toBe(false);
  });
  it('does not accept stale empty-question metadata when questions are present', () => {
    const record = paper({
      reading_basis: 'official_html',
      detail: {
        ...paper().detail,
        research_questions: [
          {
            type: 'inferred',
            question: 'What is the author objective?',
            original_question: null,
            how: 'By reviewing the Introduction.',
            answer: 'The method addresses the objective.',
            meaning: 'An inferred question, not an original RQ label.',
            source: 'Introduction, Sec. 1',
          },
        ],
        research_questions_empty_reason: 'This stale reason should not coexist with questions.',
      },
    });
    expect(PaperSchema.safeParse(record).success).toBe(false);
  });
  it('allows Chinese explanation with optional explicit original wording', () => {
    const record = paper({
      reading_basis: 'official_html',
      detail: {
        ...paper().detail,
        research_questions: [
          {
            type: 'explicit',
            question: '作者是否在不同模型上验证该方法？',
            original_question: 'Does the method generalize across different models?',
            how: '依据论文实验进行比较。',
            answer: '是。',
            meaning: '这是论文明确提出的问题。',
            source: 'Introduction, Sec. 1',
          },
        ],
      },
    });
    expect(PaperSchema.safeParse(record).success).toBe(true);
  });
  it('rejects original wording on inferred questions', () => {
    const record = paper({
      reading_basis: 'full_text',
      detail: {
        ...paper().detail,
        research_questions: [
          {
            type: 'inferred',
            question: '作者希望解决什么问题？',
            original_question: 'What problem does the paper solve?',
            how: '阅读 Introduction。',
            answer: '见正文。',
            meaning: '这是推断问题。',
            source: 'Introduction, Sec. 1',
          },
        ],
      },
    });
    expect(PaperSchema.safeParse(record).success).toBe(false);
  });
});

describe('browser-local reading state', () => {
  it('uses an isolated namespace and round-trips local state', () => {
    const a = localStateStorageKey('/library-a/');
    const b = localStateStorageKey('/library-b/');
    expect(a).not.toBe(b);
    const value = { paper1: { deep_read: true, favorite: false } };
    expect(parseLocalState(serializeLocalState(value))).toEqual(value);
  });
  it('falls back to empty state for missing or invalid storage', () => {
    expect(parseLocalState(null)).toEqual({});
    expect(parseLocalState('{invalid')).toEqual({});
    expect(parseLocalState('[]')).toEqual({});
  });
});
