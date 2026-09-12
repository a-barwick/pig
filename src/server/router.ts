import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { RuntimeService, ConfigService } from '../shared/contracts';
const t = initTRPC.context<{ runtime: RuntimeService; config: ConfigService }>().create();
const p = t.procedure;
const projectPath = z.string().min(1);
const scope = z.enum(['project','global']);
const thinking = z.enum(['off','minimal','low','medium','high','xhigh','max']);
const model = z.object({provider:z.string().min(1),id:z.string().min(1)});
const command = z.object({sessionId:z.string(),requestId:z.string().min(1),text:z.string().min(1)});
export const appRouter = t.router({
 state:p.query(({ctx})=>ctx.runtime.snapshot()),
 open:p.input(z.object({projectPath,sessionPath:z.string().optional()})).mutation(({ctx,input})=>ctx.runtime.open(input)),
 sessions:p.input(z.object({projectPath})).query(({ctx,input})=>ctx.runtime.sessions(input.projectPath)),
 send:p.input(command).mutation(({ctx,input})=>ctx.runtime.send(input)),
 steer:p.input(command).mutation(({ctx,input})=>ctx.runtime.steer(input)),
 stop:p.input(z.object({sessionId:z.string()})).mutation(({ctx,input})=>ctx.runtime.stop(input.sessionId)),
 select:p.input(z.object({sessionId:z.string(),model:model.optional(),thinking:thinking.optional()})).mutation(({ctx,input})=>ctx.runtime.select(input)),
 trust:p.input(z.object({projectPath})).mutation(({ctx,input})=>ctx.runtime.trust(input.projectPath)),
 answer:p.input(z.object({dialogId:z.string(),value:z.union([z.string(),z.boolean()]).optional(),cancelled:z.boolean().optional()})).mutation(({ctx,input})=>ctx.runtime.answer(input)),
 trial:p.input(z.object({projectPath,resourceId:z.string(),revision:z.string(),prompt:z.string()})).mutation(({ctx,input})=>ctx.runtime.trial(input)),
 events:p.subscription(async function*({ctx,signal}){for await(const event of ctx.runtime.events(signal)) yield event;}),
 skills:p.input(z.object({projectPath})).query(({ctx,input})=>ctx.config.skills(input.projectPath)),
 readSkill:p.input(z.object({projectPath,resourceId:z.string()})).query(({ctx,input})=>ctx.config.readSkill(input)),
 saveSkill:p.input(z.object({projectPath,resourceId:z.string().optional(),name:z.string().min(1),scope,expectedRevision:z.string().nullable(),content:z.string()})).mutation(({ctx,input})=>ctx.config.saveSkill(input)),
 undo:p.input(z.object({projectPath,path:z.string(),expectedRevision:z.string()})).mutation(({ctx,input})=>ctx.config.undo(input)),
 settings:p.input(z.object({projectPath,scope})).query(({ctx,input})=>ctx.config.settings(input)),
 saveSettings:p.input(z.object({projectPath,scope,expectedRevision:z.string(),model:model.nullable().optional(),thinking:thinking.nullable().optional(),modelThinking:z.object({provider:z.string().min(1),id:z.string().min(1),level:thinking.nullable()}).optional()})).mutation(({ctx,input})=>ctx.config.saveSettings(input)),
});
export type AppRouter = typeof appRouter;
