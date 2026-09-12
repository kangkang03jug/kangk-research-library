type Env = {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  OWNER_GITHUB_USERNAME: string;
  ALLOWED_ORIGIN: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_REPOSITORY: string;
};

const encoder = new TextEncoder();
const base64url = (value: string | ArrayBuffer) => {
  const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};
const base64 = (value: string) => btoa(String.fromCharCode(...encoder.encode(value)));
const response = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      vary: 'Origin',
    },
  });
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
async function signed(value: string, secret: string) {
  return `${value}.${await sign(value, secret)}`;
}
async function verified(value: string, secret: string) {
  const at = value.lastIndexOf('.');
  if (at < 1) return null;
  const body = value.slice(0, at);
  const sig = value.slice(at + 1);
  const bytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  );
  return (await crypto.subtle.verify('HMAC', await hmacKey(secret), bytes, encoder.encode(body)))
    ? body
    : null;
}
const setCookie = (name: string, value: string, age: number) =>
  `${name}=${value}; Max-Age=${age}; Path=/; HttpOnly; Secure; SameSite=Lax`;
const readCookie = (request: Request, name: string) =>
  request.headers.get('Cookie')?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1] || '';
const pemBytes = (pem: string) =>
  Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), (c) =>
    c.charCodeAt(0),
  );
async function sessionOwner(request: Request, env: Env) {
  const session = await verified(readCookie(request, 'rl_session'), env.SESSION_SECRET);
  if (!session) return false;
  const [login, issued] = session.split('.');
  return (
    login === env.OWNER_GITHUB_USERNAME &&
    Number.isFinite(Number(issued)) &&
    Date.now() - Number(issued) < 3600000
  );
}
async function appJwt(env: Env) {
  const now = Math.floor(Date.now() / 1000);
  const head = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(env.GITHUB_APP_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = base64url(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${head}.${body}`)),
  );
  return `${head}.${body}.${sig}`;
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
  if (!result.ok) throw new Error('installation token failed');
  return ((await result.json()) as { token: string }).token;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const authRoute = url.pathname.startsWith('/auth/');
    if (!authRoute && origin !== env.ALLOWED_ORIGIN)
      return response({ error: 'Origin not allowed' }, 403, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS')
      return new Response(null, {
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        },
      });
    if (url.pathname === '/health') return response({ ok: true }, 200, origin);
    if (url.pathname === '/auth/login') {
      const state = await signed(`${crypto.randomUUID()}.${Date.now()}`, env.SESSION_SECRET);
      const location = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(env.GITHUB_CLIENT_ID)}&state=${encodeURIComponent(state)}&scope=read:user`;
      return new Response(null, {
        status: 302,
        headers: { Location: location, 'Set-Cookie': setCookie('rl_oauth_state', state, 600) },
      });
    }
    if (url.pathname === '/auth/callback') {
      const state = url.searchParams.get('state') || '';
      if (
        !state ||
        state !== readCookie(request, 'rl_oauth_state') ||
        !(await verified(state, env.SESSION_SECRET))
      )
        return response({ error: 'Invalid OAuth state' }, 400, origin);
      const code = url.searchParams.get('code');
      if (!code) return response({ error: 'Missing OAuth code' }, 400, origin);
      const exchange = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const token = ((await exchange.json()) as { access_token?: string }).access_token;
      if (!token) return response({ error: 'OAuth exchange failed' }, 401, origin);
      const user = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'research-library-editor',
        },
      });
      const login = ((await user.json()) as { login: string }).login;
      if (login !== env.OWNER_GITHUB_USERNAME)
        return response({ error: 'Only the configured owner may edit' }, 403, origin);
      return new Response(null, {
        status: 302,
        headers: {
          Location: env.ALLOWED_ORIGIN,
          'Set-Cookie': `${setCookie('rl_session', await signed(`${login}.${Date.now()}`, env.SESSION_SECRET), 3600)}, ${setCookie('rl_oauth_state', '', 0)}`,
        },
      });
    }
    if (url.pathname === '/api/me')
      return response({ authenticated: await sessionOwner(request, env) }, 200, origin);
    if (url.pathname === '/api/update' && request.method === 'POST') {
      if (!(await sessionOwner(request, env)))
        return response({ error: 'Authentication required' }, 401, origin);
      const body = (await request.json()) as {
        path?: string;
        content?: string;
        sha?: string;
        message?: string;
      };
      if (
        !body.path ||
        !/^data\/(papers|user)\/[a-z0-9-]+\.json$/.test(body.path) ||
        typeof body.content !== 'string' ||
        typeof body.sha !== 'string'
      )
        return response({ error: 'Invalid update payload' }, 400, origin);
      const token = await installationToken(env);
      const update = await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/${body.path}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'content-type': 'application/json',
            'User-Agent': 'research-library-editor',
          },
          body: JSON.stringify({
            message: body.message || `data: update ${body.path}`,
            content: base64(body.content),
            sha: body.sha,
            branch: 'main',
          }),
        },
      );
      if (update.status === 409)
        return response({ error: 'Conflict: reload before saving again' }, 409, origin);
      if (!update.ok) return response({ error: 'GitHub write failed' }, 502, origin);
      return response({ ok: true }, 200, origin);
    }
    return response({ error: 'Not found' }, 404, origin);
  },
};
