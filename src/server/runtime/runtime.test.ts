import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { createRuntimeService } from './index';
import { projectMessages } from './projection';
import { redact } from './redaction';
import type { RuntimeService } from '../../shared/contracts';
const roots:string[]=[];const services:RuntimeService[]=[];
afterEach(async()=>{for(const service of services.splice(0))await service.dispose();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function setup(){
 const root=await realpath(await mkdtemp(join(tmpdir(),'pi-dashboard-runtime-')));roots.push(root);
 const agentDir=join(root,'agent'),projectPath=join(root,'project');await mkdir(agentDir);await mkdir(join(projectPath,'.pi','skills','example'),{recursive:true});
 await writeFile(join(agentDir,'settings.json'),JSON.stringify({defaultProjectTrust:'ask',defaultThinkingLevel:'high',unrelated:{keep:true}}));
 const resourceId=join(projectPath,'.pi','skills','example','SKILL.md');const content='---\nname: example\ndescription: Isolated test skill\n---\nSay a test greeting.';await writeFile(resourceId,content);
 const service=await createRuntimeService({agentDir});services.push(service);
 return {service,agentDir,projectPath,resourceId,revision:createHash('sha256').update(content).digest('hex')};
}
const settle=()=>new Promise(r=>setTimeout(r,30));
describe('real isolated SDK runtime',()=>{
 it('uses ask fallback then explicit trust loads the real skill, preserving global settings',async()=>{
  const {service,agentDir,projectPath,resourceId}=await setup();const before=await readFile(join(agentDir,'settings.json'),'utf8');
  const first=await service.open({projectPath});expect(first.trust.trusted).toBe(false);expect(first.resources.some(r=>r.path===resourceId&&r.loaded)).toBe(false);expect(first.tools.length).toBeGreaterThan(0);
  await settle();const trusted=await service.trust(projectPath);expect(trusted.trust.trusted).toBe(true);expect(trusted.resources.some(r=>r.path===resourceId&&r.loaded)).toBe(true);
  await settle();await service.select({sessionId:trusted.sessionId,thinking:'low'});expect(await readFile(join(agentDir,'settings.json'),'utf8')).toBe(before);
 });
 it('reconnects with authoritative ordered snapshots, no replay, and rejects stale sessions',async()=>{
  const {service,projectPath}=await setup();const first=await service.open({projectPath});await settle();const controller=new AbortController();const feed=service.events(controller.signal)[Symbol.asyncIterator]();
  expect((await feed.next()).value?.snapshot?.sessionId).toBe(first.sessionId);
  const pending=feed.next();await service.select({sessionId:first.sessionId,thinking:'off'});const next=(await pending).value!;expect(next.cursor).toBeGreaterThan(first.cursor);expect(next.snapshot?.thinking).toBe('off');
  controller.abort();await feed.return?.();const second=await service.open({projectPath});await settle();expect(second.sessionId).not.toBe(first.sessionId);await expect(service.stop(first.sessionId)).rejects.toThrow('no longer active');
 });
 it('resumes a persisted SDK transcript without rerunning its tools',async()=>{
  const {service,projectPath}=await setup();const first=await service.open({projectPath});await settle();
  const sm=SessionManager.create(projectPath,dirname(first.sessionFile!));sm.appendMessage({role:'user',content:'Previously saved input',timestamp:Date.now()});
  // pi writes a new transcript after an assistant message is appended.
  sm.appendMessage({role:'assistant',content:[{type:'text',text:'Previously saved answer'}],api:'openai-responses',provider:'openai',model:'test',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:Date.now()});
  const listed=await service.sessions(projectPath);expect(listed).toHaveLength(1);const resumed=await service.open({projectPath,sessionPath:listed[0].path});expect(resumed.messages.map(m=>m.text)).toEqual(['Previously saved input','Previously saved answer']);expect(resumed.status).toBe('running');await settle();expect(service.snapshot()?.status).toBe('idle');
 });
 it('rejects stale saved revisions and does not bypass trust during trials',async()=>{
  const {service,projectPath,resourceId,revision}=await setup();await expect(service.trial({projectPath,resourceId,revision:'stale',prompt:'test'})).rejects.toThrow('revision changed');
  await expect(service.trial({projectPath,resourceId,revision,prompt:'test'})).rejects.toThrow('not loaded');expect(service.snapshot()?.trial).toBeUndefined();
 });
 it('delivers prompt failures as error snapshots rather than claiming completion',async()=>{
  const {service,projectPath}=await setup();const s=await service.open({projectPath});await settle();const accepted=await service.send({sessionId:s.sessionId,requestId:'test-request',text:'hello'});expect(accepted.accepted).toBe(true);await settle();expect(service.snapshot()?.status).toBe('error');expect(service.snapshot()?.error).toBeTruthy();
  expect(await service.send({sessionId:s.sessionId,requestId:'test-request',text:'hello'})).toEqual(accepted);
 });
});
it('projects distinct tool calls with actual structured arguments and results',()=>{
 const history:any[]=[{role:'assistant',timestamp:1,content:[{type:'toolCall',id:'one',name:'bash',arguments:{command:'true'}},{type:'toolCall',id:'two',name:'bash',arguments:{command:'false'}}]}, {role:'toolResult',toolCallId:'one',content:[{type:'text',text:'ok'}],details:{exitCode:0},isError:false,timestamp:2},{role:'toolResult',toolCallId:'two',content:[{type:'text',text:'bad'}],details:{exitCode:1},isError:true,timestamp:3}];
 const output=projectMessages(history,new Map());expect(output[0].toolCalls?.map(t=>t.status)).toEqual(['completed','failed']);expect(output[0].toolCalls?.[1].args).toEqual({command:'false'});expect(output[0].toolCalls?.[1].result).toMatchObject({details:{exitCode:1}});
});

 it('redacts credentials while retaining ordinary tool evidence and unknown outcomes',()=>{const output=projectMessages([{role:'assistant',content:[{type:'text',text:'Authorization: Bearer abc123.secret-token'},{type:'toolCall',id:'missing',name:'http',arguments:{apiKey:'secret',path:'src/app.ts'}}]}],new Map());expect(output[0].text).toContain('[REDACTED]');expect(output[0].text).not.toContain('abc123');expect(output[0].toolCalls?.[0].args).toEqual({apiKey:'[REDACTED]',path:'src/app.ts'});expect(output[0].toolCalls?.[0].status).toBe('unknown');});

it('surfaces supported startup dialogs without hanging open and rejects unsupported terminal UI',async()=>{
 const {service,projectPath}=await setup();await mkdir(join(projectPath,'.pi','extensions'),{recursive:true});
 await writeFile(join(projectPath,'.pi','extensions','dialog.ts'),`export default function(pi) { pi.on('session_start', async (_event, ctx) => { const choice = await ctx.ui.select('Choose a test option', ['one', 'two']); const confirmed = await ctx.ui.confirm('Confirm test', choice); const text = await ctx.ui.input('Input test', 'placeholder'); const edited = await ctx.ui.editor('Editor test', text); ctx.ui.notify(edited); await ctx.ui.custom(() => {}); }); }`);
 await service.open({projectPath});await settle();const opened=await service.trust(projectPath);expect(opened.status).toBe('running');await settle();
 for(const [kind,value] of [['select','two'],['confirm',true],['input','test input'],['editor','edited text']] as const){const d=service.snapshot()!.dialogs.find(d=>d.kind===kind)!;expect(d).toBeTruthy();await service.answer({dialogId:d.id,value});await settle();}
 expect(service.snapshot()!.dialogs.some(d=>d.title.includes('Unsupported extension UI'))).toBe(true);
});

it('stop releases a pending extension dialog and reports cancellation request separately',async()=>{
 const {service,projectPath}=await setup();await mkdir(join(projectPath,'.pi','extensions'),{recursive:true});
 await writeFile(join(projectPath,'.pi','extensions','wait.ts'),`export default function(pi) { pi.on('session_start', async (_event, ctx) => { await ctx.ui.input('Waiting for input'); }); }`);
 await service.open({projectPath});await settle();await service.trust(projectPath);await settle();const snapshot=service.snapshot()!;expect(snapshot.status).toBe('running');expect(snapshot.dialogs.some(d=>d.kind==='input')).toBe(true);
 const abort=new AbortController();const feed=service.events(abort.signal)[Symbol.asyncIterator]();await feed.next();const next=feed.next();await service.stop(snapshot.sessionId);expect((await next).value?.kind).toBe('cancel_requested');await settle();expect(service.snapshot()?.dialogs).toHaveLength(0);expect(service.snapshot()?.status).toBe('idle');abort.abort();await feed.return?.();
});

it('resumes across canonical and symlinked agent-directory paths',async()=>{
 const {service,agentDir,projectPath}=await setup();const first=await service.open({projectPath});await settle();
 const sm=SessionManager.create(projectPath,dirname(first.sessionFile!));sm.appendMessage({role:'user',content:'Alias resume evidence',timestamp:Date.now()});sm.appendMessage({role:'assistant',content:[{type:'text',text:'Saved response'}],api:'openai-responses',provider:'openai',model:'test',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:Date.now()});
 const alias=join(dirname(agentDir),'agent-alias');await symlink(agentDir,alias,'dir');const second=await createRuntimeService({agentDir:alias});services.push(second);const listed=await second.sessions(projectPath);const resumed=await second.open({projectPath,sessionPath:listed[0].path});expect(resumed.messages[0].text).toBe('Alias resume evidence');
});

it('redacts credentials embedded in raw JSON and shell output',()=>{const input='{"access_token":"private-access","refresh_token":"private-refresh"} API_KEY=private-key Authorization: Bearer private-bearer';const result=redact(input);expect(result).not.toContain('private-');expect(result).toContain('[REDACTED]');});
