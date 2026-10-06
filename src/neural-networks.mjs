import {ELEMENTS,mapMusic} from './music.mjs';
export const NETWORK_VERSION='neural-worm-network-v1';
const ranges={melody:[48,72],rhythm:[1,9],harmony:[10,65],dynamics:[32,90],
  tempo:[48,108],mode:[20,80],form:[8,32],texture:[1,6],timbre:[15,85],articulation:[30,90]};
const clamp=v=>Math.max(0,Math.min(1,v));

/** Visual controls, not physiological estimates. Each network retains its musical value. */
export function networkStates(snapshot){
  const mapping=mapMusic(snapshot);
  if(!mapping)return null;
  return ELEMENTS.map(([key,label,unit],i)=>{
    const [low,high]=ranges[key],value=mapping.parameters[key];
    const level=clamp((value-low)/(high-low));
    const density=.18+.68*level;
    const dispersion=clamp(.75-.48*snapshot.relaxation/100+.12*(1-level));
    return {key,label,unit,value,level,density,dispersion,nodeCount:Math.round(28+40*density),
      source:snapshot.source,version:NETWORK_VERSION,index:i};
  });
}

/** Fixed topology seed + input-driven geometry. No random data or game objects. */
export function networkGeometry(state,time=0){
  if(!state)return {nodes:[],edges:[]};
  const nodes=[];
  for(let i=0;i<state.nodeCount;i++){
    const u=i/(state.nodeCount-1),phase=u*Math.PI*2.3+state.index*.61;
    const spine=i%3!==0,spread=spine?.18:.42;
    nodes.push({x:.10+.80*u,
      y:.05+.90*clamp(.50+Math.sin(phase+time*.18)*(.10+state.dispersion*spread)
        +Math.cos(i*2.399+time*.11)*state.dispersion*(spine?.035:.12)),
      radius:spine?1.3+(i%5)*.32:1.1,spine,phase:i*.47});
  }
  const edges=[];
  const threshold=.08+.19*state.density;
  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      const distance=Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y);
      if(distance<threshold)edges.push({from:i,to:j,weight:1-distance/threshold});
    }
  }
  return {nodes,edges};
}

export function drawNetwork(canvas,state,time,{hero=false,active=true}={}){
  const ratio=Math.min(2,globalThis.devicePixelRatio||1);
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height)return;
  const pw=Math.round(width*ratio),ph=Math.round(height*ratio);
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
  const ctx=canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
  if(!state)return;
  const {nodes,edges}=networkGeometry(state,time);
  const x=p=>p.x*width,y=p=>p.y*height;
  ctx.globalAlpha=active?1:.22;
  for(const edge of edges){
    const a=nodes[edge.from],b=nodes[edge.to];
    ctx.strokeStyle=`rgba(136,214,230,${(hero?.24:.30)*edge.weight})`;
    ctx.lineWidth=hero?.7:.5;ctx.beginPath();ctx.moveTo(x(a),y(a));ctx.lineTo(x(b),y(b));ctx.stroke();
  }
  const spine=nodes.filter(p=>p.spine);
  ctx.beginPath();spine.forEach((p,i)=>i?ctx.lineTo(x(p),y(p)):ctx.moveTo(x(p),y(p)));
  ctx.strokeStyle='rgba(160,238,233,.46)';ctx.lineWidth=hero?1.4:1;ctx.stroke();
  for(let i=0;i<nodes.length;i++){
    const p=nodes[i],pulse=.55+.45*Math.sin(time*.65-p.phase);
    const radius=p.radius*(hero?1.7:.8);
    const glow=ctx.createRadialGradient(x(p),y(p),0,x(p),y(p),radius*(hero?8:5));
    glow.addColorStop(0,`rgba(192,246,245,${.22+pulse*.17})`);glow.addColorStop(1,'rgba(120,215,233,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x(p),y(p),radius*(hero?8:5),0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.spine?`rgba(210,255,250,${.58+pulse*.42})`:'rgba(139,197,226,.75)';
    ctx.beginPath();ctx.arc(x(p),y(p),radius,0,Math.PI*2);ctx.fill();
  }
  if(hero){
    const position=(time*.035)%1,offset=Math.floor(position*(spine.length-1)),fraction=position*(spine.length-1)-offset;
    const a=spine[offset],b=spine[Math.min(offset+1,spine.length-1)];
    const px=x(a)+(x(b)-x(a))*fraction,py=y(a)+(y(b)-y(a))*fraction;
    ctx.shadowColor='#bcfff3';ctx.shadowBlur=22;ctx.fillStyle='#f2fffb';
    ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;
  canvas.dataset.nodes=String(nodes.length);canvas.dataset.edges=String(edges.length);
}
