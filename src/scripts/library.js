import { message, normalizeLocale } from '../i18n';

(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const rows = [...document.querySelectorAll('[data-paper-row]')];
  const state = { locale: normalizeLocale(document.documentElement.dataset.locale) };
  const tr = (key) => message(state.locale, key);

  function formatCount(value, kind) {
    const key =
      kind === 'paper'
        ? value === 1
          ? 'labels.paper'
          : 'labels.papers'
        : kind === 'day'
          ? value === 1
            ? 'labels.day'
            : 'labels.days'
          : value === 1
            ? 'labels.recommendation'
            : 'labels.recommendations';
    return `${value} ${tr(key)}`;
  }

  function updateCounts() {
    document.querySelectorAll('[data-count-value]').forEach((element) => {
      element.textContent = formatCount(
        Number(element.dataset.countValue || 0),
        element.dataset.countKind,
      );
    });
  }

  function updateSummaryButtons() {
    document.querySelectorAll('[data-toggle-summary]').forEach((button) => {
      button.textContent =
        button.dataset.summaryOpen === 'true' ? tr('paper.hideQuickRead') : tr('paper.quickRead');
    });
  }

  function updateEditor() {
    const editor = q('[data-editor]');
    if (!editor) return;
    const status = q('[data-editor-status]', editor);
    if (status)
      status.textContent = tr(
        editor.dataset.editorState === 'ready'
          ? 'paper.editorReady'
          : editor.dataset.editorState === 'signin'
            ? 'paper.signIn'
            : 'paper.editorDisabled',
      );
  }

  function applyLocale(locale) {
    state.locale = normalizeLocale(locale);
    document.documentElement.dataset.locale = state.locale;
    document.documentElement.lang = state.locale;
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = tr(element.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', tr(element.dataset.i18nPlaceholder));
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      element.setAttribute('aria-label', tr(element.dataset.i18nAriaLabel));
    });
    const toggle = q('[data-locale-toggle]');
    if (toggle)
      toggle.setAttribute(
        'aria-label',
        tr(state.locale === 'zh-CN' ? 'locale.toEnglish' : 'locale.toChinese'),
      );
    updateCounts();
    updateSummaryButtons();
    updateEditor();
  }

  const localeToggle = q('[data-locale-toggle]');
  localeToggle?.addEventListener('click', () => {
    const next = state.locale === 'zh-CN' ? 'en' : 'zh-CN';
    try {
      localStorage.setItem('research-library-locale', next);
    } catch {}
    applyLocale(next);
  });
  applyLocale(state.locale);

  document.querySelectorAll('[data-toggle-summary]').forEach((button) =>
    button.addEventListener('click', () => {
      const summary = button.closest('[data-paper-row]').querySelector('.inline-summary');
      summary.hidden = !summary.hidden;
      button.dataset.summaryOpen = String(!summary.hidden);
      updateSummaryButtons();
    }),
  );

  const search = q('[data-search]');
  const filterEls = [...document.querySelectorAll('[data-filter]')];
  const sort = q('[data-sort]');
  const count = q('[data-result-count]');
  function apply() {
    const query = (search?.value || '').toLowerCase().trim();
    const filters = Object.fromEntries(filterEls.map((el) => [el.dataset.filter, el.value]));
    let visible = rows.filter((row) => {
      const matches = !query || row.dataset.searchText.toLowerCase().includes(query);
      return (
        matches &&
        Object.entries(filters).every(
          ([key, value]) =>
            !value ||
            value === 'all' ||
            (key === 'topic'
              ? row.dataset.topic.split('|').includes(value)
              : row.dataset[key] === value),
        )
      );
    });
    const order = sort?.value;
    if (order) {
      const rank = { 'CCF-A': 4, 'CAS-Q1': 4, 'JCR-Q1': 4, 'CCF-B': 3, 'CCF-C': 2, Unranked: 0 };
      visible.sort((a, b) =>
        order === 'title'
          ? a.querySelector('h2').textContent.localeCompare(b.querySelector('h2').textContent)
          : order === 'relevance'
            ? { High: 3, Medium: 2, Low: 1 }[b.dataset.relevance] -
              { High: 3, Medium: 2, Low: 1 }[a.dataset.relevance]
            : order === 'ranking'
              ? (rank[b.dataset.ranking] || 0) - (rank[a.dataset.ranking] || 0)
              : order === 'publication'
                ? b.dataset.year - a.dataset.year
                : 0,
      );
    }
    rows.forEach((row) => {
      row.hidden = !visible.includes(row);
    });
    if (count) {
      count.dataset.countValue = visible.length;
      updateCounts();
    }
  }
  [search, sort, ...filterEls].filter(Boolean).forEach((el) => el.addEventListener('input', apply));
  apply();

  const detail = q('[data-detail]');
  const readButton = q('[data-read-detail]');
  readButton?.addEventListener('click', () => {
    detail.hidden = false;
    readButton.hidden = true;
    detail.querySelector('h2')?.focus();
  });

  const editor = q('[data-editor]');
  if (editor) {
    const api = editor.dataset.api;
    const buttons = [...editor.querySelectorAll('button[data-edit-action]')];
    const status = q('[data-editor-status]', editor);
    const note = q('[data-notes]', editor);
    if (!api) {
      editor.dataset.editorState = 'disabled';
      buttons.forEach((button) => {
        button.disabled = true;
      });
      if (note) note.disabled = true;
    } else {
      editor.dataset.editorState = 'ready';
      buttons.forEach((button) =>
        button.addEventListener('click', async () => {
          editor.dataset.editorState = 'signin';
          updateEditor();
          window.location.href = `${api.replace(/\/$/, '')}/auth/login?return_to=${encodeURIComponent(location.href)}`;
        }),
      );
    }
    updateEditor();
    void status;
  }
})();
