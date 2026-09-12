import { createTRPCClient, httpLink, httpSubscriptionLink, splitLink } from '@trpc/client';
import type { AppRouter } from '../server/router';

export const api = createTRPCClient<AppRouter>({
  links: [splitLink({
    condition: (operation) => operation.type === 'subscription',
    true: httpSubscriptionLink({ url: '/trpc' }),
    false: httpLink({ url: '/trpc' }),
  })],
});

// JSON transport can omit unknown-valued fields; restore their explicit presence
// for components and the shared workbench callback without asserting wire types.
export function normalizeSnapshot(value: Awaited<ReturnType<typeof api.open.mutate>>): import('../shared/contracts').Snapshot {
  return {
    ...value,
    tools: value.tools.map(tool => ({ ...tool, parameters: tool.parameters })),
    messages: value.messages.map(item => ({ ...item, toolCalls: item.toolCalls?.map(call => ({ ...call, args: call.args })) })),
  };
}
