import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.md':'text/plain; charset=utf-8',
  '.json':'application/json; charset=utf-8'};
const allowed=['/index.html','/src/','/public/','/docs/'];

/** Serve this project only. No device service, OS process scan or upstream proxy. */
export function createConsoleServer(root=projectRoot) {
  return http.createServer(async(req,res)=>{
    try {
      if(!['GET','HEAD'].includes(req.method)){
        res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;
      }
      const url=new URL(req.url,'http://localhost');
      const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
      if(name==='/api/health'){
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(req.method==='HEAD'?undefined:JSON.stringify({
          app:'neural-resonance-console',standalone:true,version:'0.3.0'
        }));return;
      }
      const target=path.resolve(root,`.${name}`);
      if(!target.startsWith(root+path.sep)||!allowed.some(p=>p.endsWith('/')?name.startsWith(p):name===p)
        ||(await stat(target)).isDirectory()){res.writeHead(404);res.end('Not found');return;}
      const bytes=await readFile(target);
      res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream',
        'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  });
}

export function serverOptions(args=[],env=process.env) {
  const options={port:Number(env.PORT||5173),host:env.HOST||'127.0.0.1'};
  for(let i=0;i<args.length;i++){
    if(args[i]==='--port')options.port=Number(args[++i]);
    else if(args[i]==='--host')options.host=args[++i];
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  if(!Number.isInteger(options.port)||options.port<1024||options.port>65535||!options.host)
    throw new Error('Provide --port 1024–65535 and a valid --host');
  return options;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {port,host}=serverOptions(process.argv.slice(2));
  const server=createConsoleServer();
  server.on('error',error=>{
    console.error(error.code==='EADDRINUSE'
      ? `Port ${port} is occupied. Run npm start -- --port <another-port>.` : error.message);
    process.exitCode=1;
  });
  server.listen(port,host,()=>console.log(`Neural Resonance: http://${host}:${port}/`));
}
