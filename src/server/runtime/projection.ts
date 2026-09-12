import { redact } from './redaction';
import type { Message, ToolCall } from '../../shared/contracts';

// SDK content is heterogeneous (including extension-defined messages). Only copy
// display fields; never serialize SDK sessions, provider config or auth objects.
export function projectMessages(messages: readonly any[], calls: Map<string, ToolCall>): Message[] {
  const results = new Map(messages.filter(m => m.role === 'toolResult').map(m => [m.toolCallId, m]));
  return redact(messages.map((m, i) => {
    const content = typeof m.content === 'string' ? [{type:'text',text:m.content}] : m.content ?? [];
    const toolCalls = content.filter((c: any) => c.type === 'toolCall').map((c: any) => {
      const result = results.get(c.id);
      return calls.get(c.id) ?? {id:c.id,name:c.name,args:c.arguments,startedAt:m.timestamp ?? 0,
        status:result ? (result.isError ? 'failed' : 'completed') : 'unknown',
        ...(result ? {result:{content:result.content,details:result.details},endedAt:result.timestamp} : {outputNote:'Execution outcome unavailable; no final result recorded.'})};
    });
    return { id:`message-${i}`, role:['user','assistant','toolResult'].includes(m.role) ? m.role : 'system',
      text:content.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join(''),
      thinking:content.filter((c:any)=>c.type==='thinking').map((c:any)=>c.thinking).join('') || undefined,
      ...(toolCalls.length ? {toolCalls} : {}), ...(m.errorMessage ? {error:m.errorMessage} : {}) };
  }));
}

export function copy<T>(value:T):T { return redact(JSON.parse(JSON.stringify(value))); }
