# 共同開發交接

## 本機入口

Q:\音疗系统\脑机接口\neural-resonance-console

```powershell
git clone https://github.com/Sco-QianC01/neural-resonance-console.git
cd neural-resonance-console
npm test
npm start
```

開啟 `http://127.0.0.1:8767/`，先選「示範 → 開始示範」驗收互動。
此私有庫由 Sco-QianC01 持有。其他共同開發者需由庫主添加 collaborator。

更新：

```powershell
git pull --ff-only
git switch -c feature/my-change
# 編輯後
npm test
npm run build
git add .
git commit -m "Describe the change"
git push -u origin feature/my-change
```

## 後續兩週建議順序

1. **真實 EEG 接入驗收**：USB、BLE 與斷流恢復各錄一段；
   核對時間戳、頻段量尺、裝置指數與相同資料輸出的對應。
2. **確認 PRO 十要素**：替換目前草案名稱/單位/範圍，建立人工標註字段。
3. **資料標註**：按原曲/受試檔案分組切分，保留 source、
   valid/缺口與版本，標註者覆核後才作教師資料。
4. **蒸餾與校準**：先固定離線資料與基線，驗證新模型如何將 EEG/指數映射參數，
   區分訓練、驗證與保留集，再接 `src/music.mjs`。
5. **樂音引擎**：目前正弦聲只是預覽；後續將十參數接成實際節奏/音色/樂曲，
   最後才與四個生成模型共用接口。
6. **雲端部署**：選定 .dev 平台與設備 wss 網關；先測頁面，
   再測現場設備。雲端靜態頁面不能代替本機設備服務。

## 已完成的工程驗證

見 ACCEPTANCE.md。新倉庫沒有原系統報告、受試記錄、權重或憑證。
本地 artifacts/ 保存截圖、測試流導出、GitHub 狀態與 Pages 422 原始原因；
這些測試證據不混入研究資料庫。
