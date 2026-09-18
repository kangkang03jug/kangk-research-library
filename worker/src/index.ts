type Env = {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ALLOWED_ORIGIN: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_REPOSITORY: string;
  GITHUB_BRANCH?: string;
  COMMENTS_DB?: CommentsDatabase;
};

type CommentsDatabase = {
  prepare(query: string): CommentsStatement;
};
type CommentsStatement = {
  bind(...values: unknown[]): CommentsStatement;
  all<T = JsonRecord>(): Promise<{ results: T[] }>;
  first<T = JsonRecord>(): Promise<T | null>;
  run(): Promise<unknown>;
};

type Session = { login: string; expiresAt: number };
type OAuthState = { nonce: string; returnTo: string; expiresAt: number };
type JsonRecord = Record<string, unknown>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const SESSION_AGE_SECONDS = 90 * 24 * 60 * 60;
const STATUSES = new Set(['New', 'Worth Reading', 'Reading', 'Read', 'Important', 'Related Work']);
const commentRate = new Map<string, number[]>();
const cleanCommentText = (value: unknown, max: number) =>
  typeof value === 'string'
    ? value
        .normalize('NFKC')
        .replace(/<[^>]*>/g, '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .trim()
        .slice(0, max)
    : '';
const validPaperId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9-]{1,120}$/.test(value);
const commentIp = (request: Request) =>
  request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
const hashCommentIp = async (request: Request) =>
  base64url(await crypto.subtle.digest('SHA-256', encoder.encode(commentIp(request))));
const allowCommentRate = (request: Request, paperId: string) => {
  const key = `${commentIp(request)}:${paperId}`;
  const now = Date.now();
  const recent = (commentRate.get(key) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now);
  commentRate.set(key, recent);
  return true;
};

const binaryString = (bytes: Uint8Array) => {
  let result = '';
  for (let index = 0; index < bytes.length; index += 0x8000)
    result += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return result;
};
const base64url = (value: string | ArrayBuffer) => {
  const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value);
  return btoa(binaryString(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const decodeBase64url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return decoder.decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)));
};
const base64 = (value: string) => btoa(binaryString(encoder.encode(value)));
const decodeBase64 = (value: string) =>
  decoder.decode(
    Uint8Array.from(atob(value.replace(/\s/g, '')), (character) => character.charCodeAt(0)),
  );

function corsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    vary: 'Origin',
  };
}
const jsonResponse = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });

async function renewedSessionResponse(
  body: Record<string, unknown>,
  origin: string,
  login: string,
  secret: string,
) {
  const session = await createEditorSession(login, secret);
  const headers = new Headers({
    'content-type': 'application/json',
    'cache-control': 'no-store',
    ...corsHeaders(origin),
  });
  headers.append('Set-Cookie', setCookie('rl_session', session, SESSION_AGE_SECONDS, 'None'));
  return new Response(JSON.stringify({ ...body, session }), { status: 200, headers });
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
async function sign(value: string, secret: string) {
  return base64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(value)));
}
async function signedPayload(value: unknown, secret: string) {
  const body = base64url(JSON.stringify(value));
  return `${body}.${await sign(body, secret)}`;
}
async function verifiedPayload<T>(value: string, secret: string): Promise<T | null> {
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const body = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  try {
    const normalized = signature.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
      (character) => character.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      bytes,
      encoder.encode(body),
    );
    return valid ? (JSON.parse(decodeBase64url(body)) as T) : null;
  } catch {
    return null;
  }
}

export const createEditorSession = (login: string, secret: string, now = Date.now()) =>
  signedPayload({ login, expiresAt: now + SESSION_AGE_SECONDS * 1000 } satisfies Session, secret);

export async function verifyEditorSession(value: string, secret: string, now = Date.now()) {
  const session = await verifiedPayload<Session>(value, secret);
  return session && session.expiresAt > now ? session : null;
}

const setCookie = (name: string, value: string, age: number, sameSite: 'Lax' | 'None') =>
  `${name}=${value}; Max-Age=${age}; Path=/; HttpOnly; Secure; SameSite=${sameSite}`;
