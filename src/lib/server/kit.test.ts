import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent, Cookies } from '@sveltejs/kit';
import type { RuntimeEvent, Snapshot } from '../shared/contracts';
import { copy } from './runtime/projection';

const mocks = vi.hoisted(() => ({ getServices:vi.fn(), open:vi.fn(), listeners:0 }));
vi.mock('$lib/server/services', () => ({localToken:'test-process-token',getServices:mocks.getServices}));
import { load } from '../../routes/+page.server';
import { GET as bootstrap } from '../../routes/api/bootstrap/+server';
import { GET, POST } from '../../routes/trpc/[...trpc]/+server';
import { handle, handleError } from '../../hooks.server';

function snapshot(): Snapshot {
  return copy({sessionId:'test-session',projectPath:'/temporary/project',status:'idle',messages:[{id:'m',role:'assistant',text:'Bearer example-secret',toolCalls:[{id:'call',name:'bash',status:'completed',startedAt:1,args:{apiKey:'private-value'}}]}],tools:[],resources:[],thinking:'medium',models:[],dialogs:[],cursor:1,trust:{trusted:true,reason:'test'}});
}
function event(path = '/', init: RequestInit = {}) {
  const set = vi.fn();
  return {request:new Request(`http://127.0.0.1:4317${path}`,{...init,headers:{host:'127.0.0.1:4317',...init.headers}}), cookies:{set} as unknown as Cookies} as RequestEvent;
}
beforeEach(() => {
  mocks.open.mockReset();
  mocks.open.mockResolvedValue(snapshot());
  mocks.getServices.mockResolvedValue({runtime:{snapshot,open:mocks.open,async *events(signal: AbortSignal) {
    mocks.listeners++;
    try {
      yield {cursor:1,sessionId:'test-session',kind:'snapshot',snapshot:snapshot()} satisfies RuntimeEvent;
      yield {cursor:2,sessionId:'test-session',kind:'accepted',requestId:'prompt-1'} satisfies RuntimeEvent;
      if (!signal.aborted) await new Promise<void>(resolve => signal.addEventListener('abort',()=>resolve(),{once:true}));
    } finally { mocks.listeners--; }
  }},config:{}});
});

describe('Kit page, hooks and Fetch routes', () => {
  it('returns only the redacted snapshot and issues the cookie without opening pi', async () => {
    for (const host of ['localhost','127.0.0.1']) {
      const request = event('/',{headers:{host:`${host}:4317`}});
      const result = await load(request as Parameters<typeof load>[0]);
      expect(result).toEqual({snapshot:snapshot()});
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('example-secret');
      expect(serialized).not.toContain('private-value');
      expect(serialized).toContain('[REDACTED]');
      expect(request.cookies.set).toHaveBeenCalledWith('pi_local','test-process-token',expect.objectContaining({httpOnly:true,sameSite:'strict',path:'/'}));
    }
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it('renews the cookie without initializing a runtime or reading a snapshot', async () => {
    mocks.getServices.mockClear();
    expect((await bootstrap(event() as Parameters<typeof bootstrap>[0])).status).toBe(204);
    expect(mocks.getServices).not.toHaveBeenCalled();
  });
  it('applies the gate before resolving JSON requests and hides framework errors', async () => {
    const resolve = vi.fn(async () => new Response('private'));
    const response = await handle({event:event('/trpc/send',{method:'POST',headers:{origin:'http://evil.example','content-type':'application/json'}}),resolve});
    expect(response.status).toBe(403); expect(resolve).not.toHaveBeenCalled();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await handleError({error:Error('private SDK config')} as Parameters<typeof handleError>[0])).toEqual({message:expect.not.stringContaining('private SDK config')});
  });
  it('runs validated query and mutation through the actual Fetch route', async () => {
    const queried = await GET(event('/trpc/state') as Parameters<typeof GET>[0]);
    expect((await queried.json()).result.data).toEqual(snapshot());
    const opened = await POST(event('/trpc/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectPath:'/temporary/project'})}) as Parameters<typeof POST>[0]);
    expect(opened.status).toBe(200); expect(mocks.open).toHaveBeenCalledWith({projectPath:'/temporary/project'});
    const bad = await POST(event('/trpc/open',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}) as Parameters<typeof POST>[0]);
    expect(bad.status).toBe(400);
  });
  it('streams authoritative ordered events, releases the generator on abort, and resubscribes', async () => {
    for (let i = 0; i < 2; i++) {
      const controller = new AbortController();
      const response = await GET(event('/trpc/events',{signal:controller.signal}) as Parameters<typeof GET>[0]);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const reader = response.body!.getReader();
      let text = '';
      while (!text.includes('prompt-1')) {
        const chunk = await reader.read();
        text += new TextDecoder().decode(chunk.value);
      }
      expect(text.indexOf('snapshot')).toBeLessThan(text.indexOf('prompt-1'));
      expect(mocks.listeners).toBe(1);
      controller.abort(); await reader.cancel();
      await vi.waitFor(() => expect(mocks.listeners).toBe(0));
    }
  });
});
