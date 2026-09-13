// Provider-free checks against the actual Kit dev and adapter-node servers.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { request as httpRequest } from 'node:http';

function rawRequest(url: string, headers: Record<string,string>, body?: string) {
  return new Promise<{status:number; body:string; headers:import('node:http').IncomingHttpHeaders}>((resolve,reject) => {
    const req = httpRequest(url,{method:body === undefined ? 'GET' : 'POST',headers},res => {
      let text = ''; res.setEncoding('utf8'); res.on('data',chunk => { text += chunk; });
      res.on('end',() => resolve({status:res.statusCode!,body:text,headers:res.headers}));
    });
    req.on('error',reject); req.end(body);
  });
}

const root = await mkdtemp(join(tmpdir(), 'pi-kit-boundary-'));
const agentDir = join(root, 'agent');
const projectPath = join(root, 'project');
await mkdir(agentDir); await mkdir(projectPath);
await writeFile(join(agentDir, 'settings.json'), JSON.stringify({ defaultProjectTrust: 'ask' }));
const reports: unknown[] = [];

for (const mode of ['dev', 'built'] as const) {
  const port = mode === 'dev' ? 14342 : 14343;
  const origin = `http://127.0.0.1:${port}`;
  let server: ChildProcess | undefined;
  let output = '';
  async function start() {
    output = '';
    server = spawn(process.execPath, mode === 'dev' ? ['node_modules/vite/bin/vite.js', 'dev'] : ['build'], {
      env: { ...process.env, HOST:'127.0.0.1', PORT:String(port), PI_DASHBOARD_AGENT_DIR:agentDir, PI_DASHBOARD_USE_EXISTING_AUTH:'0' },
      stdio:['ignore','pipe','pipe'],
    });
    server.stdout!.on('data', d => { output += d; });
    server.stderr!.on('data', d => { output += d; });
    for (let i = 0; i < 200; i++) {
      if (server.exitCode !== null || server.signalCode !== null) throw Error(`Server exited: ${output}`);
      try { if ((await fetch(origin)).ok) return; } catch {}
      await delay(100);
    }
    throw Error(`Server startup timed out: ${output}`);
  }
  async function stop(signal: NodeJS.Signals) {
    if (!server || server.exitCode !== null || server.signalCode !== null) return 0;
    const started = Date.now();
    const child = server;
    const exit = new Promise<void>(resolve => child.once('exit', () => resolve()));
    child.kill(signal);
    const timer = setTimeout(() => child.kill('SIGKILL'), 8000);
    try { await exit; assert(Date.now() - started < 8000, `${mode} shutdown timed out`); }
    finally { clearTimeout(timer); }
    return Date.now() - started;
  }
  try {
    await start();
    for (const host of ['localhost', '127.0.0.1']) {
      const response = await fetch(`http://${host}:${port}/`);
      assert.equal(response.status,200);
      const html = await response.text();
      assert(html.includes('Pi workspace') || html.includes('pi workspace'));
      assert(html.includes('<button'), 'Workspace controls must be server rendered');
      const cookie = response.headers.get('set-cookie')!;
      assert(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict') && !cookie.includes('Domain='));
      for (const [name, value] of [['x-content-type-options','nosniff'],['referrer-policy','no-referrer'],['cache-control','no-store']]) assert.equal(response.headers.get(name!),value);
    }
    const boot = await fetch(origin + '/api/bootstrap');
    const cookie = boot.headers.get('set-cookie')!.split(';')[0]!;
    const headers = {cookie};
    assert.equal((await fetch(origin + '/trpc/state')).status,401);
    assert.equal((await fetch(origin + '/trpc/events')).status,401);
    for (const invalid of [{host:`evil.example:${port}`},{host:`localhost:${port}`,origin},{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'}] as Record<string,string>[]) {
      const response = await rawRequest(origin + '/trpc/send', {...headers,...invalid,'content-type':'application/json'},'{}');
      assert.equal(response.status,403,`${mode} ${JSON.stringify(invalid)}: ${response.body}`);
    }
    assert.equal((await fetch(origin + '/trpc/state', {headers:{...headers,'x-forwarded-host':'evil.example'}})).status,200);
    async function rpc(name: string, body: unknown) {
      const response = await fetch(origin + '/trpc/' + name, {method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body)});
      return {response,data:await response.json()};
    }
    const opened = await rpc('open',{projectPath});
    assert.equal(opened.response.status,200, JSON.stringify(opened.data));
    const sessionId = opened.data.result.data.sessionId;
    assert(sessionId);
    const query = await fetch(origin + '/trpc/state',{headers});
    assert.equal((await query.json()).result.data.sessionId,sessionId);
    if (mode === 'dev') {
      // Trigger Vite's actual server-module reload without changing source bytes.
      const now = new Date();
      await utimes(new URL('../src/lib/server/services.ts', import.meta.url), now, now);
      await delay(1000);
      const afterReload = await fetch(origin + '/trpc/state',{headers});
      assert.equal(afterReload.status,200,'HMR must retain the process cookie');
      assert.equal((await afterReload.json()).result.data.sessionId,sessionId,'HMR must retain the active pi session');
    }
    // Large but representative inputs fit the adapter's default 512 KiB limit.
    const prompt = await rpc('send',{sessionId:'intentionally-stale',requestId:'size-check',text:'p'.repeat(128*1024)});
    assert.notEqual(prompt.response.status,413);
    const name = `boundary-check-${mode}`;
    const content = `---\nname: ${name}\ndescription: Temporary size check\n---\n` + 'x'.repeat(256*1024);
    const saved = await rpc('saveSkill',{projectPath,name,scope:'project',expectedRevision:null,content});
    assert.equal(saved.data.result.data.ok,true);
    if (mode === 'built') {
      const tooLarge = await rpc('send',{sessionId:'stale',requestId:'oversize',text:'p'.repeat(513*1024)});
      // tRPC maps adapter-node's body-stream size error to BAD_REQUEST.
      assert.equal(tooLarge.response.status,400,JSON.stringify(tooLarge.data));
      assert.match(tooLarge.data.error.message,/body.*(size|large|limit)|exceed/i);
      const html = await (await fetch(origin)).text();
      const asset = html.match(/(?:\.|)\/_app\/immutable\/entry\/start\.[^"']+\.js/)?.[0];
      assert(asset);
      const response = await rawRequest(new URL(asset, origin).href,{host:`foreign.example:${port}`});
      assert.equal(response.status,200,'Public static assets bypass the Kit hook');
      assert.equal(response.headers['set-cookie'],undefined);
    }
    const abort = new AbortController();
    const events = await fetch(origin + '/trpc/events',{headers,signal:abort.signal});
    assert(events.headers.get('content-type')?.includes('text/event-stream'));
    const reader = events.body!.getReader();
    let wire = '';
    while (!wire.includes(sessionId)) {
      const chunk = await reader.read(); assert(!chunk.done);
      wire += new TextDecoder().decode(chunk.value);
    }
    const termMs = await stop('SIGTERM'); abort.abort();
    await start();
    assert.equal((await fetch(origin + '/trpc/state',{headers})).status,401,'Cookie must rotate');
    const renewed = (await fetch(origin + '/api/bootstrap')).headers.get('set-cookie')!.split(';')[0]!;
    assert.notEqual(renewed,cookie);
    assert.equal((await (await fetch(origin + '/trpc/state',{headers:{cookie:renewed}})).json()).result.data,null,'Restart must not implicitly resume');
    const secondAbort = new AbortController();
    await fetch(origin + '/trpc/events',{headers:{cookie:renewed},signal:secondAbort.signal});
    const intMs = await stop('SIGINT'); secondAbort.abort();
    reports.push({mode,port,ssr:true,access:true,queryMutation:true,promptKiB:128,skillKiB:256,bodyLimit:mode==='built'?'512 KiB enforced':'adapter limit applies to built server',termMs,intMs,restart:true});
  } catch (error) { console.error(`${mode} boundary failed`, error, output); throw error; }
  finally { await stop('SIGTERM'); }
}
console.log(JSON.stringify({root,reports},null,2));
