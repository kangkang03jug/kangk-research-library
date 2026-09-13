/** Build a route that is safe for both root-hosted and GitHub Pages project sites. */
export function withBase(pathname: string, baseUrl: string) {
  const basePart = baseUrl.replace(/^\/+|\/+$/g, '');
  const normalizedBase = basePart ? `/${basePart}` : '';
  const normalizedPath = pathname === '/' ? '' : `/${pathname.replace(/^\/+|\/+$/g, '')}/`;
  return `${normalizedBase}${normalizedPath || '/'}`;
}
