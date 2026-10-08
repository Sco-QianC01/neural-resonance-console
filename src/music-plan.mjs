import {ELEMENTS} from './music.mjs';

/** Musical descriptors from the supplied teaching slides 16–20.
 * These are authored creative intentions, never EEG or emotion measurements. */
export const PLAN_VERSION='teaching-music-plan-v1';
const make=(id,label,page,rows)=>({
  id,label,source:{id:`teaching-music-elements-p${page}`,type:'teaching-material',
    uri:'./docs/MUSIC-PLANS.md',page},values:Object.fromEntries(ELEMENTS.map(([key],i)=>
      [key,{text:rows[i][0],tags:rows[i].slice(1)}])),
});
export const MUSIC_PLANS=[
  make('bright','明快',17,[
    ['上行旋律、寬音域','上行','大跳','寬音域'],
    ['規整而有力，100–140 BPM','規整','強拍'],
    ['協和和弦、明亮進行','協和','大三和弦','屬—主解決'],
    ['漸強與較大動態範圍','漸強','動態對比'],
    ['快速、穩定，Allegro／Vivace','快速','穩定'],
    ['大調，明確調性','大調','近關係調'],
    ['ABA或回旋，清晰對比','ABA','回旋','對比段落'],
    ['旋律突出、簡潔伴奏','主調織體','突出旋律'],
    ['明亮的樂器音色','小號','高音小提琴','高音鋼琴'],
    ['斷奏、跳音、突出強音','斷奏','跳音','強音'],
  ]),
  make('tension','張力',18,[
    ['不規則線條、半音與大跳','半音','大跳','不規則'],
    ['重音移位與多變節奏','切分','重音移位'],
    ['不協和和弦與緊張進行','不協和','減七','增三'],
    ['突然變化與強烈對比','突強','動態對比'],
    ['快速而多變，包含Presto','快速','變速'],
    ['小調或特殊調式，頻繁轉調','小調','特殊調式','轉調'],
    ['不規則結構，突出的段落轉換','不規則','段落轉換'],
    ['交織的多旋律線','復調','多聲部'],
    ['強奏銅管與密集打擊樂','銅管','打擊樂'],
    ['重音、顫音與滑音','重音','顫音','滑音'],
  ]),
  make('reflective','沉靜',19,[
    ['下行、級進與較窄音域','下行','級進','窄音域'],
    ['簡單而緩慢，40–60 BPM','簡單','弱重音'],
    ['小調和弦與緩慢進行','小三和弦','減三和弦'],
    ['弱力度與較小動態範圍','弱力度','平緩'],
    ['慢速、穩定，Largo／Adagio','慢速','穩定'],
    ['小調與明確調性','小調','明確調性'],
    ['簡單三部結構','三部曲式','短發展段'],
    ['單聲部或稀疏織體','单聲部','稀疏'],
    ['暗色、柔和的樂器音色','大提琴','中提琴','低音管'],
    ['連奏、滑音與弱音器','連奏','滑音','弱音器'],
  ]),
  make('gentle','舒緩',20,[
    ['平穩線條與較小音程','平穩','小音程'],
    ['規律而不強烈，60–80 BPM','規律','弱重音'],
    ['協和和弦與平穩連接','協和','大三和弦','小三和弦'],
    ['中等力度與平緩變化','中等力度','平緩'],
    ['穩定、從容，Andante／Moderato','中速','穩定'],
    ['大調或五聲調式','大調','五聲'],
    ['規整曲式與自然過渡','規整','自然過渡'],
    ['旋律與伴奏協調','主調織體','旋律與伴奏'],
    ['溫暖、柔和的樂器音色','長笛','豎琴','鋼片琴'],
    ['連奏、泛音與均勻力度','連奏','泛音','均勻'],
  ]),
];
export function musicPlan(id,timestamp,{origin='manual',ruleId=null}={}){
  const profile=MUSIC_PLANS.find(plan=>plan.id===id);
  if(!profile||!Number.isFinite(timestamp))return null;
  return {...structuredClone(profile),version:PLAN_VERSION,timestamp,origin,ruleId,
    kind:'creative-intent',inferredEmotion:false,measuredMusic:false};
}
export function parsePlanRules(text){
  if(typeof text!=='string'||text.length>65536)throw new Error('規則檔需小於64 KB。');
  const value=JSON.parse(text);
  if(value?.schemaVersion!=='neural-music-plan-rules-v1'||!Array.isArray(value.zones)
    ||value.zones.length<1||value.zones.length>64||typeof value.id!=='string'||!value.id.trim()
    ||typeof value.author!=='string'||!value.author.trim())throw new Error('請匯入帶作者與版本的音樂規則。');
  for(const zone of value.zones){
    if(!MUSIC_PLANS.some(plan=>plan.id===zone.planId))throw new Error('規則中的音樂方案不存在。');
    for(const axis of ['attention','relaxation']){
      const range=zone[axis];
      if(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)
        ||range[0]<0||range[1]>100||range[0]>=range[1])throw new Error('坐標範圍需位於0–100。');
    }
  }
  for(let i=0;i<value.zones.length;i++)for(let j=0;j<i;j++){
    const a=value.zones[i],b=value.zones[j];
    if(['attention','relaxation'].every(axis=>Math.max(a[axis][0],b[axis][0])<
      Math.min(a[axis][1],b[axis][1])))throw new Error('規則區域不能重疊。');
  }
  return structuredClone(value);
}
export function resolvePlan(snapshot,{manualId='gentle',rules=null}={}){
  if(!snapshot?.valid)return null;
  const recorded=snapshot.source==='replay'?snapshot.raw?.creativeIntent:null;
  if(recorded){
    const canonical=musicPlan(recorded.id,snapshot.timestamp);
    if(!canonical||recorded.version!==PLAN_VERSION||recorded.kind!=='creative-intent'
      ||recorded.timestamp!==snapshot.timestamp
      ||!ELEMENTS.every(([key])=>recorded.values?.[key]?.text===canonical.values[key].text
        &&JSON.stringify(recorded.values[key].tags)===JSON.stringify(canonical.values[key].tags)))return null;
    return {...canonical,origin:'recording',originalOrigin:recorded.originalOrigin??recorded.origin,
      ruleId:typeof recorded.ruleId==='string'?recorded.ruleId:null,
      originalTimestamp:recorded.originalTimestamp??recorded.timestamp};
  }
  if(!rules)return musicPlan(manualId,snapshot.timestamp);
  const within=(range,value)=>value>=range[0]&&(value<range[1]||(range[1]===100&&value===100));
  const zone=rules.zones.find(zone=>within(zone.attention,snapshot.attention)
    &&within(zone.relaxation,snapshot.relaxation));
  return zone?musicPlan(zone.planId,snapshot.timestamp,{origin:'imported-control-rule',ruleId:rules.id}):null;
}
