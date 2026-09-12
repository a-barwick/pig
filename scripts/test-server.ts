// Explicit acceptance server: temporary configuration, real provider/runtime.
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { createRuntimeService } from '../src/server/runtime/index';
import { createConfigService } from '../src/server/config/index';
import { serve } from '../src/server/http';
import { join } from 'node:path';
const agentDir=join(process.argv[2],'agent');
const app=await serve(await createRuntimeService({agentDir,modelRuntime:await ModelRuntime.create()}),createConfigService({agentDir}),Number(process.env.PORT??4318),true);
console.log(app.origin);
process.once('SIGTERM',()=>{void app.close().finally(()=>process.exit());});
