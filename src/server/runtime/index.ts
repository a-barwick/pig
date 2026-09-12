import { createHash, randomUUID } from 'node:crypto';
import { realpath, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, ProjectTrustStore, getAgentDir, hasTrustRequiringProjectResources } from '@earendil-works/pi-coding-agent';
import type { AgentSession, AgentSessionEvent, ExtensionUIContext } from '@earendil-works/pi-coding-agent';
import type { RuntimeService, Snapshot, RuntimeEvent, ToolCall, Dialog, Resource, Accepted } from '../../shared/contracts';
import { copy, projectMessages } from './projection';

export interface RuntimeOptions { agentDir?: string; modelRuntime?: ModelRuntime; }
export async function createRuntimeService(options: RuntimeOptions = {}): Promise<RuntimeService> {
  const agentDir = options.agentDir ?? getAgentDir();
  const models = options.modelRuntime ?? await ModelRuntime.create({authPath:join(agentDir,'auth.json'),modelsPath:join(agentDir,'models.json'),modelsStorePath:join(agentDir,'models-store.json')});
  const trustStore = new ProjectTrustStore(agentDir);
  let session: AgentSession | undefined, state: Snapshot | null = null;
  let unsubscribe = () => {}, cursor = 0, replacing = false, disposed = false;
  let task: Promise<void> | undefined;
  let trialBody: string | undefined;
  let calls = new Map<string,ToolCall>();
  const listeners = new Set<(e:RuntimeEvent)=>void>();
  const requests = new Map<string,Accepted>();
  const pending = new Map<string,{dialog:Dialog; finish:(value:unknown)=>void}>();
  const emit = (kind:RuntimeEvent['kind']='snapshot', extra:Partial<RuntimeEvent>={}) => {
    if (!state) return;
    state.cursor = ++cursor;
    const event:RuntimeEvent = copy({cursor,sessionId:state.sessionId,kind,snapshot:state,...extra});
    for (const listener of listeners) listener(event);
  };
  const refresh = () => {
    if (!state || !session) return;
    state.sessionFile = session.sessionFile;
    state.model = session.model && {id:session.model.id,provider:session.model.provider,name:session.model.name};
    state.thinking = session.thinkingLevel;
    const active = new Set(session.getActiveToolNames());
    state.tools = session.getAllTools().map(t=>({name:t.name,description:t.description,parameters:t.parameters,active:active.has(t.name),source:t.sourceInfo?.source ?? 'unknown',path:t.sourceInfo?.path}));
    state.messages = projectMessages(session.messages,calls);
  };
  const fail = (error:unknown) => {if(state){state.error=error instanceof Error ? error.message : String(error);state.status='error';refresh();emit('error',{message:state.error});}};
  const cancelDialogs = () => { for(const p of [...pending.values()]) p.finish(undefined); };
  const notice = (title:string) => {if(state){state.dialogs.push({id:randomUUID(),kind:'unsupported',title});emit();}};
  const dialog = (kind:Dialog['kind'],title:string,fields:Partial<Dialog>={},opts?:{signal?:AbortSignal;timeout?:number}):Promise<any> => {
    if(opts?.signal?.aborted) return Promise.resolve(undefined);
    const id=randomUUID();
    return new Promise(resolve=>{
      let timer:ReturnType<typeof setTimeout>|undefined;
      const abort=()=>finish(undefined);
      const finish=(value:unknown)=>{clearTimeout(timer);opts?.signal?.removeEventListener('abort',abort);pending.delete(id);if(state)state.dialogs=state.dialogs.filter(d=>d.id!==id);emit();resolve(value);};
      const d={id,kind,title,...fields};pending.set(id,{dialog:d,finish});state?.dialogs.push(d);
      opts?.signal?.addEventListener('abort',abort,{once:true});if(opts?.timeout)timer=setTimeout(abort,opts.timeout);emit();
    });
  };
  const ui = new Proxy({
    select:(title:string,choices:string[],opts:any)=>dialog('select',title,{options:choices},opts),
    confirm:async(title:string,message:string,opts:any)=>Boolean(await dialog('confirm',title,{message},opts)),
    input:(title:string,placeholder:string,opts:any)=>dialog('input',title,{message:placeholder},opts),
    editor:(title:string,prefill:string)=>dialog('editor',title,{initialValue:prefill}),
    notify:(message:string)=>notice(message),
    custom:async()=>{notice('Unsupported extension UI: custom terminal component');throw new Error('Custom terminal UI is unsupported in Pi Dashboard');},
  },{get(target,key){if(key in target)return Reflect.get(target,key);return (..._args:unknown[])=>{notice(`Unsupported extension UI: ${String(key)}`);if(key==='onTerminalInput')return ()=>{};if(key==='getEditorText')return '';if(key==='getAllThemes')return [];if(key==='setTheme')return {success:false,error:'Browser does not support terminal themes'};if(key==='getToolsExpanded')return false;return undefined;};}}) as unknown as ExtensionUIContext;
  const onEvent = (s:AgentSession,e:AgentSessionEvent) => {
    if(s!==session||!state)return;
    if(e.type==='agent_start')state.status='running';
    if(e.type==='agent_end' && !task)state.status='idle';
    if(e.type==='tool_execution_start')calls.set(e.toolCallId,{id:e.toolCallId,name:e.toolName,args:e.args,status:'running',startedAt:Date.now()});
    if(e.type==='tool_execution_update'){const c=calls.get(e.toolCallId);if(c){c.result=e.partialResult;c.outputNote='Partial streamed output; final result pending.';}}
    if(e.type==='tool_execution_end'){const c=calls.get(e.toolCallId);if(c){c.result=e.result;c.status=e.isError?'failed':'completed';c.endedAt=Date.now();if(state.status==='stopping' && e.isError)c.outputNote='Tool reported an error after cancellation was requested; cancellation is not independently confirmed.';else delete c.outputNote;}}
    refresh();
    // message_update arrives before the finalized message enters session.messages.
    if(e.type==='message_update'||e.type==='message_start') {
      const messages=[...s.messages];if(messages.at(-1)!==e.message)messages.push(e.message);
      state.messages=projectMessages(messages,calls);
    }
    if(state.trial && trialBody !== undefined)state.trial.loaded=state.messages.some(m=>m.role==='user' && m.text.includes('<skill name=') && m.text.includes(trialBody!));
    emit();
  };
  const requireSession=(id:string)=>{if(disposed||replacing||!session||state?.sessionId!==id)throw new Error('Session is no longer active');return session;};
  const idle=()=>{if(replacing||task||session?.isStreaming)throw new Error('Stop or finish the active turn first');};
  const canonical=async(path:string)=>{const p=await realpath(path);if(!(await stat(p)).isDirectory())throw new Error('Project must be a directory');return p;};
  const sessionDir=(cwd:string)=>join(agentDir,'sessions',`--${cwd.replace(/^[/\\]/,'').replace(/[/\\:]/g,'-')}--`);
  const service:RuntimeService = {
    async open(input){
      idle();if(disposed)throw new Error('Runtime is disposed');replacing=true;
      try {
        const cwd=await canonical(input.projectPath);
        let manager:SessionManager;
        if(input.sessionPath){const known=await SessionManager.list(cwd,sessionDir(cwd));const path=await realpath(input.sessionPath);if(!(await Promise.all(known.map(s=>realpath(s.path)))).includes(path))throw new Error('Session does not belong to this project');manager=SessionManager.open(path);}
        else manager=SessionManager.create(cwd,sessionDir(cwd));
        const settings=SettingsManager.create(cwd,agentDir,{projectTrusted:false});
        const decision=trustStore.get(cwd), policy=settings.getDefaultProjectTrust();
        const trusted=decision ?? (hasTrustRequiringProjectResources(cwd) ? policy==='always' : true);
        settings.setProjectTrusted(trusted);await settings.reload();
        const loader=new DefaultResourceLoader({cwd,agentDir,settingsManager:settings});await loader.reload();
        const result=await createAgentSession({cwd,agentDir,modelRuntime:models,settingsManager:settings,resourceLoader:loader,sessionManager:manager});
        unsubscribe();cancelDialogs();session?.dispose();session=result.session;calls=new Map();requests.clear();trialBody=undefined;
        const reason=trusted ? (decision===true?'Explicit saved project trust':'Project trust policy permits loading') : (decision===false?'Project explicitly untrusted':`Project resources skipped: ${policy} trust fallback; choose Trust to load`);
        const resources:Resource[]=[
          ...loader.getSkills().skills.map(s=>({kind:'skill' as const,name:s.name,path:s.filePath,loaded:true,source:s.sourceInfo.source})),
          ...loader.getExtensions().extensions.map(e=>({kind:'extension' as const,name:e.path,path:e.resolvedPath,loaded:true,source:e.sourceInfo.source})),
          ...loader.getExtensions().errors.map(e=>({kind:'extension' as const,name:e.path,path:e.path,loaded:false,source:'pi loader',reason:e.error})),
          ...loader.getAgentsFiles().agentsFiles.map(f=>({kind:'instruction' as const,name:'AGENTS.md',path:f.path,loaded:true,source:'pi context loader'})),
          ...loader.getPrompts().prompts.map(p=>({kind:'prompt' as const,name:p.name,path:p.filePath,loaded:true,source:p.sourceInfo.source})),
        ];
        if(!trusted)for(const [kind,path] of [['skill','.pi/skills'],['skill','.agents/skills'],['extension','.pi/extensions']] as const)resources.push({kind,name:path,path:join(cwd,path),loaded:false,source:'project discovery root',reason});
        state={sessionId:session.sessionId,projectPath:cwd,status:'running',messages:[],tools:[],resources,thinking:session.thinkingLevel,models:models.getAvailableSnapshot().map(m=>({id:m.id,provider:m.provider,name:m.name})),dialogs:[],cursor,trust:{trusted,reason},error:result.modelFallbackMessage};
        const current=session;unsubscribe=session.subscribe(e=>onEvent(current,e));refresh();emit();
        // Session-start hooks may await browser dialogs; do not block open on them.
        task=session.bindExtensions({uiContext:ui,mode:'rpc',onError:e=>fail(e.error)}).catch(fail).finally(()=>{task=undefined;refresh();if(state && state.status!=='error')state.status='idle';emit();});
        return copy(state);
      }finally{replacing=false;}
    },
    snapshot(){return state ? copy(state):null;},
    async sessions(projectPath){const cwd=await canonical(projectPath);return Promise.all((await SessionManager.list(cwd,sessionDir(cwd))).map(async s=>({id:s.id,path:await realpath(s.path),name:s.name||s.firstMessage||'Untitled conversation',updatedAt:s.modified.toISOString()})));},
    async send(input){
      const s=requireSession(input.sessionId);const prior=requests.get(input.requestId);if(prior)return prior;
      idle();if(!input.text.trim())throw new Error('Message is empty');
      const accepted:Accepted={accepted:true,sessionId:s.sessionId,requestId:input.requestId};requests.set(input.requestId,accepted);
      state!.status='running';state!.error=undefined;emit('accepted',{requestId:input.requestId});
      task=s.prompt(input.text).catch(error=>{if(s===session)fail(error);}).finally(()=>{if(s===session){task=undefined;refresh();if(state!.status!=='error')state!.status='idle';emit();}});
      return accepted;
    },
    async steer(input){const s=requireSession(input.sessionId);const prior=requests.get(input.requestId);if(prior)return prior;if(!s.isStreaming)throw new Error('Steering requires a running turn');await s.steer(input.text);const accepted:Accepted={accepted:true,sessionId:s.sessionId,requestId:input.requestId};requests.set(input.requestId,accepted);emit('accepted',{requestId:input.requestId});return accepted;},
    async stop(id){const s=requireSession(id);state!.status='stopping';emit('cancel_requested');cancelDialogs();void s.abort().then(()=>{if(s===session){refresh();state!.status='idle';emit();}}).catch(fail);return {requested:true};},
    async select(input){const s=requireSession(input.sessionId);idle();if(input.model){const model=models.getModel(input.model.provider,input.model.id);if(!model)throw new Error('Unknown model');await s.setModel(model,{persist:false});}if(input.thinking)s.setThinkingLevel(input.thinking,{persist:false});refresh();emit();return copy(state!);},
    async trust(projectPath){idle();const cwd=await canonical(projectPath);if(state?.projectPath!==cwd)throw new Error('Open the project before granting trust');trustStore.set(cwd,true);return service.open({projectPath:cwd,sessionPath:session?.sessionFile && (await service.sessions(cwd)).some(s=>s.id===session!.sessionId) ? session.sessionFile:undefined});},
    async answer(input){const p=pending.get(input.dialogId);if(!p){if(state?.dialogs.some(d=>d.id===input.dialogId)){state.dialogs=state.dialogs.filter(d=>d.id!==input.dialogId);emit();return;}throw new Error('Dialog is no longer pending');}if(!input.cancelled){if(p.dialog.kind==='confirm'&&typeof input.value!=='boolean')throw new Error('Confirmation requires a boolean');if(p.dialog.kind!=='confirm'&&typeof input.value!=='string')throw new Error('Dialog requires text');if(p.dialog.kind==='select'&&!p.dialog.options?.includes(input.value as string))throw new Error('Invalid selection');}p.finish(input.cancelled?undefined:input.value);},
    async trial(input){
      idle();const path=await realpath(input.resourceId);const hash=()=>readFile(path).then(bytes=>createHash('sha256').update(bytes).digest('hex'));
      if(await hash()!==input.revision)throw new Error('Saved skill revision changed; reload before trying');
      await service.open({projectPath:input.projectPath});if(task){if(pending.size)throw new Error('Answer the pending startup dialog before trying the skill');await task;}
      const candidates=state!.resources.filter(r=>r.kind==='skill'&&r.loaded);
      const resource=(await Promise.all(candidates.map(async r=>({resource:r,path:await realpath(r.path)})))).find(r=>r.path===path)?.resource;if(!resource)throw new Error('Saved skill was not loaded by pi; check project trust and discovery');
      if(await hash()!==input.revision)throw new Error('Skill changed while loading; retry with the current revision');
      const invocation=`/skill:${resource.name}${input.prompt.trim() ? ` ${input.prompt.trim()}`:''}`;
      trialBody=(await readFile(path,'utf8')).replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'').trim();
      state!.trial={path,revision:input.revision,invocation,loaded:false};
      await service.send({sessionId:state!.sessionId,requestId:randomUUID(),text:invocation});return copy(state!);
    },
    async *events(signal){
      let queue:RuntimeEvent[]=[], wake:(()=>void)|undefined;
      const listener=(event:RuntimeEvent)=>{queue.push(event);wake?.();};listeners.add(listener);
      const abort=()=>wake?.();signal?.addEventListener('abort',abort);
      if(state)queue.push({cursor:state.cursor,sessionId:state.sessionId,kind:'snapshot',snapshot:copy(state)});
      try{while(!signal?.aborted&&!disposed){if(!queue.length)await new Promise<void>(r=>{wake=r;});wake=undefined;for(const event of queue.splice(0))yield event;}}finally{listeners.delete(listener);signal?.removeEventListener('abort',abort);}
    },
    async dispose(){disposed=true;cancelDialogs();await session?.abort();await task;unsubscribe();session?.dispose();for(const l of listeners)l({cursor:++cursor,sessionId:state?.sessionId??'',kind:'error',message:'Runtime disposed'});listeners.clear();},
  };
  return service;
}
