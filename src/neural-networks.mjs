import {ELEMENTS,mapMusic} from './music.mjs';
export const NETWORK_VERSION='neural-worm-network-v2';
const ranges={melody:[48,72],rhythm:[1,9],harmony:[10,65],dynamics:[32,90],
  tempo:[48,108],mode:[20,80],form:[8,32],texture:[1,6],timbre:[15,85],articulation:[30,90]};
const clamp=v=>Math.max(0,Math.min(1,v));
export const NETWORK_PROFILES={
  melody:{shape:'sequence',low:'級進、簡潔線條',high:'寬音域、較多轉折',description:'音高中心與旋律走向'},
  rhythm:{shape:'pulse',low:'留白、疏落節奏',high:'密集、較多事件',description:'每小節事件密度'},
  harmony:{shape:'chord',low:'穩定、低張力',high:'較高和聲張力',description:'和聲張力控制'},
  dynamics:{shape:'swell',low:'輕柔力度',high:'較強力度',description:'演奏力度控制'},
  tempo:{shape:'orbit',low:'緩慢、從容',high:'較快、推進',description:'每分鐘拍數'},
  mode:{shape:'circle',low:'較暗色彩傾向',high:'較亮色彩傾向',description:'調式色彩控制，非調性辨識'},
  form:{shape:'phrase',low:'較短樂句',high:'較長樂句',description:'樂句組織尺度，非曲式辨識'},
  texture:{shape:'voices',low:'單薄、少聲部',high:'分層、多聲部',description:'聲部數與組織'},
  timbre:{shape:'spectrum',low:'柔和、較暗音色',high:'明亮、較多高頻',description:'音色明亮度控制'},
  articulation:{shape:'legato',low:'短促、分離',high:'連續、延音',description:'延音比例與連接'},
};
const complexityWords={
  melody:['單一動機、較少轉折','多動機、較多轉折'],
  rhythm:['規整、較少事件','較多事件、節奏變化'],
  harmony:['穩定、較少和聲變化','較多和聲變化'],
  dynamics:['平穩、較小對比','層次較多、對比明顯'],
  tempo:['平穩脈動','較多速度變化'],
  mode:['單一調式色彩','較多調式色彩變化'],
  form:['重複、簡潔結構','較多段落與發展'],
  texture:['少聲部、較薄織體','多聲部、分層織體'],
  timbre:['集中、較少音色','多種音色與組合'],
  articulation:['統一演奏法','較多演奏法對比'],
};

/** Visual controls, not physiological estimates. Each network retains its musical value. */
export function networkStates(snapshot){
  const mapping=mapMusic(snapshot);
  if(!mapping)return null;
  return ELEMENTS.map(([key,label,unit],i)=>{
    const [low,high]=ranges[key],value=mapping.parameters[key];
    const level=clamp((value-low)/(high-low));
    // Two explicit interaction axes. A high pitch or fast BPM is not itself
    // musical complexity; organization controls stay separate from those values.
    const complexity=clamp(snapshot.attention/100),spread=clamp(1-snapshot.relaxation/100);
    const densityTarget=.18+.68*complexity;
    const dispersionTarget=.15+.7*spread;
    const profile=NETWORK_PROFILES[key];
    const state={key,label,unit,value,level,densityTarget,dispersionTarget,
      nodeCount:Math.round(28+40*densityTarget),control127:Math.round(level*127),
      coordinates127:{x:Math.round(snapshot.attention/100*127),y:Math.round(snapshot.relaxation/100*127)},
      descriptor:complexity<1/3?complexityWords[key][0]:complexity>2/3?complexityWords[key][1]:'適中組織、保留變化',
      valueDescriptor:level<1/3?profile.low:level>2/3?profile.high:`${profile.low} ↔ ${profile.high}`,
      organizationControls:{complexity127:Math.round(complexity*127),
        dispersion127:Math.round(spread*127),ruleVersion:'organization-xy-v1'},
      shape:profile.shape,description:profile.description,
      timestamp:snapshot.timestamp,sessionId:snapshot.sessionId??null,
      source:snapshot.source,version:NETWORK_VERSION,index:i};
    const geometry=networkGeometry(state);
    state.density=geometry.edges.length/(state.nodeCount*(state.nodeCount-1)/2);
    const meanX=geometry.nodes.reduce((sum,n)=>sum+n.x,0)/state.nodeCount;
    const meanY=geometry.nodes.reduce((sum,n)=>sum+n.y,0)/state.nodeCount;
    state.dispersion=Math.min(1,Math.sqrt(geometry.nodes.reduce((sum,n)=>
      sum+(n.x-meanX)**2+(n.y-meanY)**2,0)/state.nodeCount)/Math.SQRT1_2);
    return state;
  });
}

/** Fixed topology seed + input-driven geometry. No random data or game objects. */
export function networkGeometry(state,_time=0){
  if(!state)return {nodes:[],edges:[]};
  const nodes=[];
  for(let i=0;i<state.nodeCount;i++){
    const u=i/(state.nodeCount-1),spread=.12+.28*state.dispersionTarget,angle=u*Math.PI*2;
    let x=.1+.8*u,y=.5,radius=1.5,spine=true;
    switch(state.shape){
      case 'sequence':y=.5+spread*(Math.sin(u*Math.PI*3)+.4*Math.sin(u*Math.PI*7));break;
      case 'pulse':y=.5+spread*Math.sin(Math.floor(u*(3+6*state.level))*2.4);radius=i%4===0?3:1.2;break;
      case 'chord':x=.5+(.18+.16*(i%3)/2)*Math.cos(angle);y=.5+spread*Math.sin(angle);break;
      case 'swell':y=.5+spread*Math.sin(u*Math.PI*2);radius=1+3*state.level*Math.sin(u*Math.PI);break;
      case 'orbit':x=.5+(.1+.3*u)*Math.cos(angle*1.5);y=.5+spread*u*Math.sin(angle*1.5);break;
      case 'circle':x=.5+.32*Math.cos(angle);y=.5+spread*Math.sin(angle);radius=i%7===0?2.5:1.2;break;
      case 'phrase':y=.5+spread*Math.sin((u*3%1)*Math.PI)*((Math.floor(u*3)%2)*2-1);break;
      case 'voices':x=.1+.8*(i%Math.ceil(state.nodeCount/3))/Math.ceil(state.nodeCount/3);y=.5+spread*((i%3)-1);break;
      case 'spectrum':x=.5+.36*u*Math.cos(angle*7);y=.5+spread*u*Math.sin(angle*7);spine=i%2===0;break;
      case 'legato':y=.5+spread*Math.sin(u*Math.PI*4);radius=1.2+1.8*state.level;break;
    }
    nodes.push({x:clamp(x),y:clamp(y),radius,spine,phase:i*.47});
  }
  const edges=[];
  const threshold=.065+.22*state.densityTarget;
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
    // Highlight a real control node. Time changes light, never its position.
    const head=spine.at(-1),px=x(head),py=y(head);
    ctx.shadowColor='#bcfff3';ctx.shadowBlur=22;ctx.fillStyle='#f2fffb';
    ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;
  canvas.dataset.nodes=String(nodes.length);canvas.dataset.edges=String(edges.length);
}
