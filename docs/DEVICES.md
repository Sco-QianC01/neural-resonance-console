# 設備與接口

## 三種接入

- WebSocket：接收 `neural-resonance-live-v1` 或 `frontal-live-v1`；跨平台入口。
- Web Serial：使用者主動選擇串口，波特率自行配置。
- Web Bluetooth：使用者主動選擇 BLE 設備，指定服務 UUID、通知特徵 UUID。

直接設備接收器解析標準 ThinkGear 二進位封包，包括同步頭、長度、
checksum、原始有符號 ADC 樣本、設備注意／放鬆指數與頻段來源值。
不會套用未經確認的電壓換算；專有協議用外部解析器接入。
checksum 錯誤不產生樣本；超過3秒的舊指數不因新原始包而重新生效。
只有整個 payload 有效時才更新指數緩存；未知擴展碼不當作基礎代碼。
ThinkGear 的 eSense 值 0 表示無法計算有效值，保留原始資料但不驅動互動。
協議參考：[NeuroSky ThinkGear Communications Protocol](https://developer.neurosky.com/docs/doku.php?id=thinkgear_communications_protocol)。

連接、選擇設備和瀏覽器授權由使用者點擊觸發。
三個介面由同一頁管理，切換不停止接收；按「停止」或關閉頁面才釋放設備。
網頁不會掃描系統全部驅動，也不會自動安裝驅動。

## 上傳與下載

- 記錄 JSON 使用 `neural-resonance-recording-v1`，可在波形頁回放。
- CSV 保留時戳、來源、設備指數、頻段值與可用的原始樣本。
- 設定 JSON 使用 `neural-resonance-settings-v1`，不包含憑證。
- 上傳接口由使用者填入 HTTP／HTTPS URL，需接受 JSON POST 並允許 CORS。
- 「HTTP成功」只表示接口回應；本頁不據此宣稱遠端資料已永久入庫。

所有地址可配置，沒有作者電腦路徑或預設私人接口。

## 桌面遮罩

瀏覽器匯出四條頻段線的透明 PNG。
即時 Spout 紋理由獨立 Windows 波形工具輸出，不由此網頁冒充。
原始 EEG 在 `/raw` 或 `rawEegSamples` 存在時保留；
低速頻段快照不能當作按設備採樣率連續取得的原始 EEG；
不同設備的採樣率、頻段邊界和功率／RMS 單位需要分別配置。
