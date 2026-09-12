import type { Paper, UserState, DailyArchive } from './schema';

export const readingBasisLabel: Record<Paper['reading_basis'], string> = {
  full_text: 'Full Text',
  official_html: 'Official HTML',
  abstract_and_metadata: 'Abstract + Metadata',
  abstract_only: 'Abstract Only',
};
export function normalizedTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
export function rankingScore(paper: Paper) {
  const value = paper.ranking.ccf || paper.ranking.cas || paper.ranking.jcr;
  return value
    ? ({
        'CCF-A': 4,
        'CCF-B': 3,
        Q1: 4,
        'CAS-Q1': 4,
        'JCR-Q1': 4,
        'CCF-C': 2,
        Q2: 2,
        'CAS-Q2': 2,
        'JCR-Q2': 2,
      }[value] ?? 1)
    : 0;
}
export function relevanceScore(relevance: Paper['relevance']) {
  return { High: 3, Medium: 2, Low: 1 }[relevance];
}
export function sortPapers(papers: Paper[], sort: string) {
  return [...papers].sort((a, b) =>
    sort === 'title'
      ? a.title.localeCompare(b.title)
      : sort === 'publication'
        ? (b.publication_date || '').localeCompare(a.publication_date || '')
        : sort === 'relevance'
          ? relevanceScore(b.relevance) - relevanceScore(a.relevance)
          : sort === 'ranking'
            ? rankingScore(b) - rankingScore(a)
            : b.updated_at.localeCompare(a.updated_at),
  );
}
export function matchesSearch(paper: Paper, state: UserState | undefined, query: string) {
  const haystack = JSON.stringify({ paper, state }).toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}
export function joinState(papers: Paper[], states: UserState[]) {
  const map = new Map(states.map((state) => [state.paper_id, state]));
  return papers.map((paper) => ({ paper, state: map.get(paper.id) }));
}
export function stats(papers: Paper[], states: UserState[], daily: DailyArchive[]) {
  const stateMap = new Map(states.map((s) => [s.paper_id, s]));
  const month = new Date().toISOString().slice(0, 7);
  return {
    total: papers.length,
    deepRead: states.filter((s) => s.deep_read).length,
    thisMonth: papers.filter((p) => p.generated_at.startsWith(month)).length,
    preprints: papers.filter((p) => p.venue_type === 'Preprint').length,
    stateMap,
    today: daily.find((d) => d.date === new Date().toISOString().slice(0, 10)),
  };
}
