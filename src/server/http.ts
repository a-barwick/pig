import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { nodeHTTPRequestHandler } from '@trpc/server/adapters/node-http';
import { appRouter } from './router';
import type { ConfigService, RuntimeService } from '../shared/contracts';
export function authorized(req: IncomingMessage, origin: string, token: string) {
 if(req.headers.host !== new URL(origin).host) return false;
 if(req.headers.origin && req.headers.origin !== origin) return false;
 if(req.headers['sec-fetch-site'] === 'cross-site') return false;
 const value=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('pi_local='))?.slice(9) ?? '';
 return value.length===token.length && timingSafeEqual(Buffer.from(value),Buffer.from(token));
}
export async function serve(runtime: RuntimeService, config: ConfigService, port = 4317, production = false) {
 const origin=`http://127.0.0.1:${port}`;
 const token=randomBytes(32).toString('hex');
 const vite=production?null:await (await import('vite')).createServer({server:{middlewareMode:true},appType:'spa'});
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url??'/',origin).pathname;
  if(req.headers.host!==new URL(origin).host || (req.headers.origin && req.headers.origin!==origin) || req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end('Local access only');return;}
  if(path.startsWith('/trpc/')){
   if(!authorized(req,origin,token)){res.writeHead(401);res.end('Open the workspace page first.');return;}
   await nodeHTTPRequestHandler({req,res,path:path.slice(6),router:appRouter,createContext:()=>({runtime,config})});return;
  }
  if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  res.setHeader('Set-Cookie',`pi_local=${token}; HttpOnly; SameSite=Strict; Path=/`);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"frame-ancestors 'none'");
  if(vite){vite.middlewares(req,res);return;}
  const root=resolve('dist/client');
  let file=resolve(root,`.${path}`);
  if(!file.startsWith(root+'/')) file=resolve(root,'index.html');
  try {if(!(await stat(file)).isFile()) file=resolve(root,'index.html');} catch {file=resolve(root,'index.html');}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'} as Record<string,string>)[extname(file)]??'application/octet-stream');
  createReadStream(file).on('error',()=>{res.statusCode=404;res.end();}).pipe(res);
 });
 await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));
 return {server,origin,close:async()=>{await runtime.dispose();await vite?.close();await new Promise<void>((r,e)=>server.close(err=>err?e(err):r()));}};
}
