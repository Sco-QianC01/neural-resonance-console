const $ = (id) => document.getElementById(id);
const api = '/api/music-score';
let score = null;
let compiled = null;
let revision = 0;
let compileController = null;
let compileTimer;
let scoreDisplay;
let layoutQueue = Promise.resolve();
let rendererReady = false;
let pending = false;
let artifactUrls = [];
let resizeTimer;
const audio = $('audio');

function message(text, error = false) {
  $('operation-status').textContent = text;
  $('operation-status').classList.toggle('error', error);
}

async function request(path, body, signal) {
  const response = await fetch(`${api}/${path}`, body === undefined
    ? { signal }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  let data;
  try { data = await response.json(); } catch { throw new Error(`接口返回无效 JSON（${response.status}）`); }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.message || `请求失败（${response.status}）`);
  return data;
}

function setLink(id, url, filename) {
  const link = $(id);
  link.href = url;
  if (filename) link.download = filename;
  link.removeAttribute('aria-disabled');
}

function clearLink(id) {
  $(id).removeAttribute('href');
  $(id).setAttribute('aria-disabled', 'true');
}

function clearArtifacts() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  audio.hidden = true;
  $('render-downloads').hidden = true;
  for (const id of ['audio-download', 'events-download', 'report-download', 'package-download', 'xml-download', 'midi-download']) clearLink(id);
  for (const url of artifactUrls) URL.revokeObjectURL(url);
  artifactUrls = [];
  for (const button of $('bar-follow').children) button.disabled = true;
  $('render-badge').textContent = '未渲染';
  $('position').textContent = '尚未播放';
  markBar(null);
}

function refreshButtons() {
  $('render').disabled = pending || !rendererReady || !compiled;
  $('compose').disabled = pending || !score;
  $('reset').disabled = pending;
}

function markBar(number) {
  for (const button of $('bar-follow').children) {
    const current = Number(button.dataset.bar) === number;
    button.classList.toggle('current', current);
    if (current) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
}

function updatePosition() {
  if (!compiled || !audio.getAttribute('src')) return;
  const time = audio.currentTime;
  const bar = compiled.timeline.find((item) => time >= item.startSeconds && time < item.endSeconds);
  markBar(bar?.number ?? null);
  $('position').textContent = bar ? `第 ${bar.number} 小节 · ${time.toFixed(1)} 秒` : time >= compiled.durationSeconds ? `8 小节结束 · ${time.toFixed(1)} 秒` : '尚未播放';
}

function renderControls() {
  $('tempo').value = score.tempoBpm;
  $('bar-controls').replaceChildren();
  $('bar-follow').replaceChildren();
  for (const bar of score.bars) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const number = document.createElement('span');
    number.className = 'bar-number';
    number.textContent = String(bar.number).padStart(2, '0');
    row.append(number);
    for (const [field, options] of [
      ['articulation', [['arco', '持续 · arco'], ['pizzicato', '拨奏 · pizz.']]],
      ['dynamic', [['p', 'p'], ['mp', 'mp'], ['mf', 'mf']]]
    ]) {
      const select = document.createElement('select');
      select.setAttribute('aria-label', `第 ${bar.number} 小节${field === 'articulation' ? '演奏法' : '力度'}`);
      select.dataset.bar = bar.number;
      select.dataset.field = field;
      for (const [value, text] of options) select.add(new Option(text, value));
      select.value = bar[field];
      select.addEventListener('change', () => { bar[field] = select.value; edited(); });
      row.append(select);
    }
    $('bar-controls').append(row);
    const follow = document.createElement('button');
    follow.type = 'button';
    follow.textContent = String(bar.number);
    follow.dataset.bar = bar.number;
    follow.setAttribute('aria-label', `跳至第 ${bar.number} 小节`);
    follow.disabled = true;
    follow.addEventListener('click', () => {
      const position = compiled?.timeline.find((item) => item.number === bar.number);
      if (position && audio.getAttribute('src')) { audio.currentTime = position.startSeconds; updatePosition(); }
    });
    $('bar-follow').append(follow);
  }
  const kind = score.source?.kind;
  $('source-label').textContent = kind === 'ollama' || kind === 'ollama-planned'
    ? '音高来源：本地模型。拍号、节奏与演奏方案为固定约束。'
    : kind === 'authored-demo' ? '音高来源：固定校验样例。可逐小节调整演奏法与力度。'
      : '音高来源：当前事件。拍号、节奏与演奏方案为固定约束。';
}

async function layout(xml, atRevision) {
  layoutQueue = layoutQueue.catch(() => {}).then(async () => {
    if (atRevision !== revision) return;
    if (!window.opensheetmusicdisplay?.OpenSheetMusicDisplay) throw new Error('本地谱面排版组件未能载入');
    scoreDisplay ??= new window.opensheetmusicdisplay.OpenSheetMusicDisplay($('notation'), {
      backend: 'svg', autoResize: false, drawTitle: true, drawComposer: false,
      drawPartNames: false, drawPartAbbreviations: false, drawingParameters: 'compacttight',
      newSystemFromXML: true, stretchLastSystemLine: true,
      drawMeasureNumbers: true, measureNumberInterval: 1,
    });
    await scoreDisplay.load(xml);
    if (atRevision !== revision) return;
    scoreDisplay.render();
  });
  return layoutQueue;
}

