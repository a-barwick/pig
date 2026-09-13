import type { RequestHandler } from './$types';
import { localToken } from '$lib/server/services';
import { issueCookie } from '$lib/server/access';

export const GET: RequestHandler = ({ cookies }) => {
  issueCookie(cookies, localToken);
  return new Response(null, {status:204});
};
