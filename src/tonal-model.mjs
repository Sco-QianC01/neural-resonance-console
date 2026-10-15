/** Musical identities are independent of the spherical display embedding. */
export const PITCH_NAMES=Object.freeze(['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B']);
function integer(value){if(!Number.isInteger(value))throw new TypeError('音級必須是整數');return value;}
const mod=value=>((integer(value)%12)+12)%12;
export function chord(root=0,quality='major'){
  if(!['major','minor'].includes(quality))throw new TypeError('只接受大小三和弦');
  return {root:mod(root),quality};
}
export function triad(value){
  const c=chord(value.root,value.quality);
  return [c.root,mod(c.root+(c.quality==='major'?4:3)),mod(c.root+7)];
}
export function transform(value,operation){
  const c=chord(value.root,value.quality),minor=c.quality==='minor';
  if(!['P','L','R'].includes(operation))throw new TypeError('未知和弦變換');
  const delta={P:0,L:minor?-4:4,R:minor?3:-3}[operation];
  return chord(c.root+delta,minor?'major':'minor');
}
export function voiceLeading(before,after){
  const a=triad(before),b=triad(after);
  return {common:a.filter(n=>b.includes(n)),from:a.filter(n=>!b.includes(n)),to:b.filter(n=>!a.includes(n))};
}
export function fifth(value,direction=1){
  if(![-1,1].includes(direction))throw new TypeError('五度方向必須為±1');
  return chord(value.root+7*direction,value.quality);
}
export function chordName(value,short=false){
  const c=chord(value.root,value.quality);
  return PITCH_NAMES[c.root]+(short?(c.quality==='minor'?'m':''):` ${c.quality}`);
}
export function scale(value){
  const c=chord(value.root,value.quality);
  return (c.quality==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10]).map(n=>mod(c.root+n));
}
const phi=(1+Math.sqrt(5))/2;
const vertices=[[0,1,phi],[0,-1,phi],[0,1,-phi],[0,-1,-phi],[1,phi,0],[-1,phi,0],
  [1,-phi,0],[-1,-phi,0],[phi,0,1],[-phi,0,1],[phi,0,-1],[-phi,0,-1]];
// Explicit visual embedding chosen for the accepted reference composition.
// Geodesic edges are reference geometry, not the 36 Tonnetz musical relations.
const vertexForPitch=[4,3,8,7,9,2,11,6,1,0,10,5];
export function pitchPosition(pitch){
  if(!Number.isInteger(pitch)||pitch<0||pitch>11)throw new TypeError('不存在的音級');
  const p=vertices[vertexForPitch[pitch]],length=Math.hypot(...p);
  return p.map(n=>n/length);
}
export function frequency(pitch,octave=4){
  if(!Number.isInteger(octave)||octave<0||octave>8)throw new TypeError('八度超出試聽範圍');
  return 440*2**((12*(octave+1)+mod(pitch)-69)/12);
}
