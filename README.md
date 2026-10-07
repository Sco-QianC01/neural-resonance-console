# 神經共振 / Neural Resonance

一個獨立運行的腦波交互前端，只有三個介面：

| 介面 | 可以做什麼 |
|---|---|
| **01 波形捕獲** | 看四頻段和原始腦波，記錄、回放，匯出 JSON／CSV，保存透明波形遮罩 |
| **02 神經蠕蟲** | 用連續樣本形成二維光粒子軌跡，觀察十大音樂要素神經網，複製音樂創作提示詞 |
| **03 設備設定** | 配置 USB／BLE／WebSocket，檢查瀏覽器與資料接口，匯入／匯出設定及上傳記錄 |

開啟網站立即顯示動態示範。切換三個介面共用同一份資料，
不需要作者的設備、路徑或後台，也沒有品牌顏色切換。

![波形捕獲](public/console.png)
![神經蠕蟲](public/neural-worm.png)

## 本地運行

安裝 Node.js 20 或更新版本：

```sh
git clone https://github.com/Sco-QianC01/neural-resonance-console.git
cd neural-resonance-console
npm start
```

開啟 `http://localhost:5173/`。不需要安裝 npm 依賴。
端口和監聽地址可改：

```sh
npm start -- --port 6123
npm start -- --host 0.0.0.0
```

第二種方式可讓同一區域網路的其他設備，使用此電腦的網路地址訪問。

## 接入設備

1. 在「實時」填入你自己的 WebSocket 資料源，按「連接」。
2. 使用直接 USB／BLE 接入時，在「設備設定」主動選擇設備並授權。
3. USB／BLE 接收器支援標準 ThinkGear 通知流。設備使用其他協議時，
   使用原廠驅動／你的橋接器解析後，再透過 WebSocket 接入。

瀏覽器硬體 API 依平台而異；BLE 需要正確的服務和通知特徵 UUID。
接口可用不等於設備已連接，網頁不會替你安裝系統驅動。
HTTPS 網站使用 `wss://`，本地 HTTP 頁面可使用 `ws://`。

詳見 [資料格式](docs/DATA-INPUT.md) 和 [設備接入](docs/DEVICES.md)。
`public/config.json` 可以配置啟動模式、資料源與自動連接。
預設不探測、不連接任何私人服務。

## 神經蠕蟲

借鑑演奏蠕蟲圖的「二維量值 + 時間軌跡」思路，
本頁的座標可選專注度／放鬆度，或 EEG 映射出的速度／力度。
軌跡來自收到的樣本，不是遊戲目標或預先編好的游走路徑。

下方十個網對應：旋律、節奏、和聲、力度、速度、調式、曲式、
織體、音色、演奏法。密集度和離散度是可修改的互動控制量：

- [音樂控制量與公式](docs/MAPPING.md)
- [神經網、座標與記錄](docs/NEURAL-WORM.md)

這些映射尚非訓練完成的情緒模型；光粒子不代表實測腦區連通性。
實時來源失效時停止游走，不自动切換示範。

### 把資料帶入音樂創作

在蠕蟲頁下方選擇觀察窗口與目標模型，按「產生提示詞」。
可以複製文字到 ACE XL SFT、韶元、MiniMax 或 YuE2，
也可以匯出包含十項參數、0–127 控制值和資料來源的 JSON。
目前目標選擇只記錄交接對象，沒有呼叫模型或改寫模型專用參數。

提示詞僅使用當前來源、當前 session 的有效樣本；斷流時停用匯出。
原始設備指數保留 0–100，0–127 是另行導出的互動控制座標，
不是重新計算的腦電指數，也不會直接發送 MIDI。
示範、回放與實測來源都會保留在匯出內容中。

規則版本、來源時間及樣本間隔可用來重現一次交接。
這些規則供研究協作修改，尚未證明具有特定情緒或療效關係。

## 保存與部署

記錄先保留在目前頁面。下載 JSON／CSV 才保存到設備；
只有在設備頁明確按「上傳」才發送到你配置的 JSON POST 接口。
回放保留原始樣本間隔與缺值，不會自動補齊。

```sh
npm test
npm run build
```

把 `dist/` 部署到 GitHub Pages 或其他靜態託管平台即可。
GitHub Pages 入口 `/neural-worm/` 仍可直接打開蠕蟲介面。

| 位置 | 用途 |
|---|---|
| `neural-worm/app.mjs` | 三介面、資料接收、記錄與設定 |
| `src/eeg.mjs` | 格式、品質判斷與重連 |
| `src/waveform-view.mjs` | 時間波形、二維蠕蟲軌跡 |
| `src/music.mjs` | 十大音樂要素的控制規則 |
| `src/prompt.mjs` | 有效窗口、十項控制量與手動提示詞交接 |
| `src/recording.mjs` | 保存原生指數、資料來源、單位與 CSV 匯出 |
| `src/neural-networks.mjs` | 光粒子與十網控制 |
| `src/device-input.mjs` | USB／BLE 與 ThinkGear 解析 |

協作方式見 [開發指南](docs/HANDOFF.md)。MIT 授權。
