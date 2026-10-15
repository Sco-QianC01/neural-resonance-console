/** Written score facts. No audio-to-note inference or unvalidated construct score. */
const steps='CDEFGAB',chromatic=[0,2,4,5,7,9,11];
const finite=Number.isFinite;
const sourceHash='a3df083ed687d752b411df97ee2448b9f261d537c101c574ed6e18cf62eec60a';
const fail=()=>{throw new Error('譜面證據格式無效，未顯示推算資料');};
function fraction(pair,positive=false){
  if(!Array.isArray(pair)||pair.length!==2||!pair.every(Number.isSafeInteger)||pair[1]<=0||pair[0]<0||positive&&pair[0]===0)fail();
  return pair[0]/pair[1];
}
function midi(p){
  if(!p||!steps.includes(p.step)||p.step.length!==1||!Number.isInteger(p.alter)||Math.abs(p.alter)>2||
    !Number.isInteger(p.octave)||p.octave<0||p.octave>9)fail();
  return (p.octave+1)*12+chromatic[steps.indexOf(p.step)]+p.alter;
}
export function melodicInterval(a,b){
  const semitones=midi(b)-midi(a),distance=7*(b.octave-a.octave)+steps.indexOf(b.step)-steps.indexOf(a.step);
  const diatonic=Math.abs(distance)+1;
  return {semitones,diatonic,direction:Math.sign(semitones),
    kind:diatonic===1?(semitones===0?'repeat':'chromatic'):diatonic===2?'step':'leap'};
}
const pitchName=p=>`${p.step}${p.alter<0?'♭'.repeat(-p.alter):'♯'.repeat(p.alter)}${p.octave}`;
export function scoreEvidence(data){
  if(data?.schema!=='chopin-score-evidence-v1'||data.workId!==6||data.unit!=='quarter-note'||
    data.staff!==1||data.voice!=='upper-monophonic'||data.range?.join(',')!=='1,8'||
    data.source?.sha256!==sourceHash||!data.source?.url?.startsWith('https://')||
    data.context?.meter!=='6/8'||data.context.quartersPerBar!==3||
    data.context?.basis!=='explicit-source-key'||!Array.isArray(data.context.scale)||data.context.scale.length!==7||
    !Array.isArray(data.events)||data.events.length>256||!Array.isArray(data.ornaments)||!Array.isArray(data.dynamics))fail();
  const scale=new Map(data.context.scale.map(p=>{midi({...p,octave:4});return [p.step,p.alter];}));
  if(scale.size!==7||[...steps].map(s=>`${s}${scale.get(s)}`).join(',')!=='C0,D-1,E-1,F0,G-1,A-1,B-1')fail();
  const ids=new Set();
  function expand(e,ornament=false){
    if(!Number.isInteger(e.bar)||e.bar<1||e.bar>8||typeof e.id!=='string'||ids.has(e.id)||
      !Array.isArray(e.sourceRows)||!e.sourceRows.length||!e.sourceRows.every(n=>Number.isInteger(n)&&n>0)||
      !Array.isArray(e.tokens)||e.tokens.length!==e.sourceRows.length||!e.tokens.every(t=>typeof t==='string'&&t.length<160))fail();
    ids.add(e.id);
    const onsetQ=fraction(e.onset),durationQ=ornament?null:fraction(e.duration,true);
    if(onsetQ>=3||!ornament&&onsetQ+durationQ>3+1e-9||
      !['note','rest','ornament'].includes(e.kind)||ornament!==(e.kind==='ornament')||
      e.kind!=='rest'&&!e.pitch||e.kind==='rest'&&e.pitch!==null||ornament&&e.duration!==null)fail();
    const pitched=e.kind!=='rest';
    return {...e,onsetQ,durationQ,absoluteQ:(e.bar-1)*3+onsetQ,
      midi:pitched?midi(e.pitch):null,pitchName:pitched?pitchName(e.pitch):null,
      inScale:pitched?scale.get(e.pitch.step)===e.pitch.alter:null,interval:null,durationChangeLog2:null};
  }
  const events=data.events.map(e=>expand(e)),ornaments=data.ornaments.map(e=>expand(e,true));
  let end=0,previous=null,segment=0;
  for(const e of events){
    if(Math.abs(e.absoluteQ-end)>1e-9)fail();
    end=e.absoluteQ+e.durationQ;
    if(e.kind==='rest'){previous=null;segment++;continue;}
    if(previous){e.previousId=previous.id;e.interval=melodicInterval(previous.pitch,e.pitch);
      e.durationChangeLog2=Math.log2(e.durationQ/previous.durationQ);}
    e.segment=segment;previous=e;
  }
  if(Math.abs(end-24)>1e-9)fail();
  for(const d of data.dynamics){
    if(!Number.isInteger(d.bar)||d.bar<1||d.bar>8||fraction(d.onset)>=3||
      !/^(p{1,3}|f{1,3}|mp|mf|fp|fz|sfz)$/.test(d.mark)||!Number.isInteger(d.sourceRow))fail();
  }
  const measures=Array.from({length:8},(_,i)=>{
    const bar=i+1,rows=events.filter(e=>e.bar===bar),notes=rows.filter(e=>e.kind==='note'),intervals=notes.filter(e=>e.interval);
    const count=kind=>intervals.filter(e=>e.interval.kind===kind).length,durationHistogram={};
    for(const e of notes){const key=e.duration.join('/');durationHistogram[key]=(durationHistogram[key]??0)+1;}
    return {bar,onsets:notes.length,densityPerQuarter:notes.length/3,
      outOfScaleCount:notes.filter(e=>!e.inScale).length,noteCount:notes.length,
      intervalCount:intervals.length,repeatCount:count('repeat'),chromaticCount:count('chromatic'),
      stepCount:count('step'),leapCount:count('leap'),durationHistogram,
      restFraction:rows.filter(e=>e.kind==='rest').reduce((s,e)=>s+e.durationQ,0)/3,
      durationChanges:notes.filter(e=>finite(e.durationChangeLog2)).map(e=>({eventId:e.id,log2Ratio:e.durationChangeLog2})),
      focus:null,dispersal:null};
  });
  return {...data,events,ornaments,measures};
}
export function alignScore(score,recording){
  const a=recording?.annotation,t=a?.t;
  if(recording?.workId!==score?.workId||recording.completeStudy!==true||a?.kind!=='beats'||
    a.bpb!==6||a.bar0!==1||a.meter!=='6/8'||!Array.isArray(t)||t.length<49||
    t.some((v,i)=>!finite(v)||v<0||i>0&&v<=t[i-1]))return null;
  const stamp=q=>{
    const position=q*2,index=Math.floor(position),f=position-index;
    return f===0?t[index]:t[index]+f*(t[index+1]-t[index]);
  };
  return {events:score.events.map(e=>({...e,t:stamp(e.absoluteQ),end:stamp(e.absoluteQ+e.durationQ)})),
    start:t[0],end:t[48],anchors:[...t],annotationId:a.annotation_id??null,
    method:'piecewise-linear-source-beat-anchors',noteOnsetsMeasured:false,editionMatchVerified:false};
}
export function scoreAt(aligned,time){
  if(!aligned||!finite(time)||time<aligned.start||time>=aligned.end)return {bar:null,event:null,rest:false};
  const event=aligned.events.find(e=>time>=e.t&&time<e.end);
  return {bar:event?.bar??null,event:event?.kind==='note'?event:null,rest:event?.kind==='rest'};
}
export function scoreExport(score,aligned,recording){
  return {schema:'score-evidence-export-v1',source:score.source,context:score.context,
    workId:score.workId,range:score.range,voice:score.voice,staff:score.staff,unit:score.unit,
    events:aligned?.events??score.events,ornaments:score.ornaments,dynamics:score.dynamics,measures:score.measures,
    recording:recording?{id:recording.id,workId:recording.workId,performer:recording.performer,
      reference:recording.reference,annotationCsvSha256:recording.annotationCsvSha256}:null,
    alignment:aligned?{method:aligned.method,anchors:aligned.anchors,annotationId:aligned.annotationId,
      noteOnsetsMeasured:false,editionMatchVerified:false}:null,
    constructs:{focus:null,dispersal:null,reason:'No agreed operational definition, window, weights or validation'}};
}
