import { describe, expect, it, vi } from 'vitest';
import { issueCookie, localRequestStatus, privateHeaders } from './access';
import type { Cookies } from '@sveltejs/kit';

const token = 'process-token';
function request(path = '/trpc/state', headers: Record<string, string> = {}) {
  return new Request(`http://127.0.0.1:4317${path}`, { headers: { host: '127.0.0.1:4317', cookie: `pi_local=${token}`, ...headers } });
}
describe('local request gate', () => {
  it('accepts only exact loopback host and matching origin, including configured port', () => {
    for (const hostname of ['localhost', '127.0.0.1']) {
      expect(localRequestStatus(request('/', { host: `${hostname}:4317`, origin: `http://${hostname}:4317` }), 4317, token)).toBeNull();
      expect(localRequestStatus(request('/', { host: `${hostname}:4320`, origin: `http://${hostname}:4320` }), 4320, token)).toBeNull();
    }
    for (const headers of [{host: 'evil.example:4317'}, {host: '127.0.0.1:4318'}, {origin:'https://evil.example'}, {origin:'http://localhost:4317'}, {'sec-fetch-site':'cross-site'}] as Record<string, string>[]) {
      expect(localRequestStatus(request('/', headers),4317,token)).toBe(403);
    }
  });
  it('requires the current process cookie for RPC and SSE but allows bootstrap', () => {
    for (const path of ['/trpc', '/trpc/state', '/trpc/events']) {
      expect(localRequestStatus(request(path, {cookie:''}),4317,token)).toBe(401);
      expect(localRequestStatus(request(path, {cookie:'pi_local=old-token'}),4317,token)).toBe(401);
      expect(localRequestStatus(request(path),4317,token)).toBeNull();
    }
    expect(localRequestStatus(request('/api/bootstrap',{cookie:''}),4317,token)).toBeNull();
    expect(localRequestStatus(request('/trpc/state',{cookie:'pi_local=é'.repeat(13)}),4317,token)).toBe(401);
  });
  it('does not trust forwarded headers or use cookie as a substitute for the origin check', () => {
    expect(localRequestStatus(request('/trpc/send', {origin:'http://evil.example', 'x-forwarded-host':'127.0.0.1:4317'}),4317,token)).toBe(403);
  });
  it('issues a host-only HttpOnly strict cookie and non-cacheable private responses', () => {
    const set = vi.fn();
    issueCookie({set} as unknown as Cookies, token);
    expect(set).toHaveBeenCalledWith('pi_local', token, {path:'/',httpOnly:true,sameSite:'strict',secure:false});
    const headers = privateHeaders(new Response()).headers;
    expect(headers.get('cache-control')).toBe('no-store');
    expect(headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
    expect(headers.get('referrer-policy')).toBe('no-referrer');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });
});