const readCookie = (request: Request, name: string) =>
  request.headers.get('Cookie')?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1] || '';
const bearerToken = (request: Request) => {
  const authorization = request.headers.get('Authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};
const derLength = (length: number) => {
  if (length < 128) return Uint8Array.of(length);
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>= 8) bytes.unshift(value & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
};
const joinBytes = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((part) => [...part]));
const pemBytes = (pem: string) => {
  const raw = Uint8Array.from(
    atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')),
    (character) => character.charCodeAt(0),
  );
  if (!pem.includes('BEGIN RSA PRIVATE KEY')) return raw;
  const algorithm = Uint8Array.of(
    0x30,
    0x0d,
    0x06,
    0x09,
    0x2a,
    0x86,
    0x48,
    0x86,
    0xf7,
    0x0d,
    0x01,
    0x01,
    0x01,
    0x05,
    0x00,
  );
  const privateKey = joinBytes(Uint8Array.of(0x04), derLength(raw.length), raw);
  const body = joinBytes(Uint8Array.of(0x02, 0x01, 0x00), algorithm, privateKey);
  return joinBytes(Uint8Array.of(0x30), derLength(body.length), body);
};

async function appJwt(env: Env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID }),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(env.GITHUB_APP_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = base64url(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${header}.${payload}`)),
  );
  return `${header}.${payload}.${signature}`;
}

async function installationToken(env: Env) {
  const result = await fetch(
    `https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await appJwt(env)}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'research-library-editor',
      },
    },
  );
  if (!result.ok) throw new Error(`GitHub installation token failed (${result.status})`);
  return ((await result.json()) as { token: string }).token;
}

