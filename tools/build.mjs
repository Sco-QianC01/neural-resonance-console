import { mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
await mkdir(out,{recursive:true});
// Only copy deployable public source; no recordings, credentials or work logs.
for(const name of ['index.html','src','public','docs']) {
  await rm(path.join(out,name),{recursive:true,force:true});
  await cp(path.join(root,name),path.join(out,name),{recursive:true});
}
console.log('Static site built in dist/');
