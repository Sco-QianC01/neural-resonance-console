# 圖形、數據與來源核對

更新：2026-10-09，版本0.11.2。

## 修正範圍

撤下十種預置造型及EEG至BPM、音高、張力、明亮度、複雜度等公式。沒有校準依據時，標為「實驗」仍不能把它們展示為分析結果。

十項名稱是本專案的音樂標注分組，不宣稱是研究界唯一的十大分類。它們是資料入口，只有帶來源的同時刻觀測才顯示值。

## Vmus與原研究的實際邏輯

1. **Performance Worm**以音樂速度及響度作為坐標，頭部表示當下值，尾跡依時間呈現演奏變化。外形來自資料，不預先指定旋律／和聲的幾何。[1][2]
2. **Vmus分析器**把媒體、節拍標注、波形、頻譜、速度力度曲線及蠕蟲放在共用時間軸，播放與定位聯動。[3]
3. **楊健案例2-1**比較貝多芬第五交響曲第一樂章的具名錄音版本，包含演奏者、錄音年份、唱片、媒體ID、標注ID及版本。[4]
4. 案例腳本`beatModel`使用`BPM = w × 60 / Δt`；`w`是標注拍值，`w=0`是非音樂缺口。平均速度按總拍數／有效時長計算，不能直接平均每拍BPM。
5. `smoothTempo`把原始速度在時間網格上內插，再使用高斯窗；腳本註明`W=2σ`及約`3σ`支持範圍。它是離線處理，不等於本頁的單側因果顯示平滑。
6. 案例2007年力度灰帶是原程式的平滑相對振幅，不能改標成dB SPL、sone或生理百分比。

本輪核對官方幫助、當前`studies/_shared/study.js`、案例資料及公開分析器資源。原始2007年桌面程式和全部音訊處理模組沒有逐行驗證。沒有把Vmus音訊或完整曲庫加入本專案發行包。

## 逐項對應

| 畫面項目 | 實際資料／方法 | 來源與邊界 |
|---|---|---|
| 原始EEG波形 | 收到的`rawEegSamples` | 保留來源單位，不自行改成µV |
| 頻段時間曲線 | 來源回報的頻段值 | 範圍、單位按來源；`_mean`欄位不等於RMS |
| 專注、冥想／放鬆曲線 | 設備／適配器原生指數 | 確認ThinkGear時適用原廠定義[5]；其它適配器不套用相同算法 |
| 神經蠕蟲XY軌跡 | 同一筆有效記錄的雙指數，按時間連線 | 移植時間軌跡方法[1][2]；不是音樂實測或腦區連通圖 |
| 0–127坐標 | `round(index / 100 × 127)` | 可復算的顯示換算；不代表發送MIDI |
| 標準距離 | 有效連續段的時間加權RMS半徑 | 標準距離定義[6]，公式如下；沒有健康或複雜度閾值 |
| 十項音樂卡片 | 同時刻的音樂分析／人工標注 | 缺少源記錄、方法或單位時不生成值 |
| 合成示範 | 公開`demoValues`與`demoSnapshot`函數 | 只測試交互，介面／記錄／摘要保留合成來源 |

## 可復算的統計

只連接同一來源、session、transport、epoch的有效相鄰點。超過3秒、接觸不良或來源切換時斷開。3秒是工程超時，不是生理閾值。

設一個有效直線段端點為`(x0,y0)`、`(x1,y1)`，時長`Δt`：

```text
∫x dt = Δt × (x0+x1)/2
∫y dt = Δt × (y0+y1)/2
∫(x²+y²)dt = Δt × (x0²+x0x1+x1²+y0²+y0y1+y1²)/3
T = 有效連續段時間之和
μx = Σ∫x dt / T，μy = Σ∫y dt / T
SD = sqrt(Σ∫(x²+y²)dt / T − μx² − μy²)
```

