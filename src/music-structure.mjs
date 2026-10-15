import {musicPoint,timeToBar,timeToScorePosition} from './fusion-model.mjs';
/** OLS against score position over up to eight original beat observations. */
export function linearFit(rows,key='tempo'){
 const data=rows.filter(p=>Number.isFinite(p.barPosition??p.bar)&&Number.isFinite(p[key]));
 if(data.length<3)return null;
 const mx=data.reduce((s,p)=>s+(p.barPosition??p.bar),0)/data.length,my=data.reduce((s,p)=>s+p[key],0)/data.length;
 let xx=0,xy=0,yy=0;
 for(const p of data){const x=p.barPosition??p.bar;xx+=(x-mx)**2;xy+=(x-mx)*(p[key]-my);yy+=(p[key]-my)**2;}
 if(!xx)return null;
 const slope=xy/xx,intercept=my-slope*mx;
 return {n:data.length,slope,intercept,r2:yy===0?null:Math.max(0,Math.min(1,xy*xy/(xx*yy))),constant:yy===0};
}
/** Exploratory proxy; the final linearity definition is not fixed. */
export function linearityProxy(fit){return fit?.constant?1:Number.isFinite(fit?.r2)?fit.r2:null;}
/** Exploratory proxy; the final discreteness definition is not fixed. */
export function changeProxy(previous,current){
 return Number.isFinite(previous?.tempo)&&previous.tempo>0&&Number.isFinite(current?.tempo)&&current.tempo>0
  ?Math.abs(Math.log2(current.tempo/previous.tempo)):null;
}
export function structurePoints(recording,rows,window=8){
 return rows.map((row,i)=>{
  if(!Number.isFinite(row.tempo)||row.weight<=0)return null;
  const values=rows.slice(Math.max(0,i-window+1),i+1).filter(p=>p.segment===row.segment);
  const fit=linearFit(values),previous=rows[i-1];
  const jump=previous?.segment===row.segment?changeProxy(previous,row):null;
  const proxyR2=linearityProxy(fit);
  return {...musicPoint(recording,rows,[],row.t,false),bar:row.bar,barPosition:row.barPosition??row.bar,fit,jump,
   linearity:proxyR2,linearityProxyR2:proxyR2,changeProxyLog2:jump};
 }).filter(Boolean);
}
export function scoreMusicPoint(recording,rows,curve,t,smooth){
 const point=musicPoint(recording,rows,curve,t,smooth);
  return point?{...point,bar:timeToBar(rows,t),barPosition:timeToScorePosition(rows,t)}:null;
}
