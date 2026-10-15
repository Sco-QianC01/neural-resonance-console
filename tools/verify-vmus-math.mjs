import fs from 'node:fs';
import assert from 'node:assert/strict';
import {beatIntervals,gaussianTempo} from '../src/fusion-model.mjs';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const source=read('artifacts/chopin-catalog-20261012/study.js');
const step=Number(source.match(/var F_STEP = ([\d.]+)/)[1]);
// Only the reviewed pure arithmetic function is used as a comparison oracle.
const code=source.slice(source.indexOf('function smoothTempo('),source.indexOf('function smAt('));
assert(code.length>1000&&code.length<6000&&!/\b(fetch|window|document|eval|require|import)\b/.test(code));
const sourceSmooth=Function('F_STEP','timeToX',`${code};return smoothTempo;`)(step,()=>0);
const cases=JSON.parse(read('public/research/vmus-reference-cases.json'));
const evidence=[];
for(const rec of cases.recordings.filter(r=>r.completeStudy)){
  const rows=beatIntervals(rec.annotation),ours=gaussianTempo(rows,rec.annotation.window);
  const bm={t:rec.annotation.t,n:rec.annotation.t.length,gaps:false,
    raw:rows.map(r=>({t:r.t,bpm:r.tempo}))};
  const original=sourceSmooth(bm,rec.annotation.window);
  assert.equal(ours.length,original.y.length);
  const maxError=Math.max(...ours.map((p,i)=>Math.abs(p.tempo-original.y[i])));
  assert.ok(maxError<1e-8,`${rec.id}: ${maxError}`);
  evidence.push({recording:rec.id,samples:ours.length,gridStepSeconds:step,maxAbsoluteTempoError:maxError,
    originalBeatMarks:rec.annotation.t.length,sourceDataSha256:rec.sourceDataSha256});
}
fs.writeFileSync(new URL('artifacts/chopin-catalog-20261012/math-validation.json',root),
  JSON.stringify({reference:'Current Vmus Yang 2007 shared study.js',cases:evidence},null,2)+'\n');
console.log(JSON.stringify(evidence));