async function compileCurrent(atRevision) {
  compileController?.abort();
  compileController = new AbortController();
  try {
    const data = await request('compile', { score }, compileController.signal);
    if (atRevision !== revision) return;
    await layout(data.musicxml, atRevision);
    if (atRevision !== revision) return;
    compiled = data;
    const xmlUrl = URL.createObjectURL(new Blob([data.musicxml], { type: 'application/vnd.recordare.musicxml+xml' }));
    const midi = Uint8Array.from(atob(data.midiBase64), (character) => character.charCodeAt(0));
    const midiUrl = URL.createObjectURL(new Blob([midi], { type: 'audio/midi' }));
    artifactUrls.push(xmlUrl, midiUrl);
    setLink('xml-download', xmlUrl, 'score.musicxml');
    setLink('midi-download', midiUrl, 'performance.mid');
    $('duration').textContent = `谱面时长 ${data.durationSeconds.toFixed(1)} 秒`;
    message('谱面与 MIDI 已同步。渲染后可播放与比较演奏法。');
  } catch (error) {
    if (error.name !== 'AbortError' && atRevision === revision) {
      compiled = null;
      message(error.message, true);
    }
  }
  refreshButtons();
}

function edited() {
  revision += 1;
  compiled = null;
  compileController?.abort();
  clearTimeout(compileTimer);
  clearArtifacts();
  refreshButtons();
  message('输入已变化，正在重新编译谱面与 MIDI。');
  const atRevision = revision;
  compileTimer = setTimeout(() => compileCurrent(atRevision), 180);
}

async function checkStatus() {
  $('runtime-status').textContent = '正在检查音源';
  try {
    const status = await request('status');
    rendererReady = status.ready === true;
    $('runtime-dot').classList.toggle('ready', rendererReady);
    $('runtime-status').textContent = rendererReady ? '本地音源就绪' : '音源尚未就绪';
    $('renderer-detail').textContent = rendererReady
      ? `已找到 ${status.renderer?.fontName || 'GM 音源'} 及所需预置；实际音频在渲染后验证。音源标识和校验值保留在渲染报告中。`
      : status.reason || '未检测到可用的渲染器或音源。谱面与 MIDI 仍可导出。';
  } catch (error) {
    rendererReady = false;
    $('runtime-dot').classList.remove('ready');
    $('runtime-status').textContent = '音源检查失败';
    $('renderer-detail').textContent = error.message;
  }
  refreshButtons();
}

async function resetExample() {
  pending = true;
  refreshButtons();
  const atRevision = ++revision;
  clearTimeout(compileTimer);
  compileController?.abort();
  clearArtifacts();
  try {
    const data = await request('example');
    if (atRevision !== revision) return;
    score = data.score;
    renderControls();
    await compileCurrent(atRevision);
  } catch (error) { if (atRevision === revision) message(error.message, true); }
  finally { pending = false; refreshButtons(); }
}

$('tempo').addEventListener('input', () => {
  if (!score) return;
  score.tempoBpm = $('tempo').value === '' ? null : Number($('tempo').value);
  edited();
});
$('check-runtime').addEventListener('click', checkStatus);
$('reset').addEventListener('click', resetExample);
$('compose').addEventListener('click', async () => {
  if (!score || pending) return;
  pending = true;
  const atRevision = ++revision;
  clearTimeout(compileTimer);
  compileController?.abort();
  clearArtifacts();
  compiled = null;
  refreshButtons();
  message('本地模型正在规划 16 个音高，请稍候。');
  try {
    const data = await request('compose', { tempoBpm: score.tempoBpm });
    if (atRevision !== revision) return;
    score = data.score;
    renderControls();
    await compileCurrent(atRevision);
    if (atRevision === revision && compiled) message('本地模型音高已通过事件约束校验；可渲染试听。');
  } catch (error) { if (atRevision === revision) message(`模型规划失败：${error.message}`, true); }
  finally { pending = false; refreshButtons(); }
});
$('render').addEventListener('click', async () => {
  if (!compiled || pending) return;
  pending = true;
  const atRevision = revision;
  const hash = compiled.scoreHash;
  audio.pause();
  refreshButtons();
  message('正在通过本地音源渲染音频。');
  $('render-badge').textContent = '渲染中';
  try {
    const data = await request('render', { score });
    if (atRevision !== revision || compiled?.scoreHash !== hash) return;
    if (data.scoreHash !== hash) throw new Error('渲染事件与当前谱面不一致，请重新渲染');
    audio.src = data.artifacts.audio;
    audio.hidden = false;
    audio.load();
    for (const [id, key] of [['audio-download', 'audio'], ['events-download', 'events'], ['report-download', 'report'], ['package-download', 'package']]) setLink(id, data.artifacts[key]);
    $('render-downloads').hidden = false;
    for (const button of $('bar-follow').children) button.disabled = false;
    $('render-badge').textContent = '已渲染';
    message('音源渲染完成。点击播放，小节进度随音频更新。');
  } catch (error) {
    if (atRevision === revision) { $('render-badge').textContent = '渲染失败'; message(error.message, true); }
  } finally { pending = false; refreshButtons(); }
});
for (const event of ['timeupdate', 'seeking', 'ended', 'loadedmetadata']) audio.addEventListener(event, updatePosition);
audio.addEventListener('error', () => { if (audio.getAttribute('src')) message('音频加载失败，请重新渲染并检查报告。', true); });
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!scoreDisplay || !compiled) return;
    layout(compiled.musicxml, revision).catch((error) => message(error.message, true));
  }, 160);
}).observe($('score-paper'));
Promise.all([checkStatus(), resetExample()]);
