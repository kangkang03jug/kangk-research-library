import { describe, expect, it } from 'vitest';
import { withBase } from '../src/lib/url';

describe('withBase', () => {
  it('supports root hosting', () => {
    expect(withBase('/', '/')).toBe('/');
    expect(withBase('/paper-pool/', '/')).toBe('/paper-pool/');
  });

  it('supports GitHub Pages project hosting with or without a trailing slash', () => {
    expect(withBase('/paper-pool/', '/alice-research-library/')).toBe(
      '/alice-research-library/paper-pool/',
    );
    expect(withBase('/papers/example-paper/', '/alice-research-library')).toBe(
      '/alice-research-library/papers/example-paper/',
    );
  });
});
