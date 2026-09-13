import { randomBytes } from 'node:crypto';
import type { RuntimeService, ConfigService } from '../shared/contracts.ts';

export interface Services { runtime: RuntimeService; config: ConfigService }

// One intentional process-wide pi workspace. The factory stays injectable for tests.
export function createServiceOwner(factory: () => Promise<Services>) {
  let services: Promise<Services> | undefined;
  let disposal: Promise<void> | undefined;
  let stopping = false;
  return {
    token: randomBytes(32).toString('hex'),
    get() {
      if (stopping) return Promise.reject(new Error('Workspace is shutting down.'));
      return services ??= factory();
    },
    dispose() {
      stopping = true;
      return disposal ??= (async () => {
        if (services) await (await services).runtime.dispose();
      })();
    },
  };
}

const ownerKey = Symbol.for('pi-dashboard.process-services');
type Owner = ReturnType<typeof createServiceOwner> & { detach?: () => void };
const processState = globalThis as typeof globalThis & { [ownerKey]?: Owner };

export function getProcessOwner(factory: () => Promise<Services>): Owner {
  if (!processState[ownerKey]) {
    const owner: Owner = processState[ownerKey] = createServiceOwner(factory);
    const stop = () => { void owner.dispose().catch(() => console.error('Workspace shutdown failed.')); };
    // Begin pi cancellation while adapter-node drains HTTP/SSE, then reuse the
    // same disposal promise on its shutdown event. HMR retains this one owner.
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    process.on('sveltekit:shutdown', stop);
    owner.detach = () => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      process.off('sveltekit:shutdown', stop);
    };
  }
  return processState[ownerKey];
}

export async function disposeProcessServices() {
  const owner = processState[ownerKey];
  try { await owner?.dispose(); }
  finally {
    owner?.detach?.();
    if (processState[ownerKey] === owner) delete processState[ownerKey];
  }
}