`x,y`及SD保持原生指數單位。這是標準距離的連續時間加權實作，不冒充Esri原程式。段內直線是顯示／統計假設，沒有向原始記錄補造樣本。無有效時長則SD缺失；恒定輸入SD=0；均勻直線從0至100時SD=`100/√12`。不再輸出自選半徑0.10的“密集度”或除以√0.5的“離散度”。

預設不平滑。可選因果高斯平滑只使用此前同一連續段資料，僅影響顯示；原始點、記錄和統計不改變。窗口與權重見`worm-model.mjs`，不宣稱完全複製Vmus離線算法。

## 音樂觀測契約

原始封包可附`musicFeatures`，格式為`music-observations-v1`；timestamp為毫秒，需匹配該筆EEG記錄：

```text
musicFeatures = {
  schemaVersion, timestamp,
  values: {
    tempo: {
      value, unit: "BPM",
      source: { id, type, uri, method }
    }
  }
}
```

來源類型只接受`audio-analysis`、`midi-analysis`、`score-annotation`或`human-annotation`。每項需記錄識別、URI、分析方法、值與單位。URI可為HTTP(S)、`urn:sha256:<64位哈希>`或`file-id:<記錄識別>`。页面会显示来源记录和方法，不把来源声明写成独立研究验证。

和聲、調式、曲式、音色及演奏法接受明確標注文字，不生成張力／明亮度百分比。dBFS、dB SPL、sone及MIDI velocity分開保存，不互換。記錄和回放保留音樂源時間、頻段範圍及單位；交接摘要輸出缺失，不生成音樂處方。

交接格式使用`neural-observation-summary-v2`，取代舊的音樂控制提示詞格式；不把舊映射輸出當成新版觀測結果。摘要只統計實際推進的封包，重複封包計數的心跳不增加樣本或改變指數均值。介面座標的小數僅為顯示捨入，JSON及原始樣本保留來源精度。創作方案與音樂觀測分開保存，見[MUSIC-PLANS.md](MUSIC-PLANS.md)。

記錄保留各腦電欄位的`fieldTimestamps`、各其他傳感器的`sensorTimestamps`及原始來源。回放同時平移時鐘並保存原時刻，不將舊字段重新當成新測量。CSV的傳感器數值按相同新鮮度規則輸出；JSON仍保留原始來源值及時鐘供重現。

## 一手來源

1. Dixon, S., Goebl, W., & Widmer, G. (2005). *The “Air Worm”: An interface for real-time manipulation of expressive music performance*. ICMC。[作者研究組全文](https://www.cp.jku.at/research/papers/dixon_icmc_2005.pdf)，Figure 1及§4。
2. Dixon, S. (2003). *On the analysis of musical expression in audio signals*。[作者全文](https://webspace.eecs.qmul.ac.uk/s.e.dixon/pub/2003/spie.pdf)，Performance Worm部分。
3. [Vmus V3幫助](https://v3.vmus.net/help.html?lang=zh#video)。
4. [楊健案例2-1](https://v3.vmus.net/studies/yang2007/#case=2-1&view=tempo)；[當前案例腳本](https://v3.vmus.net/studies/_shared/study.js)。
5. [NeuroSky ThinkGear Serial Stream Protocol](https://developer.neurosky.com/docs/doku.php?id=thinkgear_communications_protocol)，eSense及POOR_SIGNAL。eSense為原廠相對指數，0表示未能可靠計算，不是百分比。
6. [Esri Standard Distance](https://pro.arcgis.com/en/pro-app/latest/tool-reference/spatial-statistics/standard-distance.htm)，二維標準距離定義及公式。
7. Langner, J., & Goebl, W. (2003). *Visualizing Expressive Performance in Tempo—Loudness Space*. Computer Music Journal, 27(4), 69–83。[DOI](https://doi.org/10.1162/014892603322730514)。本輪核對Crossref書目，未標成已取得全文。

這些來源支持時間軌跡、音樂量測或指數定義，不能支持兩個EEG指數決定十大音樂要素。建立該模型仍需要同步音樂／EEG資料、可核對標注、校準及獨立驗證。
