import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const baseline=JSON.parse(await readFile(new URL('./fixtures/prompt-upstream-freeze.json',import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');

test('annotation preserves upstream acquisition, waveform and worm source',async()=>{
  for(const [name,hash] of Object.entries(baseline.files)){
    let content=(await readFile(new URL(`../${name}`,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
    if(name==='index.html'){
      content=content
        .replace('  <link rel="stylesheet" href="./neural-worm/prompt-section.css">\n','')
        .replace(/<button data-view="annotation"[\s\S]*?<\/button>/,'')
        .replace(/<section id="view-annotation"[\s\S]*?<\/section>\n/,'')
        .replace('src="./neural-worm/prompt-entry.mjs"','src="./neural-worm/app.mjs"');
    }else if(name==='neural-worm/app.mjs'){
      content=content.replaceAll("['waveforms','worm','settings','annotation']","['waveforms','worm','settings']")
        .replace("['settings','waveforms','worm','annotation']","['settings','waveforms','worm']")
        .replace(",annotation:'數據標註'",'')
        .replace(",annotation:'ANNOTATION / PROMPT'",'')
        // The requested startup fix only guards an optional, removed label.
        .replace("  const prLabel=$('sensor-pr-label');\n  if(prLabel)prLabel.textContent=",
          "  $('sensor-pr-label').textContent=");
    }else if(name==='src/i18n.mjs'){
      content=content
        .replace('  "數據標註": {"zh-Hans": "数据标注", "en": "Data Annotation"},\n','')
        .replace('  "ANNOTATION / PROMPT": {"zh-Hans": "标注 / 提示词", "en": "ANNOTATION / PROMPT"},\n','');
    }
    assert.equal(sha(content),hash,`${name}: protected ${baseline.upstream} content changed`);
  }
});

test('frozen waveform section keeps its published baseline digest',async()=>{
  const html=(await readFile(new URL('../index.html',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const section=html.slice(html.indexOf('<section id="view-waveforms"'),html.indexOf('<div id="view-worm"')).trimEnd();
  assert.equal(sha(section).slice(0,16),'8769e9eeae8ed281');
});
