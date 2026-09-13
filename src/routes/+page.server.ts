import type { PageServerLoad } from './$types';
import { getServices, localToken } from '$lib/server/services';
import { issueCookie } from '$lib/server/access';

export const prerender = false;

export const load: PageServerLoad = async ({ cookies }) => {
  issueCookie(cookies, localToken);
  const { runtime } = await getServices();
  // snapshot() is the runtime's redacted plain-data boundary. Opening/resuming
  // a project is an explicit command and never a page-load side effect.
  return { snapshot: runtime.snapshot() };
};
