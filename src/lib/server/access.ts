import { timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

export const cookieName = 'pi_local';

export function localRequestStatus(request: Request, port: number, token: string): 401 | 403 | null {
  const host = request.headers.get('host');
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return 403;
  const origin = request.headers.get('origin');
  if ((origin && origin !== `http://${host}`) || request.headers.get('sec-fetch-site') === 'cross-site') return 403;
  const path = new URL(request.url).pathname;
  if (path === '/trpc' || path.startsWith('/trpc/')) {
    const value = request.headers.get('cookie')?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';
    const supplied = Buffer.from(value);
    const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return 401;
  }
  return null;
}

export function issueCookie(cookies: Cookies, token: string) {
  cookies.set(cookieName, token, { path: '/', httpOnly: true, sameSite: 'strict', secure: false });
}

export function privateHeaders(response: Response): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
