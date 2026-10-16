/** Equal physical axis scales; layout never changes the source coordinates. */
export function plotBox(width,height){
  const leftMargin=width<420?43:58,rightMargin=22,topMargin=28,bottomMargin=48;
  const size=Math.max(1,Math.min(width-leftMargin-rightMargin,height-topMargin-bottomMargin));
  return {left:leftMargin+(width-leftMargin-rightMargin-size)/2,
    top:topMargin+(height-topMargin-bottomMargin-size)/2,size};
}
export function plotPosition(point,box,ranges={x:[0,100],y:[0,100]}){
  if(![point?.attention,point?.relaxation].every(n=>Number.isFinite(n)&&n>=0&&n<=100))return null;
  const x=(point.attention-ranges.x[0])/(ranges.x[1]-ranges.x[0]);
  const y=(point.relaxation-ranges.y[0])/(ranges.y[1]-ranges.y[0]);
  return {x:box.left+x*box.size,y:box.top+(1-y)*box.size};
}
export function neuralTraceStyle(age){
  const t=Number.isFinite(age)?Math.max(0,Math.min(1,age)):0;
  return {lineAlpha:.2+.72*t,lineWidth:1.8+1.6*t,
    pointAlpha:.24+.66*t,pointRadius:1.7+1.5*t};
}
export function neuralExportName(space,timestamp=Date.now()){
  return `neural-worm-${space==='time'?'3d':'2d'}-${timestamp}.png`;
}
export function viewSpace(preferences,view,next){
  const key=view==='music'?'music':'neural';
  if(next!==undefined)preferences[key]=next==='time'?'time':'plane';
  return preferences[key]==='time'?'time':'plane';
}
export function viewLabels(musical,layer){
  return {
    time:musical?(layer==='worm'?'三維時間蠕蟲':layer==='structure'?'三維小節結構':'三維音樂空間'):'三維時間方盒',
    plane:musical?'二維蠕蟲':'二維投影',
  };
}
/** Wrap by measured output width, preserving every Unicode code point. */
export function wrapText(text,width,measure){
  if(!Number.isFinite(width)||width<=0||typeof measure!=='function')throw new TypeError('無效的文字寬度');
  const lines=[];
  for(const paragraph of String(text).split(/\r?\n/)){
    let line='';
    for(const char of Array.from(paragraph)){
      if(line&&measure(line+char)>width){lines.push(line);line=char;}
      else line+=char;
    }
    lines.push(line);
  }
  return lines;
}
