import { building, dev } from '$app/environment';
import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit';
import { localRequestStatus, privateHeaders } from '$lib/server/access';
import { localToken } from '$lib/server/services';

export const init: ServerInit = () => {
  if (building) return;
  if (!dev && process.env.HOST !== '127.0.0.1') {
    throw new Error('Start the local workspace with HOST=127.0.0.1.');
  }
  for (const name of ['ORIGIN', 'PROTOCOL_HEADER', 'HOST_HEADER', 'PORT_HEADER', 'ADDRESS_HEADER', 'XFF_DEPTH', 'SOCKET_PATH']) {
    if (process.env[name]) throw new Error(`The local workspace requires ${name} to be unset.`);
  }
};

export const handle: Handle = async ({ event, resolve }) => {
  const status = localRequestStatus(event.request, Number(process.env.PORT ?? 4317), localToken);
  if (status) return privateHeaders(new Response(status === 401 ? 'Open the workspace page first.' : 'Local access only', {status}));
  return privateHeaders(await resolve(event));
};

// Framework load failures must not put raw SDK/config errors into HTML or logs.
export const handleError: HandleServerError = () => ({ message: 'The local workspace could not load. Restart the server and try again.' });
