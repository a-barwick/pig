import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { createRuntimeService } from './runtime';
import { createConfigService } from './config';
import { getProcessOwner } from './service-owner';

const owner = getProcessOwner(async () => {
  // Explicit acceptance runs isolate all writes while optionally reusing pi's
  // existing authentication in place. Ordinary startup uses pi's native paths.
  const agentDir = process.env.PI_DASHBOARD_AGENT_DIR;
  const modelRuntime = agentDir && process.env.PI_DASHBOARD_USE_EXISTING_AUTH === '1'
    ? await ModelRuntime.create() : undefined;
  return {
    runtime: await createRuntimeService({ agentDir, modelRuntime }),
    config: createConfigService({ agentDir }),
  };
});

export const getServices = () => owner.get();
export const localToken = owner.token;
