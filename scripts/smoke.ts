/** Explicit live-provider acceptance run. Uses temporary settings, trust and sessions. */
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { createRuntimeService } from '../src/server/runtime/index';
import { createConfigService } from '../src/server/config/index';
import type { Snapshot, RuntimeService } from '../src/shared/contracts';
const root=await mkdtemp(join(tmpdir(),'pi-dashboard-smoke-'));
const agentDir=join(root,'agent');const projectPath=join(root,'project');
await mkdir(agentDir);await mkdir(projectPath);
const globalPath=join(homedir(),'.pi/agent/settings.json');
const actualGlobal=await readFile(globalPath);
const actual=JSON.parse(actualGlobal.toString());
const model={provider:actual.defaultProvider??'openai-codex',id:actual.defaultModel??'gpt-5.6-sol'};
const baseline=JSON.stringify({defaultProvider:model.provider,defaultModel:model.id,defaultThinkingLevel:'high',defaultProjectTrust:'ask',customMetadata:{keep:true}});
await writeFile(join(agentDir,'settings.json'),baseline);
const modelRuntime=await ModelRuntime.create();
const options={agentDir,modelRuntime};
let runtime:RuntimeService=await createRuntimeService(options);
const config=createConfigService({agentDir});
const report:Record<string,unknown>={root,model};
async function settled(){const until=Date.now()+180_000;while(Date.now()<until){const s=runtime.snapshot()!;if(s.status!=='running'&&s.status!=='stopping')return s;await new Promise(r=>setTimeout(r,100));}throw new Error('Turn timed out');}
function calls(s:Snapshot){return s.messages.flatMap(m=>m.toolCalls??[]);}
try{
 const content='---\nname: dashboard-smoke\ndescription: Explicit dashboard acceptance skill.\n---\nReply with SKILL_REVISION_ONE.\n';
 let saved=await config.saveSkill({projectPath,name:'dashboard-smoke',scope:'project',expectedRevision:null,content});assert(saved.ok);
 const resourceId=saved.path;
 let state=await runtime.open({projectPath});state=await settled();
 assert(!state.trust.trusted);assert(state.resources.some(r=>r.kind==='skill'&&!r.loaded&&r.reason));report.untrustedResources=true;
 await runtime.trust(projectPath);await settled();
 state=await runtime.open({projectPath});state=await settled();assert(state.resources.some(r=>r.kind==='skill'&&r.loaded));
 let settings=await config.settings({projectPath,scope:'project'});
 let settingSave=await config.saveSettings({projectPath,scope:'project',expectedRevision:settings.revision,thinking:'medium'});assert(settingSave.ok);
 state=await runtime.open({projectPath});state=await settled();assert.equal(state.thinking,'medium');assert.equal(await readFile(join(agentDir,'settings.json'),'utf8'),baseline);
 settings=await config.settings({projectPath,scope:'project'});
 settingSave=await config.saveSettings({projectPath,scope:'project',expectedRevision:settings.revision,thinking:null});assert(settingSave.ok);
 state=await runtime.open({projectPath});state=await settled();assert.equal(state.thinking,'high');report.scopedDefaults=true;
 await runtime.select({sessionId:state.sessionId,thinking:'low'});
 await runtime.send({sessionId:state.sessionId,requestId:'tools',text:'Use bash twice: first run printf PI_TOOL_OK; then run a separate bash command that prints PI_EXPECTED_FAILURE to stderr and exits 7. Report their results briefly. Do not modify files.'});
 state=await settled();assert(calls(state).some(c=>c.status==='completed'));assert(calls(state).some(c=>c.status==='failed'));assert(calls(state).every(c=>state.tools.some(t=>t.name===c.name)));report.tools=calls(state).map(c=>({name:c.name,status:c.status,args:!!c.args,result:!!c.result}));
 await runtime.send({sessionId:state.sessionId,requestId:'cancel',text:'Run bash sleep 30 now, then say SLEEP_DONE.'});
 const deadline=Date.now()+60_000;while(!calls(runtime.snapshot()!).some(c=>c.status==='running')){assert(Date.now()<deadline,'Sleep tool did not start');await new Promise(r=>setTimeout(r,100));}
 await runtime.steer({sessionId:state.sessionId,requestId:'steer',text:'After cancellation, acknowledge STEERING_RECEIVED and do not run another sleep.'});
 await runtime.stop(state.sessionId);state=await settled();report.cancellation={status:state.status,steerAccepted:true};
 const sessionPath=state.sessionFile!;assert(sessionPath);const count=state.messages.length;
 await runtime.dispose();runtime=await createRuntimeService(options);state=await runtime.open({projectPath,sessionPath});state=await settled();assert.equal(state.messages.length,count);assert.equal(state.status,'idle');report.resumeAfterRuntimeRestart=true;
 let skill=await config.readSkill({projectPath,resourceId});await writeFile(resourceId,content+'\nExternal change\n');
 const conflict=await config.saveSkill({projectPath,resourceId,name:skill.name,scope:'project',expectedRevision:skill.revision,content:content+'Draft'});assert(!conflict.ok&&conflict.conflict);report.conflict=true;
 skill=await config.readSkill({projectPath,resourceId});saved=await config.saveSkill({projectPath,resourceId,name:skill.name,scope:'project',expectedRevision:skill.revision,content:content.replace('ONE','TWO')});assert(saved.ok);
 state=await runtime.trial({projectPath,resourceId,revision:saved.revision,prompt:'Follow the saved skill now.'});state=await settled();assert(state.trial?.loaded);assert.equal(state.trial?.revision,saved.revision);assert(state.messages.some(m=>m.role==='assistant'&&m.text.includes('SKILL_REVISION_TWO')));report.savedRevisionTrial=state.trial;
 assert.deepEqual(await readFile(globalPath),actualGlobal);report.actualGlobalSettingsPreserved=true;report.globalSettingsHash=createHash('sha256').update(actualGlobal).digest('hex');
 console.log(JSON.stringify(report,null,2));
} finally {await runtime.dispose();}
