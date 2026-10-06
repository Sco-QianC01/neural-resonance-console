# 2026-10-06 本地整合變更

## 需求

啟動音療後台後，神經共振前端自動顯示已接入的生理訊號與程序狀態。

## 實作

- 統一 manifest/Start/Stop/Check 新增 Console；主入口預設背景主服務，`-Visible` 可開原終端。
- Node 與 serve.mjs 精確比對，既有實例復用，避免誤認或誤停其他 Node。
- 代理路徑固定 `/ws/live` → localhost:8002，只读；沒有 session 建立操作。
- 自動連線、退避重連、有效手動停止；无设备时维持等待。
- 顯示四主 EEG 頻段、全部收到的數字欄位、USB 比值及 PR/SpO2/HRV/GSR。
- 各生理訊號獨立驗證；HRV 不從脈率推算，GSR 禁用狀態保留。
- 背景狀態查詢使用隐藏 PowerShell 7，合併併發請求，無週期性可見終端。
- Processing 實際 Java 子程序以私有 Java 路徑、主類與 JAR 驗證。
- 主服務追加唯讀工作執行緒/功能狀態；拆開錯誤的 `websocketshttpx2` 依賴行。
- 原始資料、Max/OSC 路由、手機傳輸及療程報告流程保持既有鏈路。

## 驗證

- 17 項 Node 資料/映射/狀態測試通過，靜態構建通過。
- PowerShell 啟停、讀取與共用檔解析通過。
- 控制台停止釋放8767；重新啟動後 WebSocket 自動接入真實主服務。
- 主服務8條工作執行緒、九個登記程序及所需端口在運行。
- 手機/MuMu橋接和重連守護在運行，Ollama接口可讀取。
- 受控瀏覽器流驗證全部生理值、記錄、缺值、不良 EEG 下的血氧獨立顯示、重連、手動停止。
- 桌面與390px手機頁面無水平溢出及JavaScript例外。
- 實機資料目前為0樣本；硬體及完整療程驗收仍待實機。

## 本地外部變更位置

```text
Q:\音疗系统\澳门科技大学\02_启动与检查\启动\launcher-manifest.json
Q:\音疗系统\澳门科技大学\02_启动与检查\启动\Start-MusicTherapy.ps1
Q:\音疗系统\澳门科技大学\02_启动与检查\启动\Stop-MusicTherapy.ps1
Q:\音疗系统\澳门科技大学\02_启动与检查\启动\Check-MusicTherapy.ps1
Q:\音疗系统\澳门科技大学\02_启动与检查\启动\MusicTherapy.Common.ps1
Q:\音疗系统\澳门科技大学\01_核心系统\music-therapy-pod-sensors\运行澳门版.ps1
Q:\音疗系统\澳门科技大学\01_核心系统\music-therapy-pod-sensors\app.py
Q:\音疗系统\澳门科技大学\01_核心系统\music-therapy-pod-sensors\requirements.txt
```

回滾備份和實測證據存於本機 `artifacts/`，不提交受試資料、憑證或備份。