function contentUrl(env: Env, path: string, includeRef = true) {
  const branch = env.GITHUB_BRANCH || 'main';
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/${path}`;
  return includeRef ? `${url}?ref=${encodeURIComponent(branch)}` : url;
}
async function getContent(env: Env, token: string, path: string) {
  const result = await fetch(contentUrl(env, path), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'research-library-editor',
    },
  });
  if (!result.ok) return { ok: false as const, status: result.status };
  const value = (await result.json()) as { content: string; sha: string };
  return { ok: true as const, content: decodeBase64(value.content), sha: value.sha };
}

export function configuredOwner(profileYaml: string) {
  const editorBlock = profileYaml.match(/(?:^|\n)editor:\s*\n((?:[ \t]+[^\n]*(?:\n|$))*)/);
  const owner = editorBlock?.[1].match(
    /(?:^|\n)[ \t]+owner_github_username:\s*['"]?([^'"#\r\n]+?)['"]?\s*(?:#.*)?(?:\n|$)/,
  )?.[1];
  return owner?.trim() || '';
}

async function repositoryOwner(env: Env, token: string) {
  const profile = await getContent(env, token, 'config/research-profile.yaml');
  if (!profile.ok) throw new Error('Unable to read Research Profile');
  const owner = configuredOwner(profile.content);
  if (!owner) throw new Error('Research Profile has no editor owner');
  return owner;
}

async function authenticatedOwner(request: Request, env: Env, token: string) {
  const rawSession = bearerToken(request) || readCookie(request, 'rl_session');
  const session = await verifyEditorSession(rawSession, env.SESSION_SECRET);
  if (!session) return null;
  const owner = await repositoryOwner(env, token);
  return session.login.toLowerCase() === owner.toLowerCase() ? session.login : null;
}

function validDataPath(path: unknown): path is string {
  return typeof path === 'string' && /^data\/(papers|user)\/[a-z0-9-]+\.json$/.test(path);
}
const recordId = (path: string) => path.slice(path.lastIndexOf('/') + 1, -5);
const isObject = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (value: JsonRecord, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export function validUserPatch(value: unknown) {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ['deep_read', 'favorite', 'status', 'my_tags', 'my_notes'])
  )
    return false;
  return (
    (value.deep_read === undefined || typeof value.deep_read === 'boolean') &&
    (value.favorite === undefined || typeof value.favorite === 'boolean') &&
    (value.status === undefined ||
      (typeof value.status === 'string' && STATUSES.has(value.status))) &&
    (value.my_tags === undefined || stringArray(value.my_tags)) &&
    (value.my_notes === undefined || typeof value.my_notes === 'string')
  );
}
export function validCommentPayload(value: unknown) {
  if (!isObject(value)) return false;
  const paperId = cleanCommentText(value.paper_id, 120);
  const nickname = cleanCommentText(value.nickname, 40);
  const body = cleanCommentText(value.body, 2000);
  return (
    hasOnlyKeys(value, ['paper_id', 'nickname', 'body', 'website']) &&
    validPaperId(paperId) &&
    nickname.length >= 1 &&
    body.length >= 1 &&
    cleanCommentText(value.website, 80).length === 0 &&
    !/(?:https?:\/\/|www\.)[^\s]+.*(?:https?:\/\/|www\.)[^\s]+/i.test(body)
  );
}

function validQuickRead(value: unknown) {
  if (!isObject(value)) return false;
  const keys = ['tldr', 'problem_and_motivation', 'core_method', 'key_results', 'why_it_matters'];
  return hasOnlyKeys(value, keys) && keys.every((key) => typeof value[key] === 'string');
}
function validResearchQuestions(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every(
      (question) =>
        isObject(question) &&
        hasOnlyKeys(question, [
          'type',
          'question',
          'original_question',
          'how',
          'answer',
          'meaning',
          'source',
        ]) &&
        (question.type === 'explicit' || question.type === 'inferred') &&
        ['question', 'how', 'answer', 'meaning'].every(
          (key) => typeof question[key] === 'string',
        ) &&
        (question.original_question === null ||
          (typeof question.original_question === 'string' && question.original_question.trim())) &&
        (question.type !== 'inferred' || question.original_question === null) &&
        typeof question.source === 'string' &&
        question.source.trim().length > 0 &&
        (question.type !== 'inferred' || /introduction|motivation/i.test(question.source)),
    )
  );
}
function validContributions(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 5 &&
    value.every(
      (item) =>
        isObject(item) &&
        hasOnlyKeys(item, ['contribution', 'source']) &&
        typeof item.contribution === 'string' &&
        item.contribution.trim().length > 0 &&
        (item.source === null ||
          (typeof item.source === 'string' && item.source.trim().length > 0)),
    )
  );
}
function validNextSteps(value: unknown) {
  if (typeof value === 'string') return value.trim().length > 0;
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.length <= 6 &&
    value.every(
      (step) =>
        isObject(step) &&
        hasOnlyKeys(step, [
          'title',
          'rationale',
          'concrete_plan',
          'validation',
          'expected_value',
          'source',
        ]) &&
        ['title', 'rationale', 'concrete_plan', 'validation', 'expected_value'].every(
          (key) => typeof step[key] === 'string' && step[key].trim().length > 0,
        ) &&
        (step.source === undefined ||
          step.source === null ||
          (typeof step.source === 'string' && step.source.trim().length > 0)),
    )
  );
}
function validResearchQuestionsEmptyReason(value: unknown) {
  return (
    typeof value === 'string' &&
    value.trim().length >= 20 &&
    /(?:cannot|could not|unable|does not (?:state|identify|present)|doesn't (?:state|identify|present)|no (?:clear|distinct|reliable) (?:research )?(?:question|objective)|not (?:clear|stated|identified)|unclear|ambiguous|insufficient|lack(?:s|ing)?|无法|不能|未能|未明确|没有明确|未提出|未指出|未说明|缺乏|不足以|不清晰|难以判断)/i.test(
      value,
    )
  );
}
function validDetail(value: unknown, readingBasis?: unknown) {
  if (!isObject(value)) return false;
  const keys = [
    'motivation',
    'contributions',
    'research_questions',
    'research_questions_empty_reason',
    'research_questions_empty_source',
    'method',
    'experiments_and_key_findings',
    'limitations',
    'relation_to_research',
    'what_can_be_done_next',
  ];
  const limitations = value.limitations;
  const hasNoEmptyMetadata =
    value.research_questions_empty_reason === null &&
    value.research_questions_empty_source === null;
  const hasValidEmptyMetadata =
    validResearchQuestionsEmptyReason(value.research_questions_empty_reason) &&
    typeof value.research_questions_empty_source === 'string' &&
    value.research_questions_empty_source.trim().length > 0 &&
    /introduction|motivation/i.test(value.research_questions_empty_source);
  const hasValidResearchQuestionMetadata =
    Array.isArray(value.research_questions) &&
    (value.research_questions.length > 0
      ? hasNoEmptyMetadata
      : readingBasis === 'full_text' || readingBasis === 'official_html'
        ? hasValidEmptyMetadata
        : hasNoEmptyMetadata || hasValidEmptyMetadata);
  return (
    hasOnlyKeys(value, keys) &&
    ['motivation', 'method', 'experiments_and_key_findings', 'relation_to_research'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    validNextSteps(value.what_can_be_done_next) &&
    validContributions(value.contributions) &&
    validResearchQuestions(value.research_questions) &&
    hasValidResearchQuestionMetadata &&
    isObject(limitations) &&
    hasOnlyKeys(limitations, ['author_reported', 'ai_analysis']) &&
    stringArray(limitations.author_reported) &&
    stringArray(limitations.ai_analysis)
  );
}
export function validPaperPatch(value: unknown, readingBasis?: unknown) {
  return (
    isObject(value) &&
    hasOnlyKeys(value, ['quick_read', 'detail']) &&
    (value.quick_read === undefined || validQuickRead(value.quick_read)) &&
    (value.detail === undefined || validDetail(value.detail, readingBasis)) &&
    !(
      (readingBasis === 'abstract_only' || readingBasis === 'abstract_and_metadata') &&
      isObject(value.detail) &&
      Array.isArray(value.detail.research_questions) &&
      value.detail.research_questions.some(
        (question) => isObject(question) && question.type === 'inferred',
      )
    ) &&
    (value.quick_read !== undefined || value.detail !== undefined)
  );
}

function callbackResponse(location: string, session: string) {
  const headers = new Headers({ Location: location });
  headers.append(
    'Set-Cookie',
    setCookie('rl_session', session, session ? SESSION_AGE_SECONDS : 0, 'None'),
  );
  headers.append('Set-Cookie', setCookie('rl_oauth_state', '', 0, 'Lax'));
  return new Response(null, { status: 302, headers });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN.replace(/\/$/, '');
    const origin = request.headers.get('Origin') || '';
    const isTopLevelAuthRoute = url.pathname === '/auth/login' || url.pathname === '/auth/callback';

    if (!isTopLevelAuthRoute && url.pathname !== '/health' && origin !== allowedOrigin)
      return jsonResponse({ error: 'Origin not allowed' }, 403, allowedOrigin);
    if (request.method === 'OPTIONS') {
      if (origin !== allowedOrigin)
        return jsonResponse({ error: 'Origin not allowed' }, 403, allowedOrigin);
      return new Response(null, {
        headers: {
          ...corsHeaders(allowedOrigin),
          'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
          'access-control-allow-headers': 'authorization,content-type',
          'access-control-max-age': '86400',
        },
      });
    }
    if (url.pathname === '/health') return jsonResponse({ ok: true }, 200, origin || allowedOrigin);

    try {
      if (url.pathname === '/auth/login') {
        const requestedReturn = url.searchParams.get('return_to') || `${allowedOrigin}/`;
        const returnUrl = new URL(requestedReturn);
        if (returnUrl.origin !== allowedOrigin)
          return jsonResponse({ error: 'Invalid return URL' }, 400, allowedOrigin);
        returnUrl.hash = '';
        const state = await signedPayload(
          {
            nonce: crypto.randomUUID(),
            returnTo: returnUrl.toString(),
            expiresAt: Date.now() + 600_000,
          } satisfies OAuthState,
          env.SESSION_SECRET,
        );
        const location = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(env.GITHUB_CLIENT_ID)}&state=${encodeURIComponent(state)}&scope=read:user`;
        return new Response(null, {
          status: 302,
          headers: {
            Location: location,
            'Set-Cookie': setCookie('rl_oauth_state', state, 600, 'Lax'),
          },
        });
      }

      if (url.pathname === '/auth/callback') {
        const stateValue = url.searchParams.get('state') || '';
        const state = await verifiedPayload<OAuthState>(stateValue, env.SESSION_SECRET);
        if (
          !state ||
          state.expiresAt <= Date.now() ||
          stateValue !== readCookie(request, 'rl_oauth_state')
        )
          return jsonResponse({ error: 'Invalid OAuth state' }, 400, allowedOrigin);
        const code = url.searchParams.get('code');
        if (!code) return jsonResponse({ error: 'Missing OAuth code' }, 400, allowedOrigin);
        const exchange = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { Accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
          }),
        });
        const oauthToken = ((await exchange.json()) as { access_token?: string }).access_token;
        if (!oauthToken)
          return jsonResponse({ error: 'OAuth exchange failed' }, 401, allowedOrigin);
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'research-library-editor',
          },
        });
        if (!userResponse.ok)
          return jsonResponse({ error: 'GitHub user lookup failed' }, 502, allowedOrigin);
        const login = ((await userResponse.json()) as { login: string }).login;
        const token = await installationToken(env);
        const owner = await repositoryOwner(env, token);
        if (login.toLowerCase() !== owner.toLowerCase())
          return callbackResponse(`${state.returnTo}#editor_error=not-owner`, '');
        const session = await createEditorSession(login, env.SESSION_SECRET);
        return callbackResponse(
          `${state.returnTo}#editor_session=${encodeURIComponent(session)}`,
          session,
        );
      }

      if (url.pathname === '/auth/logout' && request.method === 'POST') {
        const headers = new Headers({
          'content-type': 'application/json',
          ...corsHeaders(allowedOrigin),
        });
        headers.append('Set-Cookie', setCookie('rl_session', '', 0, 'None'));
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      if (url.pathname === '/api/me' && !bearerToken(request) && !readCookie(request, 'rl_session'))
        return jsonResponse({ authenticated: false }, 200, allowedOrigin);

      if (
        url.pathname === '/api/comments' &&
        (request.method === 'GET' || request.method === 'POST')
      ) {
        if (!env.COMMENTS_DB)
          return jsonResponse({ error: 'Comments storage is not configured' }, 503, allowedOrigin);
        if (request.method === 'GET') {
          const paperId = url.searchParams.get('paper_id');
          if (!validPaperId(paperId))
            return jsonResponse({ error: 'Invalid paper id' }, 400, allowedOrigin);
          const result = await env.COMMENTS_DB.prepare(
            'SELECT id, paper_id, nickname, body, created_at FROM comments WHERE paper_id = ?1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100',
          )
            .bind(paperId)
            .all();
          return jsonResponse({ comments: result.results }, 200, allowedOrigin);
        }
        const body = (await request.json().catch(() => null)) as JsonRecord | null;
        if (!validCommentPayload(body))
          return jsonResponse({ error: 'Invalid comment' }, 400, allowedOrigin);
        const paperId = cleanCommentText(body?.paper_id, 120);
        const nickname = cleanCommentText(body?.nickname, 40);
        const commentBody = cleanCommentText(body?.body, 2000);
        if (!allowCommentRate(request, paperId))
          return jsonResponse({ error: 'Too many comments; try again later' }, 429, allowedOrigin);
        const id = crypto.randomUUID();
        await env.COMMENTS_DB.prepare(
          'INSERT INTO comments (id, paper_id, nickname, body, created_at, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
        )
          .bind(
            id,
            paperId,
            nickname,
            commentBody,
            new Date().toISOString(),
            await hashCommentIp(request),
          )
          .run();
        return jsonResponse({ ok: true, id }, 201, allowedOrigin);
      }

      const token = await installationToken(env);
      const login = await authenticatedOwner(request, env, token);

      if (url.pathname === '/api/me')
        return login
          ? renewedSessionResponse(
              { authenticated: true, login },
              allowedOrigin,
              login,
              env.SESSION_SECRET,
            )
          : jsonResponse({ authenticated: false }, 200, allowedOrigin);

      if (!login) return jsonResponse({ error: 'Authentication required' }, 401, allowedOrigin);

      if (url.pathname.startsWith('/api/comments/') && request.method === 'DELETE') {
        if (!env.COMMENTS_DB)
          return jsonResponse({ error: 'Comments storage is not configured' }, 503, allowedOrigin);
        const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length));
        if (!/^[0-9a-f-]{8,80}$/i.test(id))
          return jsonResponse({ error: 'Invalid comment id' }, 400, allowedOrigin);
        await env.COMMENTS_DB.prepare('UPDATE comments SET deleted_at = ?1 WHERE id = ?2')
          .bind(new Date().toISOString(), id)
          .run();
        return renewedSessionResponse({ ok: true }, allowedOrigin, login, env.SESSION_SECRET);
      }

      if (url.pathname === '/api/content' && request.method === 'GET') {
        const path = url.searchParams.get('path');
        if (!validDataPath(path))
          return jsonResponse({ error: 'Invalid data path' }, 400, allowedOrigin);
        const current = await getContent(env, token, path);
        if (!current.ok)
          return jsonResponse({ error: 'Data file not found' }, current.status, allowedOrigin);
        return jsonResponse(
          { path, sha: current.sha, content: JSON.parse(current.content) },
          200,
          allowedOrigin,
        );
      }

      if (url.pathname === '/api/update' && request.method === 'POST') {
        const body = (await request.json()) as {
          path?: string;
          sha?: string;
          patch?: unknown;
          message?: string;
        };
        if (!validDataPath(body.path) || typeof body.sha !== 'string' || !isObject(body.patch))
          return jsonResponse({ error: 'Invalid update payload' }, 400, allowedOrigin);
        const isUserState = body.path.startsWith('data/user/');
        if (isUserState ? !validUserPatch(body.patch) : !validPaperPatch(body.patch))
          return jsonResponse({ error: 'Update contains unsupported fields' }, 400, allowedOrigin);

        const current = await getContent(env, token, body.path);
        if (!current.ok)
          return jsonResponse({ error: 'Data file not found' }, current.status, allowedOrigin);
        if (current.sha !== body.sha)
          return jsonResponse(
            { error: 'Conflict: reload before saving again' },
            409,
            allowedOrigin,
          );
        const record = JSON.parse(current.content) as JsonRecord;
        const id = recordId(body.path);
        if ((isUserState ? record.paper_id : record.id) !== id)
          return jsonResponse({ error: 'Data file identity mismatch' }, 400, allowedOrigin);
        if (!isUserState && !validPaperPatch(body.patch, record.reading_basis))
          return jsonResponse(
            {
              error:
                'Research Questions need a reliable question or, when empty on full text, a reason and Introduction/Motivation locator',
            },
            400,
            allowedOrigin,
          );
        const updated = {
          ...record,
          ...body.patch,
          ...(isUserState ? { manually_edited: true } : { owner_edited: true }),
          updated_at: new Date().toISOString(),
        };
        const updateResponse = await fetch(contentUrl(env, body.path, false), {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'content-type': 'application/json',
            'User-Agent': 'research-library-editor',
          },
          body: JSON.stringify({
            message:
              typeof body.message === 'string' && body.message.trim()
                ? body.message.trim().slice(0, 120)
                : `data: owner update ${id}`,
            content: base64(`${JSON.stringify(updated, null, 2)}\n`),
            sha: current.sha,
            branch: env.GITHUB_BRANCH || 'main',
          }),
        });
        if (updateResponse.status === 409 || updateResponse.status === 422)
          return jsonResponse(
            { error: 'Conflict: reload before saving again' },
            409,
            allowedOrigin,
          );
        if (!updateResponse.ok)
          return jsonResponse({ error: 'GitHub write failed' }, 502, allowedOrigin);
        const result = (await updateResponse.json()) as {
          content?: { sha?: string };
          commit?: { html_url?: string };
        };
        return renewedSessionResponse(
          { ok: true, sha: result.content?.sha, commitUrl: result.commit?.html_url },
          allowedOrigin,
          login,
          env.SESSION_SECRET,
        );
      }
      return jsonResponse({ error: 'Not found' }, 404, allowedOrigin);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: 'Editor backend unavailable' }, 503, allowedOrigin);
    }
  },
};
