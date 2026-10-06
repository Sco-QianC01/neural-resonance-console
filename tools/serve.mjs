import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuntimeMonitor } from './runtime.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||8767);
const corePort=Number(process.env.MUSIC_THERAPY_API_PORT||8002);
if (![port,corePort].every(n=>Number.isInteger(n)&&n>=1024&&n<=65535)) throw new Error('Invalid local port');
const coreOrigin=`http://127.0.0.1:${corePort}`;
const runtime=new RuntimeMonitor({ root, coreOrigin, manifest:process.env.MUSIC_THERAPY_MANIFEST_PATH,
  pwsh:process.env.MUSIC_THERAPY_PWSH||'Q:\\人工智能\\Runtime\\PowerShell\\7.6.6\\pwsh.exe' });
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'};
const allowed=['/index.html','/src/','/public/','/docs/'];
export const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const target=path.resolve(root,`.${name}`);
    if(!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
    if (name==='/api/health'||name==='/api/runtime') {
      const value=name==='/api/health'
        ? { app:'neural-resonance-console',schemaVersion:'console-health-v1',websocketPath:'/ws/live' }
        : await runtime.snapshot();
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:JSON.stringify(value)); return;
    }
    if(!(target.startsWith(root+path.sep))||!allowed.some(p=>p.endsWith('/')?name.startsWith(p):name===p)
      ||(await stat(target)).isDirectory()) {res.writeHead(404);res.end('Not found');return;}
    const bytes=await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream',
      'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    res.end(req.method==='HEAD'?undefined:bytes);
  } catch {res.writeHead(404);res.end('Not found');}
});
// Transparent, fixed-destination bridge. No device claim, session mutation or
// network discovery occurs here; the existing core remains the sole producer.
server.on('upgrade',(req,socket,head)=>{
  const host=req.headers.host;
  if (req.url!=='/ws/live'||req.headers.upgrade?.toLowerCase()!=='websocket') {socket.destroy();return;}
  if (req.headers.origin) {
    try {
      const origin=new URL(req.headers.origin);
      if (origin.host!==host||origin.protocol!=='http:') {socket.destroy();return;}
    } catch {socket.destroy();return;}
  }
  const upstream=http.request(`${coreOrigin}/ws/live`,{headers:{...req.headers,host:`127.0.0.1:${corePort}`}});
  let peer;
  const fail=()=>{socket.destroy();peer?.destroy();upstream.destroy();};
  upstream.setTimeout(2500,fail);
  upstream.on('error',fail);
  socket.on('error',fail);
  socket.on('close',()=>{peer?.destroy();upstream.destroy();});
  upstream.on('response',response=>{response.resume();fail();});
  upstream.on('upgrade',(response,remote,remoteHead)=>{
    peer=remote;upstream.setTimeout(0);
    socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`
      +response.rawHeaders.reduce((lines,value,i)=>lines+(i%2?`${value}\r\n`:`${value}: `),'')+'\r\n');
    if(remoteHead.length)socket.write(remoteHead);
    if(head.length)remote.write(head);
    remote.on('error',fail);remote.on('close',()=>socket.destroy());
    socket.pipe(remote);remote.pipe(socket);
  });
  upstream.end();
});
server.listen(port,'127.0.0.1',()=>console.log(`Neural resonance console: http://127.0.0.1:${port}/`));
