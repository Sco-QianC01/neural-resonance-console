# 腦波頻段與指數

本頁說明「02 波形捕獲」顯示的八條頻段、兩個代理指標，以及它們與設備原生 eSense 指數的關係。所有數值都保留來源與單位；本頁不推導臨床結論，也不把代理指標冒充設備值。

## 1. 資料來源與適用邊界

頁面上並存的數值分屬三個不同層級，產生者不同，不可互相替代：

| 層級 | 內容 | 產生者 | 本頁處理 |
|---|---|---|---|
| 設備頻段值 | 八條頻段的相對功率 | 設備廠商算法（ThinkGear） | 顯示、記錄；不重算 |
| 本頁代理指標 | 參與度 E、相對 Alpha A | 本頁按公開公式由設備頻段值計算 | 計算並標明公式與依據 |
| 設備 eSense | 專注度、放鬆度（0–100） | 廠商未公開算法 | 並列顯示；不重算、不換算 |

適用邊界：

- 本控制台為**單通道前額**採集（FP1 附近），只能描述前額中線與整體節律；**不能**計算左右半球不對稱（FAA）[9]，也不能分離眼動、肌電、心電等偽跡。
- 不做臨床判讀、不做睡眠分期、不對「專注」「放鬆」下操作型定義以外的斷言。
- 缺失值保持 `null`，不插值、不以零代替、不補造遺失時長。
- 頻段值為**相對功率**：廠商未公開歸一化與平滑方式。因此其絕對數值僅在同一設備、同一工作階段內可比；跨設備、跨工作階段、跨韌體版本只能比較同一序列內的相對走勢，不能比較絕對高低。

## 2. 八條頻段

設備按固定八條回報：`delta`、`theta`、`lowAlpha`、`highAlpha`、`lowBeta`、`highBeta`、`lowGamma`、`midGamma`。其中 alpha 與 beta 各拆低／高兩段，其餘四條各一條。

| 頻段 | 定義 | 前額葉解讀 |
|---|---|---|
| Delta · δ | 慢波，深睡（N3）主導，清醒時多為低幅背景。[6] | 清醒時前額 delta 升高多與疲勞、眼動或出汗偽跡相關，不宜單獨當認知指標。 |
| Theta · θ | 困倦與入睡過渡的低頻節律。[2] | 前額中線 theta（Fmθ）與工作記憶、認知控制及錯誤監控相關；升高不必然是「更專注」。[5] |
| Low Alpha（8–10 Hz） | Alpha 的低頻段，放鬆閉眼時最明顯。[2] | 閉眼放鬆時升高，任務投入或注意外放時下降。 |
| High Alpha（10–13 Hz） | Alpha 的高頻段，對警覺變化較敏感。[2] | 與低頻 Alpha 同步升高多見於安靜閉眼；快速下降常先於注意轉向。 |
| Low Beta（13–20 Hz） | Beta 的低頻段，與主動思考、運動準備相關。 | 認知投入或需要維持反應時升高；與 Alpha 常呈反向走勢。 |
| High Beta（20–30 Hz） | Beta 的高頻段，緊張與高負荷時活躍。 | 升高可反映緊張或高負荷，也極易混入額肌肌電，解讀須保守。 |
| Low Gamma（30–40 Hz 量級） | Gamma 的低頻段，與注意及跨區整合相關。[7] | 消費級單通道極易受肌電污染，只宜作趨勢參考。 |
| Mid Gamma（40–50 Hz 量級） | Gamma 的高頻段，信噪比低於低頻段。[7] | 同樣易受肌電影響；僅呈現設備回報值。 |

關於上表的三點限定：

1. 頻率的實際顯示值取自設備回報的 `bandRanges`；表中括號內的數字只用於定義說明，避免與具體設備的分段不一致。
2. Alpha 拆低／高兩段有文獻依據：lower alpha 與 upper alpha 對注意需求與語義作業的反應不同，故分段有意義[2]。Beta 的上下分段屬設備實作，文獻上的功能區分不若 alpha 穩固，故本頁不對 Beta 分段作功能宣稱，兩行描述僅為一般性概括，未對應單一引文。
3. 表中所有「升高／下降」皆指同一序列內的相對變化，不是絕對功率的物理量。

## 3. 由頻段合成代理指標

八條原生頻段先合為四項頻帶功率：α、β 各由低／高兩段相加，θ、δ 各取單條；gamma 兩條不參與合成。

```
α = Low Alpha + High Alpha
β = Low Beta + High Beta
θ = Theta
δ = Delta
```

### 3.1 兩個代理指標

| 指標 | 公式 | 值域 | 依據 |
|---|---|---|---|
| 參與度 E | β / (α + θ) | [0, ∞) | Pope, Bogart & Bartolome (1995)[1] |
| 相對 Alpha A | α / (δ + θ + α + β) | [0, 1] | 本頁自建；解讀依 Klimesch (1999)[2] |

上表為等權（w = 1）的特例。帶權的一般式為：

```
E = wβ·β / (wα·α + wθ·θ)
A = wα·α / (wδ·δ + wθ·θ + wα·α + wβ·β)
```

權重全取 1 是本頁的宣告值，不是廠商參數：廠商權重正是未公開的部分（§4），而由單次同步記錄擬合出的權重也不具跨人、跨設備的可移植性。宣告等權使公式可復算、可證偽，讀者亦可代入其他權重後重算；任何具體權重值都應視為研究假設，而非對 eSense 的還原。

