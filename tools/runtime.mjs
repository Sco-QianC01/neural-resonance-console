import { spawn } from 'node:child_process';
import path from 'node:path';

export function safeCoreStatus(status) {
  if (!status || typeof status !== 'object' || !status.streams || !status.ports)
    throw new Error('Unexpected sensor status schema');
  return {
    source: status.source, mode: status.mode, uptime: status.uptime_seconds,
    streams: Object.fromEntries(['eeg','spo2','pr','hrv','gsr'].map(key => {
      const item = status.streams[key] || {};
      return [key, { samples: item.samples ?? 0, age: item.age_seconds ?? null }];
    })),
    eegSource: status.eeg_sources?.active ?? 'none',
    ports: { brainlink: status.ports.brainlink, bloodOxygen: status.ports.blood_oxygen },
    workers: (status.workers || []).map(item => ({ name: item.name, alive: item.alive === true })),
    features: { gsr: status.features?.gsr === true },
  };
}

export function readPrograms({ root, manifest, pwsh }, run = spawn) {
  if (process.platform !== 'win32' && run === spawn)
    return Promise.reject(new Error('Local program status requires Windows PowerShell 7'));
  return new Promise((resolve, reject) => {
    const args = ['-NoLogo','-NoProfile','-NonInteractive','-File',path.join(root,'tools','Read-SystemStatus.ps1')];
    if (manifest) args.push('-ManifestPath',manifest);
    // This is read-only and hidden; never launch a terminal for each poll.
    const child = run(pwsh, args, { windowsHide:true, shell:false, stdio:['ignore','pipe','pipe'] });
    let output = '', error = '', settled = false;
    const finish = (failure, value) => {
      if (settled) return; settled = true; clearTimeout(timeout);
      failure ? reject(failure) : resolve(value);
    };
    const timeout = setTimeout(() => { child.kill(); finish(new Error('Program audit timed out')); }, 8000);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.length > 131072) { child.kill(); finish(new Error('Program audit exceeded output limit')); }
    });
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-4000); });
    child.on('error', failure => finish(failure));
    child.on('close', code => {
      if (code !== 0) { finish(new Error('Local program audit unavailable')); return; }
      try {
        const value = JSON.parse(output.replace(/^\uFEFF/, '').trim());
        if (!Array.isArray(value.programs) || !value.checkedAt) throw new Error('Unexpected program schema');
        finish(null, value);
      } catch (failure) { finish(failure); }
    });
  });
}

export class RuntimeMonitor {
  constructor(config, { programs = readPrograms, fetcher = fetch } = {}) {
    this.config = config; this.programs = programs; this.fetcher = fetcher;
    this.audit = null; this.lastAudit = 0; this.auditPromise = null;
  }
  async snapshot() {
    if (!this.auditPromise && Date.now() - this.lastAudit > 10000) {
      this.lastAudit = Date.now();
      this.auditPromise = this.programs(this.config)
        .then(value => { this.audit = { ...value, error:null }; })
        .catch(() => { this.audit = { checkedAt:null, programs:[], error:'無法讀取本機程序狀態' }; })
        .finally(() => { this.auditPromise = null; });
    }
    const corePromise = this.fetcher(`${this.config.coreOrigin}/api/device/status`,
      { signal:AbortSignal.timeout(2000) }).then(async response => {
        if (!response.ok) throw new Error('Sensor API unavailable');
        return { reachable:true, ...safeCoreStatus(await response.json()) };
      }).catch(() => ({ reachable:false }));
    const modelPromise = this.fetcher('http://127.0.0.1:11434/api/version',
      { signal:AbortSignal.timeout(1500) }).then(async response => {
        if(!response.ok)throw new Error('Report model unavailable');
        const value=await response.json();
        return { reachable:typeof value.version==='string' };
      }).catch(()=>({reachable:false}));
    const [core, model] = await Promise.all([corePromise, modelPromise, this.auditPromise]);
    return { schemaVersion:'music-therapy-runtime-v1', checkedAt:new Date().toISOString(),
      core, model, audit:this.audit };
  }
}
