import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGUAGES, t, toSimplified, getLanguage, setLanguage } from '../src/i18n.mjs';

test('i18n module provides three languages', () => {
  assert.deepEqual(Object.keys(LANGUAGES), ['zh-Hans', 'zh-Hant', 'en']);
  assert.equal(LANGUAGES['zh-Hans'], '简体中文');
  assert.equal(LANGUAGES['zh-Hant'], '繁體中文');
  assert.equal(LANGUAGES['en'], 'English');
});

test('t() returns Traditional Chinese unchanged when lang is zh-Hant', () => {
  assert.equal(t('神經共振', 'zh-Hant'), '神經共振');
  assert.equal(t('設備設定', 'zh-Hant'), '設備設定');
  assert.equal(t('波形捕獲', 'zh-Hant'), '波形捕獲');
});

test('Traditional Chinese index labels retain Simplified Chinese and English translations', () => {
  assert.equal(t('腦波頻段與指數', 'zh-Hant'), '腦波頻段與指數');
  assert.equal(t('腦波頻段與指數', 'zh-Hans'), '脑波频段与指数');
  assert.equal(t('腦波頻段與指數', 'en'), 'Brainwave Bands and Indices');
  assert.equal(t('保存設備身份', 'zh-Hans'), '保存设备身份');
  assert.equal(t('實時資料源共用左側接口。切換這三個介面不會停止接收。設定僅保存在此瀏覽器，不含作者電腦路徑。', 'en'),
    'Live stream shares left panel source. Switching views does not interrupt reception. Settings stored locally in browser without author host paths.');
});

test('dynamic device status and capability labels are translated in all three languages', () => {
  assert.equal(t('采集已停止', 'zh-Hans'), '采集已停止');
  assert.equal(t('采集已停止', 'zh-Hant'), '采集已停止');
  assert.equal(t('采集已停止', 'en'), 'Acquisition stopped');
  assert.equal(t('執行環境', 'zh-Hans'), '执行环境');
  assert.equal(t('執行環境', 'zh-Hant'), '執行環境');
  assert.equal(t('執行環境', 'en'), 'Execution Context');
  assert.equal(t('由作業系統管理', 'en'), 'Managed by Operating System');
});

test('dynamic waveform and score labels have complete English translations', () => {
  assert.equal(t('Alpha · 合計', 'en'), 'Alpha · Total');
  assert.equal(t('參考文獻', 'en'), 'References');
  assert.equal(t('ATTENTION / 專注：代理與原生', 'en'), 'ATTENTION / Proxy and Native');
  assert.equal(t('MEDITATION / 放鬆：代理與原生', 'en'), 'MEDITATION / Proxy and Native');
  assert.equal(t('拍點插值定位', 'en'), 'Beat-interpolated alignment');
  assert.equal(t('譜面來源與定位方法', 'en'), 'Score Source & Alignment Method');
});

