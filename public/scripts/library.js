(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const rows = [...document.querySelectorAll('[data-paper-row]')];
  document.querySelectorAll('[data-toggle-summary]').forEach((button) =>
    button.addEventListener('click', () => {
      const summary = button.closest('[data-paper-row]').querySelector('.inline-summary');
      summary.hidden = !summary.hidden;
      button.textContent = summary.hidden ? 'Quick Read' : 'Hide Quick Read';
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
              : key === 'favorite' || key === 'deep-read'
                ? row.dataset[key] === value
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
    if (count) count.textContent = `${visible.length} paper${visible.length === 1 ? '' : 's'}`;
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
      status.textContent =
        'Owner editing is disabled until an authenticated write backend is configured. This public site remains read-only.';
      buttons.forEach((b) => {
        b.disabled = true;
      });
      if (note) note.disabled = true;
    } else {
      status.textContent = 'Owner editor ready. Sign in with GitHub to enable protected writes.';
      buttons.forEach((b) =>
        b.addEventListener('click', async () => {
          status.textContent = 'Opening secure GitHub sign-in…';
          window.location.href = `${api.replace(/\/$/, '')}/auth/login?return_to=${encodeURIComponent(location.href)}`;
        }),
      );
    }
  }
})();
