import type { RequestHandler } from './$types';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '$lib/server/router';
import { getServices } from '$lib/server/services';

const handler: RequestHandler = async ({ request }) => fetchRequestHandler({
  endpoint: '/trpc',
  req: request,
  router: appRouter,
  createContext: getServices,
});

export { handler as GET, handler as POST };