test('EEG settings distinguish the local service from direct device connections', () => {
  assert.equal(t('EEG 設備', 'en'), 'EEG Device');
  assert.equal(t('本機採集器', 'en'), 'Local Acquisition Service');
  assert.equal(t('本機採集器隨桌面應用啟動；純網頁預覽不會啟動 EEG 硬體。有效資料到達後，設備狀態會顯示在左側。', 'en'),
    'The local acquisition service starts with the desktop app; a browser preview cannot start EEG hardware. Device status appears in the sidebar when valid data arrives.');
  assert.equal(t('選擇 EEG 設備', 'en'), 'Select EEG Device');
  assert.equal(t('停止設備連接', 'en'), 'Stop Connection');
  assert.equal(t('開始本地記錄', 'en'), 'Start Local Recording');
  assert.equal(t('停止本地記錄', 'en'), 'Stop Local Recording');
  assert.equal(t('即時資料監控', 'en'), 'Live Data Monitor');
  assert.equal(t('监控只显示通过协议校验的 EEG 数据；每行按 100 毫秒聚合。自动存档保留设备收到的原始字节，包括未通过校验的数据，不重复保存解析后的 JSON。桌面采集器自动保存至项目目录下的 EEG Data 文件夹，实际路径显示于下方状态列。', 'en'),
    'The monitor shows only protocol-validated EEG data, aggregated in 100 ms rows. Archiving preserves received raw device bytes, including invalid frames, without duplicating parsed JSON. The desktop collector always saves to an EEG Data folder inside the project directory; its full path is shown in the status line below.');
  assert.equal(t('由設備文件提供', 'zh-Hant'), '由設備文件提供');
  assert.equal(t('選填', 'zh-Hant'), '選填');
  assert.equal(t('由設備文件提供', 'en'), 'From device manual');
  assert.equal(t('已選保存文件夾', 'en'), 'Selected save folder');
  assert.equal(t('已記住保存文件夾', 'zh-Hant'), '已記住保存資料夾');
  assert.equal(t('瀏覽器未確認文件夾選擇，尚未取得保存授權。', 'zh-Hans'),
    '浏览器未确认文件夹选择，尚未取得保存授权。');
  assert.equal(t('內置瀏覽器未返回所選文件夾，請在 Chrome 或 Edge 打開此頁後重新選擇。', 'zh-Hans'),
    '内置浏览器未将所选文件夹交给网页，请在 Chrome 或 Edge 打开此页面后重新选择。');
  assert.equal(t('內置瀏覽器未返回所選文件夾，請在 Chrome 或 Edge 打開此頁後重新選擇。', 'en'),
    'The embedded browser did not return the selected folder. Reopen this page in Chrome or Edge and select it again.');
  assert.equal(t('保存授權未取得', 'zh-Hant'), '尚未取得保存授權');
  assert.equal(t('保存授權未取得', 'en'), 'Save permission not granted');
  assert.equal(t('文件夾已選，本次頁面可保存；瀏覽器未能記住選擇。', 'en'),
    'Folder selected and usable on this page, but the browser could not remember it.');
  assert.equal(t('已記住瀏覽器 EEG 保存目錄，連接前需重新授權。', 'zh-Hans'),
    '已记住浏览器 EEG 保存目录，连接前需重新授权。');
  assert.equal(t('瀏覽器 EEG 保存目錄權限已失效，請重新選擇目錄。', 'en'),
    'Permission for the EEG save folder has expired. Please select the folder again.');
  assert.equal(t('採集器下載與安裝說明', 'en'), 'Download & Install the Acquisition Service');
  assert.equal(t('保存或匯入設備連接參數', 'en'), 'Save or Import Device Connection Settings');
});

test('device settings expose only real EEG connection controls', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="gateway-eeg-select"/);
  assert.match(html, /id="gateway-ble-select"/);
  assert.match(html, /<h2>EEG 設備<\/h2>/);
  assert.ok(html.indexOf('id="device-methods-title"') < html.indexOf('id="monitor-title"'),
    'device connection comes before acquisition facts monitoring');
  assert.ok(html.indexOf('id="monitor-title"') < html.indexOf('id="history-import-title"'),
    'history import follows live acquisition monitoring');
  assert.match(html, /id="stream-feed"/);
  assert.match(html, /id="eeg-device-id"/);
  assert.match(html, /id="replay-file" type="file" accept="\.json,\.jsonl,\.tgam,application\/json" multiple/);
  assert.doesNotMatch(html, /settings-record|settings-export|settings-csv-export|保存或匯入設備連接參數|下載設定 JSON/);
  // The desktop collector is the only acquisition path. No browser-direct
  // device picker, no baud selector, no browser folder authorization.
  assert.doesNotMatch(html, /id="serial-connect"|id="ble-connect"|id="baud"|id="usb-state"|id="ble-state"/);
  assert.doesNotMatch(html, /id="choose-eeg-directory"|id="eeg-directory-name"|direct-device|direct-state/);
  // Device identity is always visible, and one button saves identity + label.
  assert.doesNotMatch(html, /<details id="gateway-panel"/);
  assert.match(html, /<section id="gateway-panel"/);
  assert.doesNotMatch(html, /id="confirm-device-id"/);
  // Device identity is always visible, and one button saves identity + label.
  assert.doesNotMatch(html, /<details id="gateway-panel"/);
  assert.match(html, /<section id="gateway-panel"/);
  assert.doesNotMatch(html, /id="confirm-device-id"/);
  assert.match(html, /<h2>EEG 設備<\/h2>/);
  assert.match(html, /監控只顯示通過協議校驗|监控只显示通过协议校验/);
  // Each transport gets its own start/stop; the collector restarts its workers
  // when this flag changes, so no relaunch is needed.
  assert.match(html, /id="gateway-eeg-toggle"[^>]*>停止 EEG USB</);
  assert.match(html, /id="gateway-ble-toggle"[^>]*>停止 腦電 BLE</);
  // The one recovery action is a page reload — the same thing Cmd+R does. It has
  // no server dependency, so it cannot fail with a status code on a collector
  // that predates it.
  assert.match(html, /id="gateway-refresh"[^>]*>重新載入</);
  // A picker choice is written the moment it changes, so there is no second
  // 「save」 button to forget — one place to decide, one place to look.
  assert.doesNotMatch(html, /id="gateway-save"/);
  // The platform is part of the panel's state line only if it earns its space;
  // the collector is cross-platform, so naming the host OS there is noise.
  assert.doesNotMatch(html, /id="gateway-platform"/);
  // Recording folder is chosen in 01; start/stop is gated on it being writable.
  assert.match(html, /id="storage-directory"/);
  assert.match(html, /id="storage-apply"/);
  assert.match(html, /id="storage-state"/);
  assert.doesNotMatch(html, /gateway-oxygen-select|AFE4490|127\.0\.0\.1:8767|其他連接方式與診斷/);
});