E 沿用 Pope et al. (1995) 的判別結果：在其比較的候選式中，β/(α+θ) 最能反映任務投入。其構造前提是 β 隨警覺與注意上升、α 與 θ 隨之下降，比值因此同時捕捉兩者的反向變化[1]。原研究以閉環正／負反饋驗證候選式，判別任務投入的表現以 β/(α+θ) 最佳；本頁取 60 秒窗屬顯示選擇，不改變公式與尺度。

A 取 alpha 在 δ–β 四項中的佔比。**此比值本身是本頁自建的指標，Klimesch (1999) 並未提出名為 A 的指數**；該文所提供者是解讀：以 alpha 去同步化標識皮質進入作業處理，故 α 佔比下降對應處理負荷上升[2]。分母限於 δ／θ／α／β 四項而不含 gamma，屬相對功率的常見取法，理由見 §3.3。惟 alpha 升高亦可反映對非作業區域的主動抑制，而非單純放鬆[4]；故 A 只宜讀作「相對 Alpha 比重」，不作為放鬆分數。

### 3.2 為何取比值

單一頻段的絕對功率難以區分不同注意水平，頻帶比值的判別力在文獻中較佳（Lubar, 1991；Streitberg et al., 1987，轉引自 Prinzel et al., 2003）[8]。另一約束來自資料本身：本頁頻段值為廠商歸一化的相對功率，絕對量級不可跨設備比較（§1），而 E 與 A 皆為無因次量，可在同一序列內比較走勢。此為方法選擇，不構成對「專注」的操作型定義。

### 3.3 計算規則與值域邊界

- 任一輸入缺失或非有限值 → `null`，曲線斷開；不插值、不以零替代。
- 分母 ≤ 0 → `null`，不輸出 `Infinity` 或 `NaN`。
- 舊記錄或非 TGAM 來源僅有聚合 α／β 時，回退取聚合值，公式與意義不變。
- A 的分母限於 δ+θ+α+β，不含 gamma：gamma 的機能意義雖有文獻支持[7]，惟消費級單通道的 gamma 幅度低，且與額肌肌電難以分離，納入分母將使 A 隨肌電張力漂移。故 A 應讀作「δ–β 四項內的 Alpha 佔比」，非全頻帶佔比。
- 每個面板以左右雙縱軸並置：左軸為代理值（E 為比值、A 為佔比），右軸為 eSense 的 0–100；兩軸不共軸、不換算。

## 4. 與設備 eSense 的關係

代理指標與設備 eSense 以雙縱軸同圖並置，供課堂對照同一窗口內兩組走向是否一致。此並置不構成因果推論、等效換算或校準：

- 廠商算法未公開，任何把 eSense 視為 β/(α+θ) 的推算均無依據。
- E 的效度建立於任務層面的判別（如警覺作業中的衰退、編碼期相對辨識期升高），不表示與任一主觀「專注」評分等值[3]。
- 兩者走向不一時，可能源於算法、平滑與偽跡處理的差異；本頁只呈現差異，不裁決何者為真。

## 5. 參考文獻

編號依「02 波形捕獲」頁面首次引用之順序（Vancouver 式），與頁面完全一致；故本文各節出現的編號不必然遞增。文獻表本身按編號排列。

1. Pope, A. T., Bogart, E. H., & Bartolome, D. S. (1995). Biocybernetic system evaluates indices of operator engagement in automated task. *Biological Psychology*, 40(1–2), 187–195.
2. Klimesch, W. (1999). EEG alpha and theta oscillations reflect cognitive and memory performance: A review and analysis. *Brain Research Reviews*, 29(2–3), 169–195.
3. Berka, C., Levendowski, D. J., Lumicao, M. N., Yau, A., Davis, G., Zivkovic, V. T., Olmstead, R. E., Tremoulet, P. D., & Craven, P. L. (2007). EEG correlates of task engagement and mental workload in vigilance, learning, and memory tasks. *Aviation, Space, and Environmental Medicine*, 78(5 Suppl.), B231–B244.
4. Jensen, O., & Mazaheri, A. (2010). Shaping functional architecture by oscillatory alpha activity: Gating by inhibition. *Frontiers in Human Neuroscience*, 4, 186.
5. Cavanagh, J. F., & Frank, M. J. (2014). Frontal theta as a mechanism for cognitive control. *Trends in Cognitive Sciences*, 18(8), 414–421.
6. Harmony, T. (2013). The functional significance of delta oscillations in cognitive processing. *Frontiers in Integrative Neuroscience*, 7, 83.
7. Jensen, O., Kaiser, J., & Lachaux, J.-P. (2007). Human gamma-frequency oscillations associated with attention and memory. *Trends in Neurosciences*, 30(7), 317–324.
8. Prinzel, L. J., Freeman, F. G., Scerbo, M. W., Mikulka, P. J., & Pope, A. T. (2003). Effects of a psychophysiological system for adaptive automation on performance, workload, and the event-related potential P300 component. *Human Factors*, 45(4), 601–613.
9. Coan, J. A., & Allen, J. J. B. (2004). Frontal EEG asymmetry as a moderator and mediator of emotion. *Biological Psychology*, 67(1–2), 7–50.
