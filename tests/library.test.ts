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
      method: 'method',
      experiments_and_key_findings: 'findings',
      limitations: { author_reported: [], ai_analysis: [] },
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
            how: 'Method.',
            answer: 'Answer.',
            meaning: 'Meaning.',
            source: null,
          },
        ],
      },
    });
    expect(PaperSchema.safeParse(record).success).toBe(false);
    expect(PaperSchema.safeParse({ ...record, reading_basis: 'official_html' }).success).toBe(true);
  });
});
