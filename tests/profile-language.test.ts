import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as yaml from 'js-yaml';
import { en } from '../src/i18n/en';
import { zhCN } from '../src/i18n/zh-CN';

const profile = yaml.load(
  fs.readFileSync(path.join(process.cwd(), 'config/research-profile.yaml'), 'utf8'),
) as {
  profile?: { description?: string };
  research_scope?: { primary?: string[] };
  language?: { explanation?: string };
};

describe('homepage Hero language contract', () => {
  it('keeps Chinese profile fields and fixed labels in natural Chinese', () => {
    expect(profile.language?.explanation).toBe('zh-CN');
    expect(profile.research_scope?.primary?.[0]).toMatch(/[\u3400-\u9fff]/u);
    expect(profile.profile?.description).toMatch(/[\u3400-\u9fff]/u);
    expect(zhCN.home.eyebrow).toBe('研究知识库 ·');
    expect(zhCN.home.libraryLabel).toBe('研究知识库');
  });

  it('keeps English fixed labels available for the UI switch', () => {
    expect(en.home.eyebrow).toBe('Research Library ·');
    expect(en.home.libraryLabel).toBe('Research Library');
  });
});
