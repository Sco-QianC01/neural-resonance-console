# EEG → 二維互動 → 音樂參數

## 接入

既有主服務的只讀 WebSocket：`ws://127.0.0.1:8002/ws/live`。
使用 `frontal-live-v1` JSON，時間 `ts` 是 Unix 秒：

```json
{
  "schemaVersion": "frontal-live-v1",
  "source": "core",
  "ts": 1791266400.5,
  "quality": { "eegPackets": 100 },
  "eeg": { "attention": 62, "meditation": 74, "delta": 28, "theta": 34, "alpha": 42, "beta": 22 },
  "attention": 62,
  "meditation": 74
}
```

時間示例必須換成當下採樣時間。有效 EEG 封包數需持續變化；
3 秒無新鮮資料或無封包進展即停止指數互動。

- 原生 `attention` / `meditation` 接受有限數值 0–100。
- 若 `eeg` 只有 `focus_index` / `relaxation_index`，即使頂層欄位別名存在，也只顯示比值。
- USB 的 β/α、θ/α 比值沒有校準，不能冒充已訓練的心理指數。
- `_mean` 頻段值標示 RMS 相對值。裝置頻段值保持來源單位，
  low/high Alpha 或 Beta 在兩者皆存在時加總；不與 RMS 混合標尺。
- 本機 core 是 Delta 低通 <4 Hz、Theta 4–8 Hz、Alpha 8–13 Hz、Beta 13–30 Hz；
  不額外宣稱 Delta 的 0.5 Hz 下限。裝置內建功率標示「裝置分段」，
  其邊界應以感測器規格核對。
- 前端不計算原始 EEG 的頻段或心理判斷，這部分留給已校準的分析/蒸餾模型。

## 十參數實驗映射 v1

這是第一版可修改的工程接口，**尚未宣稱等於 PRO 正式十大要素**。
正式定義由共同開發時確認。令 A=專注度/100，R=放鬆度/100，
E=0.65A+0.35(1−R)。

|參數|規則|
|---|---|
|速度|最低 BPM + (最高−最低) × E|
|節奏密度|1 + 8A|
|音高中心|48 + 24A，MIDI|
|音域|7 + 17A，半音|
|力度|32 + 58E，0–127 標尺|
|音色明亮度|15 + 70E，%|
|和聲張力|10 + 55(1−R)，%|
|發音長度|30 + 60R，%|
|空間寬度|25 + 65R，%|
|過渡時間|1 + 7R，秒|

參數均與當前有效指數同步；無指數時結果為 null。
二維位置 X=A，Y=1−R。貪吃蛇追隨此目標點；它不反向更改輸入 EEG。

## 蒸餾接入

可直接替換 `src/music.mjs` 的 `mapMusic(snapshot, config)`，
保留 `{mappingVersion, source, ts, inputs, parameters}` 輸出契約。
新模型的版本、校準來源、訓練資料與量尺須另行記錄。

目前聲音預覽只把音高中心與力度映射為低音量正弦波，
並未合成完整音樂或應用全部十參數；需主動點擊開啟。
斷線、無效資料、切換來源與頁面隱藏會靜音。

## 記錄

JSON 儲存 EEG、每個樣本對應映射、来源與操作紀錄；不保存姓名、
其他感測器 PR/SpO2/GSR 欄位、帳號憑證或任何上傳。
回放保留樣本時間差與缺口，原始時間戳另存 `originalTimestamp`。
單段最多 20000 個樣本/20 MB 匯入；需要較長研究檔案時另接本地資料庫。
