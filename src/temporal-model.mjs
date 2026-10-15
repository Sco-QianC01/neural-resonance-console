/** Time is a displayed coordinate, not a new physiological measurement. */
export function timeBounds(points,seconds=60){
 const end=points.at(-1)?.timestamp,start=points[0]?.timestamp;
 if(!Number.isFinite(end)||!Number.isFinite(start))return [0,seconds*1000];
 return [start,Math.max(start+seconds*1000,end)];
}
export function temporalProjection(width,height,ranges,time,{yaw=.58,pitch=.38}={}){
 const rotate=(x,y,z)=>{
  const a=Math.cos(yaw)*x+Math.sin(yaw)*z,b=-Math.sin(yaw)*x+Math.cos(yaw)*z;
  return {x:a,y:-Math.cos(pitch)*y+Math.sin(pitch)*b,depth:Math.sin(pitch)*y+Math.cos(pitch)*b};
 };
 const raw=[];for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])raw.push(rotate(x,y,z));
 const extent=key=>[Math.min(...raw.map(p=>p[key])),Math.max(...raw.map(p=>p[key]))];
 const [x0,x1]=extent('x'),[y0,y1]=extent('y');
 const scale=Math.max(1,Math.min((width-110)/(x1-x0),(height-105)/(y1-y0)));
 const origin={x:width/2-scale*(x0+x1)/2,y:height/2-scale*(y0+y1)/2};
 const vertex=(x,y,z)=>{const p=rotate(x-.5,y-.5,z-.5);return {...p,x:origin.x+p.x*scale,y:origin.y+p.y*scale};};
 const point=p=>{
  if(![p?.attention,p?.relaxation,p?.timestamp].every(Number.isFinite)||p.attention<ranges.x[0]||p.attention>ranges.x[1]||p.relaxation<ranges.y[0]||p.relaxation>ranges.y[1])return null;
  return vertex((p.attention-ranges.x[0])/(ranges.x[1]-ranges.x[0]),(p.relaxation-ranges.y[0])/(ranges.y[1]-ranges.y[0]),(p.timestamp-time[0])/(time[1]-time[0]));
 };
 return {point,vertex,corners:raw.map(p=>({...p,x:origin.x+p.x*scale,y:origin.y+p.y*scale})),depth:p=>(p.timestamp-time[0])/1000};
}