test('EEG monitor and connection controls are translated in all three languages', () => {
  assert.equal(t('EEG 設備', 'zh-Hans'), 'EEG 设备');
  assert.equal(t('EEG 設備', 'en'), 'EEG Device');
  assert.equal(t('采集事实数据监控', 'zh-Hant'), '採集事實資料監控');
  assert.equal(t('由设备文件提供', 'zh-Hant'), '由設備文件提供');
  assert.equal(t('监控只显示通过协议校验的 EEG 数据；每行按 100 毫秒聚合。自动存档保留设备收到的原始字节，包括未通过校验的数据，不重复保存解析后的 JSON。桌面采集器自动保存至项目目录下的 EEG Data 文件夹，实际路径显示于下方状态列。', 'zh-Hant'),
    '監控只顯示通過協議校驗的 EEG 資料；每行按 100 毫秒聚合。自動存檔保留設備收到的原始位元組，包括未通過校驗的資料，不重複保存解析後的 JSON。桌面採集器自動保存至專案目錄下的 EEG Data 資料夾，實際路徑顯示於下方狀態列。');
  assert.equal(t('即時資料監控', 'en'), 'Live Data Monitor');
  assert.equal(t('選擇 EEG 設備', 'en'), 'Select EEG Device');
  assert.equal(t('停止設備連接', 'en'), 'Stop Connection');
  assert.equal(t('開始本地記錄', 'en'), 'Start Local Recording');
  assert.equal(t('停止本地記錄', 'en'), 'Stop Local Recording');
  assert.equal(t('保存或匯入設備連接參數', 'en'), 'Save or Import Device Connection Settings');
  const rollingDescription = '监控只显示通过协议校验的 EEG 数据；每行按 100 毫秒聚合。自动存档保留设备收到的原始字节，包括未通过校验的数据，不重复保存解析后的 JSON。桌面采集器自动保存至项目目录下的 EEG Data 文件夹，实际路径显示于下方状态列。';
  assert.match(t(rollingDescription, 'zh-Hans'), /每行按 100 毫秒聚合/);
  assert.match(t(rollingDescription, 'en'), /The desktop collector always saves to an EEG Data folder inside the project directory/);
  assert.match(t('畫面聚合與平滑只影響監看；原始存檔保留收到的位元組，資料映射在導入時依協議規則執行。', 'zh-Hans'), /原始存档保留收到的字节/);
  assert.match(t('畫面聚合與平滑只影響監看；原始存檔保留收到的位元組，資料映射在導入時依協議規則執行。', 'en'), /raw archive preserves received bytes/);
  assert.match(t('TGAM 原始流不含逐封包時間戳；導入回放時間按約 513 個封包／秒估算，不代表設備精確時間。', 'zh-Hans'), /不代表设备精确时间/);
  assert.match(t('TGAM 原始流不含逐封包時間戳；導入回放時間按約 513 個封包／秒估算，不代表設備精確時間。', 'en'), /not device-exact/);
  assert.match(t('上游仅提供解析数据，无法保存原始字节流', 'en'), /raw bytes cannot be archived/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(t('选择此前保存的 JSON、JSONL 或自描述 TGAM 原始记录文件。', 'en'),
    'Import a saved JSON, JSONL, or self-describing raw TGAM recording.');
  assert.equal(t('TGAM 約每秒輸出 512 個原始 EEG 樣本，並在較慢的彙總封包中提供指數、接觸品質與頻段功率。單個 .tgam 文件包含會話資訊與完整原始字節流。', 'en'),
    'TGAM sends about 512 raw EEG samples per second, with indices, contact quality, and band powers in slower summary packets. A single .tgam file contains session metadata and the complete raw byte stream.');
  assert.equal(t('转换 TGAM 原始文件', 'en'), 'Convert Raw TGAM File');
  assert.equal(t('选择一个 .tgam 文件，然后下载可阅读的 JSON 或表格 CSV；原始文件不会改动。', 'en'),
    'Select a .tgam file to download readable JSON or spreadsheet CSV; the raw file is unchanged.');
  const app = readFileSync(new URL('../neural-worm/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /state\.storage\.state==='unavailable'[\s\S]*上游仅提供解析数据，无法保存原始字节流/);
  assert.match(app, /decodeTgamFile[\s\S]*spreadsheetCsv\(parsed\.snapshots\)/);
  assert.match(html, /id="convert-tgam-file"/);
  assert.match(html, /id="convert-tgam-file" type="file" accept="\.tgam" multiple/);
  assert.match(html, /id="convert-tgam-json"/);
  assert.match(html, /id="convert-tgam-csv"/);
  assert.doesNotMatch(html, /\.meta\.json/);
  assert.equal(t('57600 · TGAM 推薦', 'zh-Hans'), '57600 · TGAM 推荐');
  assert.equal(t('57600 · TGAM 推薦', 'en'), '57600 · Recommended for TGAM');
  assert.equal(t('9600 · 低速設備（可能缺原始波形）', 'en'),
    '9600 · Low-speed devices (may omit raw waveform)');
  assert.equal(t('只影響此處的瀏覽器直連；採集器使用自身設定。TGAM 設備請選 57600。', 'en'),
    'Applies to this browser-direct path only; the collector uses its own setting. Choose 57600 for TGAM devices.');
  assert.equal(t('瀏覽器直連波特率', 'en'), 'Browser-direct baud rate');
  assert.equal(t('瀏覽器直連 · 後備', 'en'), 'Browser Direct · Fallback');
  assert.match(t('桌面採集器已自動連接設備時，此處可略過；僅在未啟動採集器時使用。', 'en'),
    /Skip this section while the desktop collector has the device connected/);
  assert.doesNotMatch(html, /id="monitor-raw"/);
  assert.match(html, /id="monitor-quality"/);
  const css = readFileSync(new URL('../neural-worm/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.monitor-metrics\{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.stream-feed\{[^}]*height:260px/);
  assert.match(css, /\.stream-feed li\{[^}]*flex:0 0 auto/);
});

test('t() translates accurately to Simplified Chinese', () => {
  assert.equal(t('神經共振', 'zh-Hans'), '神经共振');
  assert.equal(t('設備設定', 'zh-Hans'), '设备设定');
  assert.equal(t('音樂與神經響應', 'zh-Hans'), '音乐与神经响应');
  assert.equal(t('波形捕獲', 'zh-Hans'), '波形捕获');
  assert.equal(t('專注度', 'zh-Hans'), '专注度');
  assert.equal(t('放鬆度', 'zh-Hans'), '放松度');
  assert.equal(t('開始記錄', 'zh-Hans'), '开始记录');
});

test('t() translates accurately to English', () => {
  assert.equal(t('神經共振', 'en'), 'Neural Resonance');
  assert.equal(t('設備設定', 'en'), 'Device Settings');
  assert.equal(t('音樂與神經響應', 'en'), 'Music & Neural Response');
  assert.equal(t('波形捕獲', 'en'), 'Waveform Capture');
  assert.equal(t('專注度', 'en'), 'Attention');
  assert.equal(t('放鬆度', 'en'), 'Meditation');
  assert.equal(t('開始記錄', 'en'), 'Start Recording');
});

test('toSimplified fallback converts unmapped traditional characters', () => {
  const result = toSimplified('第 3 小節 · 顯示速度');
  assert.equal(result, '第 3 小节 · 显示速度');
});

test('the recovery button reloads the page instead of asking the collector', () => {
  // Two rounds of pain came from this button calling a route the running
  // collector did not have: 405 from the static catch-all, then a text telling
  // the operator to restart the collector. A reload needs no route, no guard
  // and no explanation — it is the same action as Cmd+R, and it is safe while
  // acquisition is recording because the recording lives in the collector.
  const app = readFileSync(new URL('../neural-worm/app.mjs', import.meta.url), 'utf8');
  const handler = app.match(/\$\('gateway-refresh'\)\.onclick=[^\n]*/);
  assert.ok(handler, 'the reload button lost its handler');
  assert.match(handler[0], /location\.reload\(\)/);
  assert.doesNotMatch(app, /api\/gateway\/refresh/, 'the button must not depend on a server route');
});
