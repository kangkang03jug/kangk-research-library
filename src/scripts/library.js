import { message, normalizeLocale } from '../i18n';
import { localStateStorageKey, parseLocalState, serializeLocalState } from '../lib/local-state';

(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const rows = [...document.querySelectorAll('[data-paper-row]')];
  const state = { locale: normalizeLocale(document.documentElement.dataset.locale) };
  const tr = (key) => message(state.locale, key);
  const localStateKey = localStateStorageKey(
    document.documentElement.dataset.stateNamespace || location.pathname,
  );
  const readLocalState = () => {
    try {
      return parseLocalState(localStorage.getItem(localStateKey));
    } catch {
      return {};
    }
  };
  const writeLocalState = (value) => {
    try {
      localStorage.setItem(localStateKey, serializeLocalState(value));
    } catch {}
  };
  const localState = readLocalState();
  const paperLocalState = (paperId) => ({
    deep_read: localState[paperId]?.deep_read === true,
    favorite: localState[paperId]?.favorite === true,
  });
  const updateLocalIndicators = () => {
    rows.forEach((row) => {
      const id = row.querySelector('a[href*="/papers/"]')?.getAttribute('href')?.split('/').filter(Boolean).pop();
      if (!id) return;
      const value = paperLocalState(id);
      row.dataset.deepRead = String(value.deep_read);
      row.dataset.favorite = String(value.favorite);
      const deep = q('[data-local-indicator="deep_read"]', row);
      const favorite = q('[data-local-indicator="favorite"]', row);
      if (deep) deep.textContent = value.deep_read ? '◉' : '○';
      if (favorite) favorite.textContent = value.favorite ? '★' : '☆';
    });
    document.querySelectorAll('[data-local-paper-state]').forEach((panel) => {
      const value = paperLocalState(panel.dataset.paperId);
      ['deep_read', 'favorite'].forEach((field) => {
        const input = q(`[data-local-field="${field}"]`, panel);
        if (input) input.checked = value[field];
      });
    });
  };

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
    if (status) status.textContent = tr(editor.dataset.editorMessageKey || 'paper.editorChecking');
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
              : row.dataset[key === 'deep-read' ? 'deepRead' : key] === value),
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
  const localFilter = q('[data-local-state-filter]');
  const localEmpty = q('[data-local-empty]');
  const updateLocalViews = () => {
    updateLocalIndicators();
    const filter = localFilter?.dataset.localStateFilter;
    if (filter) {
      const visible = rows.filter((row) => row.dataset[filter === 'deep_read' ? 'deepRead' : 'favorite'] === 'true');
      rows.forEach((row) => { row.hidden = !visible.includes(row); });
      const count = q('[data-local-count]');
      if (count) { count.dataset.countValue = visible.length; count.textContent = formatCount(visible.length, 'paper'); }
      if (localEmpty) localEmpty.hidden = visible.length > 0;
    }
    const paperIds = [...document.querySelectorAll('[data-local-paper-ids] [data-paper-id]')].map(
      (element) => element.dataset.paperId,
    );
    const deepReadCount = paperIds.length
      ? paperIds.filter((id) => paperLocalState(id).deep_read).length
      : rows.filter((row) => row.dataset.deepRead === 'true').length;
    document.querySelectorAll('[data-local-stat="deep_read"]').forEach((element) => {
      element.textContent = String(deepReadCount);
    });
  };
  updateLocalViews();
  document.querySelectorAll('[data-local-paper-state] input[data-local-field]').forEach((input) => {
    input.addEventListener('change', () => {
      const panel = input.closest('[data-local-paper-state]');
      const id = panel?.dataset.paperId;
      if (!id) return;
      localState[id] = { ...paperLocalState(id), [input.dataset.localField]: input.checked };
      writeLocalState(localState);
      updateLocalViews();
      if (!localFilter) apply();
    });
  });
  if (!localFilter) apply();

  const detail = q('[data-detail]');
  const readButton = q('[data-read-detail]');
  readButton?.addEventListener('click', () => {
    detail.hidden = false;
    readButton.hidden = true;
    detail.querySelector('h2')?.focus();
  });

  const editor = q('[data-editor]');
  if (editor) {
    const api = (editor.dataset.api || '').replace(/\/$/, '');
    const paperId = editor.dataset.paperId;
    const status = q('[data-editor-status]', editor);
    const loginButton = q('[data-editor-login]', editor);
    const logoutButton = q('[data-editor-logout]', editor);
    const userLabel = q('[data-editor-user]', editor);
    const userForm = q('[data-user-editor]', editor);
    const paperForm = q('[data-paper-editor]', editor);
    const summaryEditor = q('[data-summary-editor]', editor);
    const commitLink = q('[data-editor-commit]', editor);
    const sessionKey = 'research-library-editor-session';
    let session = '';
    let userSha = '';
    let paperSha = '';
    let paperRecord;

    const setMessage = (key) => {
      editor.dataset.editorMessageKey = key;
      updateEditor();
    };
    const setAuthenticated = (authenticated, login = '') => {
      loginButton.hidden = authenticated;
      logoutButton.hidden = !authenticated;
      userLabel.hidden = !authenticated;
      userLabel.textContent = authenticated ? `@${login}` : '';
      userForm.hidden = !authenticated;
      summaryEditor.hidden = !authenticated;
    };
    const authorizationHeaders = () => (session ? { Authorization: `Bearer ${session}` } : {});
    const saveSession = (value) => {
      session = value;
      try {
        if (value) sessionStorage.setItem(sessionKey, value);
        else sessionStorage.removeItem(sessionKey);
      } catch {}
    };
    const request = async (path, options = {}) => {
      const response = await fetch(`${api}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
          ...authorizationHeaders(),
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
      });
      if (response.ok) {
        const payload = await response
          .clone()
          .json()
          .catch(() => null);
        if (payload?.session) saveSession(payload.session);
      }
      return response;
    };
    const showCommit = (url) => {
      commitLink.hidden = !url;
      if (url) commitLink.href = url;
    };
    const splitLines = (value) =>
      value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);

    async function loadEditorData() {
      setMessage('paper.editorLoading');
      const userPath = `data/user/${paperId}.json`;
      const paperPath = `data/papers/${paperId}.json`;
      const [userResponse, paperResponse] = await Promise.all([
        request(`/api/content?path=${encodeURIComponent(userPath)}`),
        request(`/api/content?path=${encodeURIComponent(paperPath)}`),
      ]);
      if (userResponse.status === 401 || paperResponse.status === 401) {
        saveSession('');
        setAuthenticated(false);
        setMessage('paper.signInRequired');
        return;
      }
      if (!userResponse.ok || !paperResponse.ok) throw new Error('Unable to load editor data');
      const userData = await userResponse.json();
      const paperData = await paperResponse.json();
      userSha = userData.sha;
      paperSha = paperData.sha;
      paperRecord = paperData.content;
      q('[data-user-field="status"]', editor).value = userData.content.status;
      q('[data-user-field="my_tags"]', editor).value = userData.content.my_tags.join(', ');
      q('[data-user-field="my_notes"]', editor).value = userData.content.my_notes;
      editor.querySelectorAll('[data-summary-group]').forEach((field) => {
        field.value = paperRecord[field.dataset.summaryGroup][field.dataset.summaryField];
      });
      q('[data-contributions]', editor).value = JSON.stringify(
        paperRecord.detail.contributions,
        null,
        2,
      );
      q('[data-research-questions]', editor).value = JSON.stringify(
        paperRecord.detail.research_questions,
        null,
        2,
      );
      editor.querySelectorAll('[data-limitations]').forEach((field) => {
        field.value = paperRecord.detail.limitations[field.dataset.limitations].join('\n');
      });
      setMessage('paper.editorAuthenticated');
    }

    async function updateFile(path, sha, patch, message) {
      const response = await request('/api/update', {
        method: 'POST',
        body: JSON.stringify({ path, sha, patch, message }),
      });
      if (response.status === 409) {
        setMessage('paper.editorConflict');
        return null;
      }
      if (response.status === 401) {
        saveSession('');
        setAuthenticated(false);
        setMessage('paper.signInRequired');
        return null;
      }
      if (!response.ok) throw new Error('Save failed');
      return response.json();
    }

    async function initializeEditor() {
      const hash = new URLSearchParams(location.hash.slice(1));
      const callbackSession = hash.get('editor_session');
      const callbackError = hash.get('editor_error');
      try {
        session = callbackSession || sessionStorage.getItem(sessionKey) || '';
      } catch {
        session = callbackSession || '';
      }
      if (callbackSession) saveSession(callbackSession);
      if (callbackSession || callbackError)
        history.replaceState(null, '', `${location.pathname}${location.search}`);
      if (callbackError === 'not-owner') {
        saveSession('');
        setAuthenticated(false);
        setMessage('paper.editorNotOwner');
        return;
      }
      try {
        const me = await request('/api/me');
        if (!me.ok) throw new Error('Editor unavailable');
        const identity = await me.json();
        if (!identity.authenticated) {
          setAuthenticated(false);
          setMessage('paper.signInRequired');
          return;
        }
        setAuthenticated(true, identity.login);
        await loadEditorData();
      } catch {
        setAuthenticated(false);
        setMessage('paper.editorUnavailable');
      }
    }

    if (!api) {
      editor.dataset.editorState = 'disabled';
      setAuthenticated(false);
      loginButton.hidden = true;
      setMessage('paper.editorDisabled');
    } else {
      loginButton.addEventListener('click', () => {
        setMessage('paper.signIn');
        window.location.href = `${api}/auth/login?return_to=${encodeURIComponent(location.href.split('#')[0])}`;
      });
      logoutButton.addEventListener('click', async () => {
        try {
          await request('/auth/logout', { method: 'POST' });
        } finally {
          saveSession('');
          setAuthenticated(false);
          showCommit('');
          setMessage('paper.signInRequired');
        }
      });
      userForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('paper.editorSaving');
        showCommit('');
        const tags = q('[data-user-field="my_tags"]', editor)
          .value.split(',')
          .map((tag) => tag.trim())
          .filter((tag, index, all) => tag && all.indexOf(tag) === index);
        const patch = {
          status: q('[data-user-field="status"]', editor).value,
          my_tags: tags,
          my_notes: q('[data-user-field="my_notes"]', editor).value,
        };
        try {
          const result = await updateFile(
            `data/user/${paperId}.json`,
            userSha,
            patch,
            `data: update reading state for ${paperId}`,
          );
          if (result) {
            userSha = result.sha;
            showCommit(result.commitUrl);
            setMessage('paper.editorSaved');
          }
        } catch {
          setMessage('paper.editorSaveFailed');
        }
      });
      paperForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('paper.editorSaving');
        showCommit('');
        try {
          const quickRead = { ...paperRecord.quick_read };
          const detailPatch = { ...paperRecord.detail };
          editor.querySelectorAll('[data-summary-group="quick_read"]').forEach((field) => {
            quickRead[field.dataset.summaryField] = field.value;
          });
          editor.querySelectorAll('[data-summary-group="detail"]').forEach((field) => {
            detailPatch[field.dataset.summaryField] = field.value;
          });
          const researchQuestions = JSON.parse(q('[data-research-questions]', editor).value);
          if (!Array.isArray(researchQuestions))
            throw new Error('Research Questions must be an array');
          detailPatch.research_questions = researchQuestions.map((question) => ({
            ...question,
            original_question:
              question.type === 'inferred' ? null : (question.original_question ?? null),
          }));
          const contributions = JSON.parse(q('[data-contributions]', editor).value);
          if (!Array.isArray(contributions)) throw new Error('Contributions must be an array');
          detailPatch.contributions = contributions;
          detailPatch.limitations = {
            author_reported: splitLines(q('[data-limitations="author_reported"]', editor).value),
            ai_analysis: splitLines(q('[data-limitations="ai_analysis"]', editor).value),
          };
          const patch = { quick_read: quickRead, detail: detailPatch };
          const result = await updateFile(
            `data/papers/${paperId}.json`,
            paperSha,
            patch,
            `data: correct AI summary for ${paperId}`,
          );
          if (result) {
            paperSha = result.sha;
            paperRecord = { ...paperRecord, ...patch };
            showCommit(result.commitUrl);
            setMessage('paper.editorSaved');
          }
        } catch (error) {
          setMessage(
            error instanceof SyntaxError ? 'paper.editorInvalidJson' : 'paper.editorSaveFailed',
          );
        }
      });
      void initializeEditor();
    }
    void status;
  }

  const commentsList = q('[data-comments-list]');
  const commentForm = q('[data-comment-form]');
  const commentEditor = q('[data-editor]');
  if (commentsList && commentForm && commentEditor) {
    const commentsApi = (commentEditor.dataset.api || '').replace(/\/$/, '');
    const commentsPaperId = commentEditor.dataset.paperId;
    const commentStatus = q('[data-comment-status]');
    const commentSession = () => {
      try {
        return sessionStorage.getItem('research-library-editor-session') || '';
      } catch {
        return '';
      }
    };
    const commentRequest = (path, options = {}) =>
      fetch(`${commentsApi}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
          ...(commentSession() ? { Authorization: `Bearer ${commentSession()}` } : {}),
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
      });
    const setCommentStatus = (key) => {
      if (commentStatus) commentStatus.textContent = tr(key);
    };
    const renderComments = async (comments, canDelete) => {
      commentsList.replaceChildren();
      if (!comments.length) {
        const empty = document.createElement('p');
        empty.textContent = tr('paper.commentsEmpty');
        commentsList.append(empty);
        return;
      }
      comments.forEach((comment) => {
        const item = document.createElement('article');
        item.className = 'comment-item';
        const meta = document.createElement('p');
        meta.className = 'comment-meta';
        const author = document.createElement('strong');
        author.textContent = comment.nickname;
        const time = document.createElement('time');
        time.dateTime = comment.created_at;
        time.textContent = new Date(comment.created_at).toLocaleString(state.locale);
        meta.append(author, ' · ', time);
        item.append(meta);
        const body = document.createElement('p');
        body.className = 'comment-body';
        body.textContent = comment.body;
        item.append(body);
        if (canDelete) {
          const button = document.createElement('button');
          button.className = 'text-button comment-delete';
          button.type = 'button';
          button.textContent = tr('paper.commentDelete');
          button.addEventListener('click', async () => {
            button.disabled = true;
            const response = await commentRequest(
              `/api/comments/${encodeURIComponent(comment.id)}`,
              { method: 'DELETE' },
            );
            if (response.ok) item.remove();
            else {
              button.disabled = false;
              setCommentStatus('paper.commentDeleteFailed');
            }
          });
          item.append(button);
        }
        commentsList.append(item);
      });
    };
    const loadComments = async () => {
      if (!commentsApi) {
        setCommentStatus('paper.commentsUnavailable');
        const empty = document.createElement('p');
        empty.textContent = tr('paper.commentsUnavailable');
        commentsList.replaceChildren(empty);
        return;
      }
      try {
        const response = await commentRequest(
          `/api/comments?paper_id=${encodeURIComponent(commentsPaperId)}`,
        );
        if (!response.ok) throw new Error('comments');
        const payload = await response.json();
        await renderComments(payload.comments || [], Boolean(commentSession()));
      } catch {
        const error = document.createElement('p');
        error.textContent = tr('paper.commentsLoadFailed');
        commentsList.replaceChildren(error);
      }
    };
    commentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(commentForm);
      const button = q('button[type="submit"]', commentForm);
      button.disabled = true;
      setCommentStatus('paper.commentSending');
      try {
        const response = await commentRequest('/api/comments', {
          method: 'POST',
          body: JSON.stringify({
            paper_id: commentsPaperId,
            nickname: formData.get('nickname'),
            body: formData.get('body'),
            website: formData.get('website'),
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'comment');
        }
        commentForm.reset();
        setCommentStatus('paper.commentPublished');
        await loadComments();
      } catch (error) {
        setCommentStatus(
          error.message.includes('Too many')
            ? 'paper.commentRateLimited'
            : 'paper.commentPublishFailed',
        );
      } finally {
        button.disabled = false;
      }
    });
    void loadComments();
  }
})();
