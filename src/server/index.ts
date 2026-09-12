import { createRuntimeService } from './runtime/index';
import { createConfigService } from './config/index';
import { serve } from './http';
const app=await serve(await createRuntimeService(),createConfigService(),Number(process.env.PORT??4317),process.argv.includes('--production'));
console.log(`pi workspace: ${app.origin}`);
for(const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,()=>{void app.close().finally(()=>process.exit());});
