import { z } from 'zod';

export const VenueType = z.enum(['Conference', 'Journal', 'Preprint']);
export const PaperStatus = z.enum([
  'New',
  'Worth Reading',
  'Reading',
  'Read',
  'Important',
  'Related Work',
]);
export const Relevance = z.enum(['High', 'Medium', 'Low']);
export const ReadingBasis = z.enum([
  'full_text',
  'official_html',
  'abstract_and_metadata',
  'abstract_only',
]);
export const DetailNextStepSchema = z
  .object({
    title: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    concrete_plan: z.string().trim().min(1),
    validation: z.string().trim().min(1),
    expected_value: z.string().trim().min(1),
    source: z.string().trim().min(1).nullable().optional(),
  })
  .strict();
export type DetailNextStep = z.infer<typeof DetailNextStepSchema>;

const ResearchQuestionsEmptyReason = z
  .string()
  .trim()
  .min(20)
  .refine(
    (reason) =>
      /(?:cannot|could not|unable|does not (?:state|identify|present)|doesn't (?:state|identify|present)|no (?:clear|distinct|reliable) (?:research )?(?:question|objective)|not (?:clear|stated|identified)|unclear|ambiguous|insufficient|lack(?:s|ing)?|无法|不能|未能|未明确|没有明确|未提出|未指出|未说明|缺乏|不足以|不清晰|难以判断)/i.test(
        reason,
      ),
    'Research Question empty reasons must explain why no reliable question can be extracted.',
  );
const nullableText = z.string().nullable().optional();
export const PaperSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    authors: z.array(z.string()),
    year: z.number().int(),
    publication_date: z.string().nullable(),
    venue_or_source: z.string().min(1),
    venue_type: VenueType,
    status: z.string().optional(),
    ranking: z.object({
      ccf: nullableText,
      cas: nullableText,
      jcr: nullableText,
      ranking_year: z.number().int().nullable().optional(),
      ranking_source: nullableText,
    }),
    identifiers: z.object({ doi: nullableText, arxiv: nullableText, openreview: nullableText }),
    urls: z.object({ paper: z.string().url(), code: z.string().url().nullable().optional() }),
    topics: z.array(z.string()),
    relevance: Relevance,
    reading_basis: ReadingBasis,
    quick_read: z.object({
      tldr: z.string(),
      problem_and_motivation: z.string(),
      core_method: z.string(),
      key_results: z.string(),
      why_it_matters: z.string(),
    }),
    detail: z.object({
      motivation: z.string(),
      contributions: z
        .array(z.object({ contribution: z.string().min(1), source: z.string().min(1).nullable() }))
        .min(2)
        .max(5),
      research_questions: z.array(
        z
          .object({
            type: z.enum(['explicit', 'inferred']),
            question: z.string(),
            original_question: z.string().min(1).nullable(),
            how: z.string(),
            answer: z.string(),
            meaning: z.string(),
            source: z.string().min(1).nullable(),
          })
          .superRefine((question, context) => {
            if (!question.source) {
              context.addIssue({
                code: 'custom',
                path: ['source'],
                message: 'Research Questions require a source locator.',
              });
            }
            if (question.type === 'inferred' && question.original_question !== null) {
              context.addIssue({
                code: 'custom',
                path: ['original_question'],
                message: 'Inferred Research Questions must not include original wording.',
              });
            }
            if (
              question.type === 'inferred' &&
              !/introduction|motivation/i.test(question.source ?? '')
            ) {
              context.addIssue({
                code: 'custom',
                path: ['source'],
                message:
                  'Inferred Research Questions require an Introduction or Motivation locator.',
              });
            }
          }),
      ),
      research_questions_empty_reason: ResearchQuestionsEmptyReason.nullable(),
      research_questions_empty_source: z.string().trim().min(1).nullable(),
      method: z.string(),
      experiments_and_key_findings: z.string(),
      limitations: z.object({
        author_reported: z.array(z.string()),
        ai_analysis: z.array(z.string()),
      }),
      relation_to_research: z.string(),
      what_can_be_done_next: z.union([
        z.string().trim().min(1),
        z.array(DetailNextStepSchema).min(3).max(6),
      ]),
    }),
    original_abstract: z.string().nullable(),
    bibtex: z.string().nullable(),
    figures: z
      .array(
        z.object({
          src: z.string().url(),
          alt: z.string(),
          caption: z.string(),
          source: z.string(),
        }),
      )
      .default([]),
    evidence: z
      .array(
        z.object({
          claim: z.string(),
          locator: z.string(),
          url: z.string().url().nullable().optional(),
        }),
      )
      .default([]),
    generated_by: z.string(),
    generated_at: z.string(),
    updated_at: z.string(),
    owner_edited: z.boolean().default(false),
  })
  .strict()
  .superRefine((paper, context) => {
    if (paper.reading_basis === 'abstract_and_metadata') {
      context.addIssue({
        code: 'custom',
        path: ['reading_basis'],
        message:
          'Abstract + Metadata may inform Quick Read but cannot be the Detail reading basis.',
      });
    }
    if (
      paper.reading_basis === 'abstract_only' &&
      !paper.detail.limitations.author_reported.some((item) =>
        /摘要|全文|abstract|full text/i.test(item),
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['detail', 'limitations', 'author_reported'],
        message: 'Abstract-only Detail records must document the full-text retrieval fallback.',
      });
    }
    if (
      ['abstract_only', 'abstract_and_metadata'].includes(paper.reading_basis) &&
      paper.detail.research_questions.some((question) => question.type === 'inferred')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['detail', 'research_questions'],
        message: 'Inferred Research Questions require Introduction or Motivation reading evidence.',
      });
    }
    const { research_questions, research_questions_empty_reason, research_questions_empty_source } =
      paper.detail;
    const hasEmptyExplanation =
      Boolean(research_questions_empty_reason?.trim()) &&
      Boolean(research_questions_empty_source?.trim()) &&
      /introduction|motivation/i.test(research_questions_empty_source ?? '');
    if (research_questions.length === 0) {
      if (['full_text', 'official_html'].includes(paper.reading_basis) && !hasEmptyExplanation) {
        context.addIssue({
          code: 'custom',
          path: ['detail', 'research_questions_empty_reason'],
          message:
            'Body-backed papers with no Research Questions require an empty reason and an Introduction/Motivation locator.',
        });
      }
    } else if (
      research_questions_empty_reason !== null ||
      research_questions_empty_source !== null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['detail', 'research_questions_empty_reason'],
        message: 'Empty Research Question metadata must be null when questions are present.',
      });
    }
  });
export type Paper = z.infer<typeof PaperSchema>;
export const UserStateSchema = z
  .object({
    paper_id: z.string(),
    status: PaperStatus,
    deep_read: z.boolean(),
    favorite: z.boolean(),
    my_tags: z.array(z.string()),
    my_notes: z.string(),
    manually_edited: z.boolean(),
    updated_at: z.string(),
  })
  .strict();
export type UserState = z.infer<typeof UserStateSchema>;
export const DailySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recommendations: z.array(
      z.object({
        paper_id: z.string(),
        primary: z.boolean(),
        run_type: z.enum(['scheduled', 'manual']),
      }),
    ),
  })
  .strict();
export type DailyArchive = z.infer<typeof DailySchema>;
