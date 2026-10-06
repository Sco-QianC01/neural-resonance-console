export const DEFAULT_CONFIG=Object.freeze({
  startupMode:'demo',endpoint:'',autoConnect:false,
});

export function normalizeConfig(value={},baseUrl) {
  const config={...DEFAULT_CONFIG};
  if(value.startupMode==='live')config.startupMode='live';
  if(typeof value.endpoint==='string'&&value.endpoint.trim()){
    const text=value.endpoint.trim();
    const url=text.startsWith('/')?new URL(text,baseUrl):new URL(text);
    if(text.startsWith('/'))url.protocol=url.protocol==='https:'?'wss:':'ws:';
    if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)
      throw new Error('The data endpoint must be a ws:// or wss:// URL without embedded credentials.');
    config.endpoint=url.href;
  }
  config.autoConnect=config.startupMode==='live'&&Boolean(config.endpoint)&&value.autoConnect===true;
  return config;
}

/** Deterministic synthetic motion for the standalone interactive example. */
export function demoValues(attention,relaxation,tick,animated=true) {
  const clamp=v=>Math.max(0,Math.min(100,v));
  return {
    attention:clamp(attention+(animated?16*Math.sin(tick/13)+7*Math.sin(tick/7):0)),
    relaxation:clamp(relaxation+(animated?15*Math.cos(tick/19)+6*Math.sin(tick/9):0)),
  };
}
