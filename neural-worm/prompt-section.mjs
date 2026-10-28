export function promptMessage(event, source, origin) {
  if (!source || event.origin !== origin || event.source !== source || !event.data ||
      event.data.type !== 'nr-prompt-ready' || !Number.isFinite(event.data.height) ||
      event.data.height < 100 || event.data.height > 20000) return null;
  return Math.ceil(event.data.height);
}

export function mountPromptSection(root = document, host = window) {
  const origin = host.location.origin;
  const endpoint = new URL('./neural-worm/music-prompt/index.html?embedded=1', root.baseURI).href;
  const frame = root.getElementById('annotation-frame');
  const status = root.getElementById('annotation-status');
  const connection = root.getElementById('annotation-connection');
  const retry = root.getElementById('annotation-retry');
  const help = root.getElementById('annotation-help');
  let visible = false;
  let timer;
  function notify(active = visible) {
    if (!frame.hasAttribute('src')) return;
    frame.contentWindow?.postMessage({ type: 'nr-prompt-visibility', visible: active }, origin);
  }
  function unavailable() {
    clearTimeout(timer);
    connection.hidden = false;
    frame.hidden = true;
    status.textContent = '提示词页面未载入，请刷新或重新连接。蠕虫与采集可继续使用。';
    retry.hidden = help.hidden = false;
  }
  function connect() {
    connection.hidden = false;
    retry.hidden = help.hidden = true;
    status.textContent = '正在载入数据标注与提示词';
    frame.hidden = false;
    frame.src = endpoint;
    clearTimeout(timer);
    timer = setTimeout(unavailable, 8000);
  }
  frame.addEventListener('load', () => notify());
  host.addEventListener('message', (event) => {
    const height = promptMessage(event, frame.contentWindow, origin);
    if (height === null) return;
    clearTimeout(timer);
    frame.style.height = `${height}px`;
    frame.hidden = false;
    connection.hidden = true;
  });
  retry.addEventListener('click', connect);
  host.addEventListener('pagehide', () => { clearTimeout(timer); notify(false); });
  host.addEventListener('pageshow', () => notify());
  return {
    setVisible(next) {
      visible = next;
      if (!visible) { notify(); return; }
      if (!frame.hasAttribute('src')) connect();
      else notify();
    },
  };
}
