# 数据标注数字输入与统计边界修复 · 2026-10-29

- 目标速度输入 `-` 或 `1e` 时，浏览器会同时返回空值与 `badInput`；现在先拒绝未完成数字，再读取目标，避免把无效输入当成未指定并导出。
- 总体SD与CV改在样本缩放域计算，避免极小正数的平方下溢和次正规数均值舍入污染CV；定义、单位和缺失处理不变。
- 函数入口拒绝稀疏数组空洞，缺失仍须显式使用 `null`。
- 265项JavaScript、26项相关Python、静态构建及原生Edge十条标注操作回归通过；保存恢复保留输入hash、目标与请求，切页保留生成结果。
- 仅修改第四板块及其测试／文档；独立分支候选，未替换main、原8767服务或原生包。[详细记录](PROMPT-BOUNDARIES-20261029.md)。

# 可选脉率标签缺失的启动兼容修复 · 2026-10-29

- 用户在获知遗留启动异常后明确要求检查并排除bug；本次仅修复该处共享更新代码。
- `sensor-pr-label` 已从页面移除，旧更新函数仍直接写入它。改为取节点并判空；标签存在时的来源判断与文字不变。
- 不改采集、波形或蠕虫算法。原保护哈希未重置，校验仅精确认可这两行兼容保护及已记录的第四板块路由。
- 263项JavaScript与26项相关Python测试通过；原生Edge的三个旧入口启动、四页切换及标注导入／下载通过。无设备数据时指数保持缺失、封包为0。
- 独立分支候选，未合并main、替换原8767服务或发布安装包；实体硬件、Mac实机及音乐播放未在本轮验收。[详细边界](STARTUP-CHECK-20261029.md)。

# 01＋02 正式鎖死：基線覆核一致，之後不再動 · 2026-10-27 03:40

- **回報**：「好的，锁死1、2模块哈」。
- **性質**：本輪**沒有改任何程式或頁面**，只做凍結宣告與基線覆核。以下數字是「鎖死當下」的實測值，日後任何一項對不上，就是有人動了凍結區。
- **覆核結果**：

  | 項目 | 凍結基線 | 本輪實測 | 結論 |
  |---|---|---|---|
  | `index.html` 43–113（02 整段）sha256 前 16 位 | `8769e9eeae8ed281` | `8769e9eeae8ed281` | 一字未動 |
  | 02 靜態 id | 14 | 14 | 一致 |
  | 02 運行時 id | 37 | 37 | 一致 |
  | 01 運行時 id（`#view-settings`） | 40 | 40 | 一致 |
  | 截圖 | `freeze-01-baseline.png`／`freeze-02-baseline.png` | 兩檔都在 | 一致 |

  註：靜態 HTML 內 01 段可數到 42 個 `id` 字面量，運行時是 40 —— 有兩個節點在啟動時被取代，**基線一律以運行時 40 為準**，不要拿靜態字面量去比。
- **凍結口徑（重申，與 03:27 那輪相同）**：
  - **01**：`#view-settings` 整段（`#gateway-panel`、`#device-monitor`、`#history-import` 回放、`#tgam-convert`、安裝說明）＋`app.mjs` 的 gateway／設備識別／記錄標識／監看段＋`src/gateway-settings.mjs`＋`device_gateway.py` 的既有行為與文案。
  - **02**：`index.html` 43–113 的 `#view-waveforms` 整段（含 `#band-methods` 方法正文與文獻表）＋`derived-indices.mjs` 全檔＋`drawWaveforms`／`drawComparison`／`COMPARISON_PANELS`＋`app.mjs` 的波形調度段＋`Stream.history`／`snapshot(backfill)` 回填接口。
  - **紀律**：不重排、不改名、不改 DOM id／文案／行為；要讀狀態只**新增**純函式或接口。真必須動，先單獨說明理由並取得同意，不可夾在別的改動裡。
  - **共享檔不算越界**：`waveform-view.mjs` 另有 03 的 `drawWorm`、`app.mjs` 三視圖共用、`style.css`／`planar.css` 全站共用 —— 改 03 動它們的其他部分合法。
- **隨凍結擱置（要改須單獨解凍 02）**：文獻表 `[3]` 把「未與主觀專注評分建立效標關聯」罩在 Berka 名下、`[8]` 省掉「轉引自 Prinzel et al., 2003」。
- **測試**：JS 226/226、Python 90/90、`tools/system-audit-static.py` 0 issues、`git diff --check` 乾淨。
- **不用重啟採集器**（本輪未動任何檔案，只寫記錄）。

# 啟動器補上「打包副本是否過期」檢查，macOS 與 Windows 對等 · 2026-10-27 03:32

- **回報**：「你修改虚线，Start-Windows.cmd，也要更新」。
- **根因（兩處，都會讓原始碼改了而使用者仍跑舊版）**：
  1. `tools/start-macos.sh` 的 `bundle_has_current_eeg_module()` 是一份 **13 個檔的白名單**，其中**沒有** `src/waveform-view.mjs` 與 `src/derived-indices.mjs`。只改這兩個檔時，`.app` 仍被判為「與源一致」，啟動器直接 `open` 打包版 —— 使用者看到的是舊渲染器（沒有 `drawComparison`，更談不上虛線）。
  2. `Start-Windows.cmd` 只要看到 `NeuralResonance\NeuralResonance.exe` 就 `start` 它，**完全跳過** `Start-Windows.ps1` 的 build 標籤校驗。也就是說 ps1 那套檢查在「雙擊 cmd」這條最常見的路徑上根本不會執行。
- **改法**：
  - **macOS**：白名單改為目錄級比較，與 `gateway/package.spec` 的 `datas` 完全對齊 —— `index.html` ＋ `src`／`neural-worm`／`public`／`docs` 四棵樹 ＋ `gateway/config.example.json`；用 `diff -r -q` 並排除 `.DS_Store`／`*.pyc`／`__pycache__`。日後在 `src/` 新增模組不會再被漏掉。
  - **Windows**：`Start-Windows.ps1` 新增 `Test-CurrentAssets`，對同樣五項逐檔比 SHA256（先比檔數、再比雜湊）。只有 build 標籤相符**且**資產全等才動用打包版，否則照既有邏輯回退源碼分支。
  - **`Start-Windows.cmd`**：改為優先 `pwsh -File Start-Windows.ps1`，把校驗交回 ps1；機器上沒有 pwsh 才回退「直接開 exe」，並明說未做比對（不再假裝沒問題）。控制流用 `goto`、不用括號塊 —— 塊內 `%errorlevel%` 在解析時就展開，會吞掉 pwsh 的退出碼。
- **未動凍結區**：`gateway/device_gateway.py`、`runtime_support.py` 的 `BUILD`、`gateway/build-manifest.json` 的 build 標籤一律不動。檔案級比對已足以發現過期；改標籤會連帶影響單實例「沿用舊進程」的判斷，屬 01 鄰近區的既有行為。
- **驗收**：`sh -n tools/start-macos.sh` 通過；`tools/system-audit-static.py` 0 issues（utf8 189／html 10／json 9／python 34／javascript 78）；JS **226/226**；`git diff --check` 乾淨。`diff -r -q -x` 三種情形實測：僅 `.DS_Store` 差異判一致、內容差異判不一致、副本多出檔案判不一致。
- **本機無法驗證的部分**：`Start-Windows.ps1`／`.cmd` 的實際執行（本機無 pwsh），以及 Windows exe 包必須在 Windows 上以 PyInstaller 重打（`package.spec` 明載 native builds must run on the target OS）。`artifacts/desktop/NeuralResonance/` 仍是 10-17 的舊包，不是本輪產物。
- **不用重啟採集器**（未動 gateway 執行期程式）。

# 02 一併凍結；凍結前修掉「原生曲線被畫成實線」 · 2026-10-27 03:27

- **回報**：「也锁死第二个模块。也就是1、2全锁死」；隨後打斷：「等等，02模块，虚线」→「原生的关注度、放松度，应该是虚线。为什么都是实线」。
- **根因（一句話：虛線只畫在圖例，沒畫在曲線上）**：`src/waveform-view.mjs` 的 `drawComparison()` 先畫圖例：第 195 行 `setLineDash([5,3])` 畫虛線樣張，第 198 行 `setLineDash([])` 收尾清掉，第 200 行才開始畫原生曲線。曲線因此是實線。兩條線同色（`panel.colour`），只差線寬 1.5／1.9 與透明度 0.9／1.0 —— 肉眼分不開，等於圖例說謊。這是上一輪改雙縱軸時引入的，當時只驗了「有沒有線」，沒驗線型。
- **改法**：把 `setLineDash([5,3])` 移到原生曲線 `beginPath()` 之前，`stroke()` 之後與 `globalAlpha` 一併復位。圖例樣張照舊只負責示意。另加測試 `the native series is dashed and the proxy series solid, as the legend says`：斷言存在 `dash` 非空且 `width===1.5` 的 stroke，且最後一筆（代理）`dash` 為空 —— 日後誰再把 dash 清早了，這條會紅。
- **02 凍結範圍**（自本輪起與 01 一併凍結）：
  - `index.html` 行 43–113 的 `<section id="view-waveforms">` 整段，**含** `#band-methods` 方法正文與 `.references-section` 文獻表。
  - `src/derived-indices.mjs` 全檔；`src/waveform-view.mjs` 的 `drawWaveforms`／`drawComparison`／`COMPARISON_PANELS`。
  - `neural-worm/app.mjs` 的 `waveKeys`＋`#wave-grid` 建構、`#signal-*` 狀態列更新、`comparisonPanels()` 與繪製調度。
  - `gateway/acquisition.py` 的 `Stream.history`／`snapshot(backfill=True)` 回填接口。
  - **整檔不凍結**：`waveform-view.mjs` 另含 03 的 `drawWorm`／`wormViewport`；`app.mjs` 三視圖共用；`style.css`／`planar.css` 全站共用。改 03 動這些檔的其他部分合法，動到上面的出口才算越界。
- **凍結基線**：靜態 14 個 id、運行時 37 個（8 頻段 × 3 動態 id ＋ 13 靜態）；`index.html` 43–113 段 sha256 前 16 位 `8769e9eeae8ed281`；截圖 `.workbuddy/memory/freeze-02-baseline.png`（1440×1100 繁體全頁）。02 的內部成因另存 `.workbuddy/memory/02-INTERNALS.md`（窗口／回填／回放／代理指標／引文編號），`MEMORY.md` 只留範圍與紀律，以免注入長度超限。
- **隨凍結擱置**：文獻表 `[3]`（「未與主觀專注評分建立效標關聯」罩在 Berka 名下）、`[8]`（頁面省掉「轉引自 Prinzel et al., 2003」）兩處引文歸屬不收緊，要改須單獨解凍 02。
- **驗收**：JS **226/226**（新增線型測試）；`npm run build` 通過；`git diff --check` 乾淨。視覺驗證用「注入 60 點假 history → 同一幀 `canvas.toDataURL()`」取得兩張圖（截圖會被 `app.mjs` 的 rAF 用空 history 重繪抹掉）：實線粗而平滑、虛線分段清晰，圖例樣張與曲線一致。截圖 `.workbuddy/memory/dash-attention.png`／`dash-meditation.png`。
- **不用重啟採集器**（未動 `gateway/`），Cmd+R 重新載入即可。

# 引文順序複核：文獻表 1–9 對齊，§3.1 一處編號誤植 · 2026-10-27 03:06

- **回報**：「底下的引文顺序也对么」。
- **核查方法**：按頁面文本節點順序以腳本抽出所有 `[n]`（避免人工目視漏讀），正文首次出現序列為 `1,2,3,4,5,6,7,8,9`，與 `<ol class="reference-list">` 的九條一一對應。文獻表用瀏覽器原生 `decimal` 編號、條目內無手寫數字，故顯示序號不會與內容錯位。三語（繁／簡／英）各抽一次，序列相同；文獻條目本身在簡中與英文模式下仍為英文原文（不進 `TRANSLATIONS`），符合「參考文獻不翻譯」的既有規範。
- **修正一處**：`docs/BAND-INDICES.md` §3.1 末尾「比值因此同時捕捉兩者的反向變化[8]」——該句講的是 Pope 的構造前提，編號應為 `[1]`；`[8]` 是 Prinzel（比值判別力），屬上一輪重排後的殘留誤植。改後重建 `docs/BAND-INDICES.html`（11409 bytes）。
- **驗收**：`npm test` 225/225；`git diff --check` 乾淨；頁面文獻表由 Playwright 實拍，序號 1–9 連續、無斷號（截圖 `.workbuddy/memory/refs-order.png`）。
- **不用重啟採集器**（未動 `gateway/`），Cmd+R 重新載入即可。
- **待決（已報，未改）**：① 頁面把「頻帶比值之判別力在文獻中較佳」直接掛在 `[8]` 下，省略了 docs 的「（Lubar, 1991；Streitberg et al., 1987，轉引自 Prinzel et al., 2003）」，同一句話兩處嚴謹度不同；② 「E 之效度建立於作業層面之判別，未與主觀專注評分建立效標關聯 [3]」把否定命題一併罩在 Berka 名下，宜將 `[3]` 移到「判別」之後。兩處皆涉及 index.html＋三語詞條，待確認再動。

# 02 方法與邊界複核：公式值域、A 的出處、引文改按首次引用排序 · 2026-10-27 03:05

- **回報**：「好，请再梳理一下，公式之类的都对吧？引文要不要从头开始排序」。
- **核查方法**：把方法區每一條引文往回追到原始摘要——Pope 1995 的 NASA／PubMed 摘要明載「an index constructed according to the formula, beta power/(alpha power + theta power), reflected task engagement best」，E 式無誤。Klimesch 1999 查不到「以 δ／θ／α／β 四項為分母」的規定，該文提供的是 alpha 去同步化的解讀，不是指數本身。
- **改法（四處實質修正）**：
  - **值域**：`E 值域 (0, ∞)` → `[0, ∞)`。β 可為 0，此時 E 合法地等於 0；`(0, ∞)` 與程式碼不符。
  - **A 的出處**：原寫「形式依 Pope 等（1995）[4] 與 Klimesch（1999）[6]」，等於宣稱 Klimesch 給出了 A。改為「E 之形式依 Pope 等（1995）[1]；A 為本頁自建之 α 佔比，分母限 δ–β 四項，其解讀依 Klimesch（1999）[2] 之 α 去同步化論述」。`docs/BAND-INDICES.md` 的依據欄同步改「本頁自建；解讀依 Klimesch (1999)」。
  - **效標關聯那句**：原「E 屬任務層面判別，尚未建立與主觀專注評分之效標關聯 [5]」把「沒有關聯」記在 Berka 2007 頭上，該文正是用任務表現建立效度的。改為「E 之效度建立於作業層面之判別，未與主觀專注評分建立效標關聯 [3]」，並把「α 升高亦可反映主動抑制」的 [4] 保留。
  - **量綱那句**：原「E 與 A 為無因次量，可於同一序列內比較趨勢 [8]」，Prinzel 2003 講的是比值判別力，不是無因次性。改為「取比值可消去共模功率，頻帶比值之判別力在文獻中較佳 [8]，故本頁不採絕對功率；E 與 A 為無因次量，僅宜於同一序列內比較趨勢」——把 [8] 放回它撐得住的位置。
  - **公式小字補齊輸入**：`α = …　β = …` 之後補 `θ = Theta　δ = Delta`，八條頻段對四個量的映射一次講完（γ 兩條不入式）。
- **引文重排**：改按頁面**首次引用**順序編號（Vancouver 式）。舊序是把文獻表按主題排（theta／delta／gamma 在前），但公式卡先引 [4][6]，正文才出現 [1][2][3]，讀者按頁面往下讀會遇到 4→6→5→7→1→2→3。新映射：Pope 4→1、Klimesch 6→2、Berka 5→3、Jensen & Mazaheri 7→4、Cavanagh 1→5、Harmony 2→6、Jensen, Kaiser & Lachaux 3→7、Prinzel 8→8、Coan & Allen 9→9。
  - `index.html` 的 `<ol class="reference-list">` 與 `docs/BAND-INDICES.md` §5 依新號重排；`src/i18n.mjs` 內 5 條含編號的詞條（key／zh-Hans／en 各 27 處）同步。
  - `docs/BAND-INDICES.md` §5 補一句：編號依頁面首次引用順序，故本文各節出現的編號不必然遞增。
- **驗收**：Playwright 逐節讀 `#band-methods` 的 `[n]` 序列，繁中／簡中／英文三語皆為 `123456789`；四檔寬度（1440／1024／430，另計 1680）無橫向溢出，公式兩行主式皆單行；文獻表順序 Pope→Klimesch→Berka→Jensen & Mazaheri→Cavanagh→Harmony→Jensen, Kaiser & Lachaux→Prinzel→Coan。JS **225/225**、`npm run build` 通過、`git diff --check` 乾淨；`docs/BAND-INDICES.html` 重建（11409 bytes）。截圖 `.workbuddy/memory/cite-renumber-1440.png`。
- **不用重啟採集器**（未動 `gateway/`），Cmd+R 重新載入即可。
- **仍未修**：≤760px 的 `#nav-toggle` 固定鈕遮住正文首字（全站既有，需獨立一輪）。

# 02 兩塊指標圖改為「代理 vs 原生」雙縱軸對照 · 2026-10-27 03:03

- **回報**：上一輪把平滑修好後，助手建議「把 E 與 Attention 疊一張、A 與 Meditation 疊一張，各自左右軸、中間不換算」；用戶回覆「试一下」。
- **背景**：原本上方是 PROXY 兩列（比值、佔比），下方是 NATIVE 兩列（0–100）。四條線分在兩張圖、兩套尺度，肉眼比形狀本來就不可能；而且四條線裡只有兩對可比——兩條原生指數彼此幾乎不相關（Attention~Meditation −0.28／−0.09／0.16），α 與 β 卻高度同向（0.77／0.79／0.69）。
- **改法**：
  - `src/waveform-view.mjs`：刪除 `drawDerived()` 與 `drawIndices()`，新增 `COMPARISON_PANELS` 與 `drawComparison(canvas, history, panel, now)`。每塊只畫一個構念：實線＝左軸代理值，虛線＝右軸 eSense 0–100，共用同一條 0–60 秒時間軸。兩條序列各用**自己的量測時鐘**（頻段欄位時刻／eSense 欄位時刻）並各自去重，因此同一讀數的代理與原生落在同一 x。
  - 代理側照舊套 3 秒尾隨平均（設備 eSense 本身就是平滑輸出）；原生側不另加平滑。
  - 軸上限：E 用 `niceCeiling()`；A 改用新增的 `shareCeiling()`（0.1／0.15／0.2／0.3／0.4／0.5／0.6／0.8／1）。原因：A 實測只在 0.10–0.29，固定 0–1 會把曲線壓在圖底 1/5，形狀反而看不出來；階梯選值的半刻度都還能讀（0.00／0.15／0.30）。
  - `index.html`：兩個 section-line 改為「ATTENTION / 專注：代理與原生」「MEDITATION / 放鬆：代理與原生」，右側小字只交代左右軸；boundary-note 重寫為「兩圖各為一組對照…兩軸各自量度、不作換算，線條是否同向起伏只表示一致程度，不代表數值相等」。
  - 畫布圖例（實線＝代理、虛線＝原生）由 canvas 繪製；`translateDocument()` 只走 DOM 文本節點，走不到 canvas，因此圖例文字改由 `app.mjs` 的 `comparisonPanels()` 以 `t()` 解析並按語言快取——否則英文介面下圖例仍是中文，形成混排。
  - 刪除已無用的 `.attention-key`／`.relaxation-key` 兩條 CSS（圖例已移入 canvas）。
- **測試與工具同步**：`tests/derived-indices.test.mjs` 兩條繪圖測試改寫（刻度全在畫布內、左右軸讀數、代理與原生同一 x）；`tests/teacher-revision.test.mjs` 改呼叫 `drawComparison`；`tools/verify-teacher-revision.py` 改讀新的 `dataset.proxy`／`native`／`proxySamples`／`nativeSamples`（`#derived-wave` 只報 engagement＋attention，`#indices-wave` 只報 relativeAlpha＋relaxation）。
- **驗收**：JS **225/225**；`npm run build` 通過；`git diff --check` 乾淨。Playwright 播同一條 68 秒記錄（`unknown-device-eeg-20261018-150218.tgam`），實線與虛線在 Attention 面板同向起伏（−30 s 同步下探、−25 s 同步抬升、−18 s 同步回落），Meditation 面板亦大致同向；1440／1024／430 三檔寬度皆無橫向溢出，圖例與軸標不重疊；繁中與英文各截一張確認無混排。截圖 `.workbuddy/memory/compare-panels-1440.png`。
- **不變的邊界**：兩條線重疊只表示同向，不表示數值相等；Meditation 側仍弱（平滑後 ρ 0.29／0.61／0.59），A 只讀作 α 佔比。
- **需重啟採集器？不需要**——只動 `src/`、`neural-worm/`、`index.html`、`src/i18n.mjs` 與 `docs/`，Cmd+R 即生效。

# 代理指標改為 3 秒尾隨平均：與設備 eSense 同一時間尺度 · 2026-10-27 02:20

- **回報**：「PROXY INDICES / 代理指标跟NATIVE INDICES / 设备原生指数，目前也不像啊。应该是推理换算出来类似才对。」→ 提出「加 ρ 標註／歸一化疊圖／換候選式」三案後，用戶回覆「都不好」。
- **判斷**：三個方案都停在**呈現層**，沒有回答「公式是不是選錯了」。改從資料層查：把三條真實記錄（同日、同一設備，各 52–91 個有效讀數）按測量時刻取點，穷举 7 條文獻式 × 四種平滑方式，結果顯示——**公式沒有選錯，缺的是時間尺度**。
- **實測（秩相關，三條記錄）**：
  - 逐秒瞬時值：β/(α+θ) 對 Attention 為 **0.68／0.44／0.45**；α/(δ+θ+α+β) 對 Meditation 為 **0.18／0.50／0.39**。
  - 加 3 秒**尾隨**平均：Attention **0.89／0.71／0.67**，Meditation **0.29／0.61／0.59**。
  - 對照組皆更低：尾隨 5 s（0.86／0.69／0.67 與 0.28／0.56／0.50）、居中 5 s（0.87／0.55／0.48 與 0.18／0.50／0.46）、EMA α=0.3（0.83／0.70／0.72 與 0.25／0.68／0.48）。居中較差說明設備用的是因果平滑，與實時輸出的行為一致。
  - 先平滑比值優於先平滑功率（3 s 下 Attention 0.89/0.71/0.67 vs 0.88/0.71/0.48；Meditation 0.29/0.61/0.59 vs 0.13/0.50/0.67）。
  - 單頻段本身幾乎不相關（β 對 Attention −0.37／−0.01／−0.24；α 對 Meditation −0.02／0.08／0.23），是**比值**才露出同向——方向沒錯，缺的只是平滑。
- **改法**：
  - `src/derived-indices.mjs`：新增 `PROXY_SMOOTHING_MS = 3000` 與純函式 `trailingMean(points, pick, windowMs)`。按**測量時間**取窗（不是按點數），**尾隨不居中**（實時不可能用到未發生的讀數），缺值處輸出 null 且不入窗。
  - `src/waveform-view.mjs` 的 `drawDerived()`：繪圖改用平滑序列，`dataset[key]` 也改報平滑後的值（頁面右上數字與曲線一致）。順帶把 E 的縱軸上限由「2 的冪」改為 `niceCeiling()`（1／1.5／2／2.5／3／4／5／7.5 × 10^n），刻度標籤按量級取 0／1／2 位小數——原本 2 的冪會把 0.4–0.6 的曲線壓到半個刻度裡。
  - `index.html`：PROXY INDICES 小字改「3 秒滑動平均；公式與依據見下方『方法與邊界』」；boundary-note 補「（3 秒滑動平均）」；「二、方法」新增一段時間尺度說明，寫明窗口、因果性、三條記錄的 ρ 前後對照，以及「窗口更長或居中皆下降，故取 3 秒」，並聲明**平滑只作用於顯示序列，逐秒原始值隨記錄保存**。
  - `src/i18n.mjs`：改 2 條既有詞條、新增 1 條時間尺度段（三語）。
- **驗收**：JS **225/225**（`tests/derived-indices.test.mjs` 新增 1 條：尾隨窗口、缺值、單點）；`npm run build` 通過；`git diff --check` 乾淨。Playwright 播放同一條 68 秒記錄，兩塊圖同時渲染、`dataset.engagement` 為平滑值 0.434（改前 0.394）。截圖 `.workbuddy/memory/indices-smoothed.png`。
- **仍然不同向的部分（不掩蓋）**：Meditation 側即使平滑後最弱的一段也只有 0.29，A 只宜讀作 α 佔比，不是放鬆分數。另：兩條原生指數彼此幾乎不相關（Attention~Meditation −0.28／−0.09／0.16），而 α 與 β 高度同向（0.77／0.79／0.69）——所以「代理對原生」只能一對一檢查，不能期望四條線整體相似。
- **需重啟採集器？不需要**——只改 `src/`、`neural-worm/`、`index.html` 與 `i18n`，Cmd+R 即生效。

# 記錄回放只覆蓋十幾秒：一包一讀數、兩千點上限 · 2026-10-27 01:53

- **回報**：「为什么播放历史记录的时候，只显示0-15s的8条脑波？」
- **根因（用真實檔案實測，不是推測）**：三層疊加，前兩層才是主因。
  1. **匯入時把每個包都標成「新讀數」**。`src/raw-tgam.mjs` 原本把每一幀的所有欄位時刻統一蓋成該幀自己的時刻（`fieldTimestamps: Object.keys(...).map(key=>[key,timestamp])`）。但 TGAM 是 raw 樣本流：raw 開啟時約 512 幀／秒，而 eSense（`0x04/0x05`）與八頻段（`0x83`）每秒才刷新一次——同一個讀數被 512 幀重複攜帶。覆蓋之後，前端「按欄位時刻去重」完全失效，一秒變成 512 個獨立採樣點。實測 68 秒的 `unknown-device-eeg-20261018-150218.tgam`：34965 包，修前有 **34553 個不同的 delta 欄位時刻**（≈每包一個），修後 **92 個**（≈每秒 1.3 個），與設備真實更新率相符。
  2. **歷史只留 2048 點**。`neural-worm/app.mjs` 的 `history.push(...).slice(-2048)` 是給「每秒 1–10 點」的實時流設計的；回放是每包一點，2048 點在記錄時間上只有 **4 秒**（2048×1.95ms），在瀏覽器真實時間上約 **15 秒**（`setTimeout` 有 4ms 下限，每幀被拖到約 7ms）。於是曲線左端永遠停在 15 秒前，60 秒窗口只填了右邊四分之一。
  3. **回放節拍被 4ms 下限拖慢**。`replayNext()` 每幀一個 `setTimeout`，1.95ms 的幀間隔被 clamp 到約 4ms 起跳，68 秒的記錄要播 4 分鐘以上——即使窗口修好，也要等很久才填滿。
- **改法**：
  - `src/raw-tgam.mjs`：不再覆蓋 `fieldTimestamps`，保留解碼器自己記錄的「該欄位最後一次被重送的時刻」（解碼器原本就只在值更新時寫 `lastAt`）。`ts` 仍逐幀遞增，回放時鐘不受影響。
  - `neural-worm/app.mjs`：新增 `readingStamp(snapshot)`——以 `indexSampleKey`（eSense 的原始量測時刻）＋ 頻段時刻（`delta`，回放時優先讀未被平移的 `originalFieldTimestamps`）拼成「讀數鍵」。`ingest` 只在讀數鍵變化時才 `history.push`；重複攜帶同一讀數的幀不再佔用窗口。`slice(-2048)` 保留為防禦（來源若每幀都換時刻仍會截斷），但正常只用到 60–120 點。
  - `neural-worm/app.mjs` 的 `replayNext()`：改為「錨點＋按真實時鐘排空」。`replayAnchor` 記住記錄時刻與 `performance.now()` 的對應，每 50ms 把已到期的幀一次排空（單次上限 2000 幀），68 秒的記錄就播 68 秒。`startReplay`／`pauseReplay`／`stopReplay`／拖動進度條都會清掉錨點重建。
- **驗收（Playwright 實測，68 秒真實記錄）**：
  - 播放 10／20／30／45 秒時，八條頻段曲線各 **10／25／39／60** 點（先前 15 秒就觸及 2048 上限並停住），`#replay-clock` 分別讀 `00:10 / 01:08`、`00:20`、`00:30`、`00:45`——時鐘與真實時間同步，說明回放不再慢放。45 秒時 60 點已鋪滿 −60s～0s 整個窗口。
  - 截圖 `.workbuddy/memory/replay-45s.png`。
  - JS **224/224**（`tests/raw-eeg-session.test.mjs` 新增 1 條：跨 4096-byte chunk 的兩幀，重複讀數的時刻不得前移）；`npm run build` 通過；`git diff --check` 乾淨。
- **需重啟採集器？不需要**——只改 `src/raw-tgam.mjs` 與 `neural-worm/app.mjs`（8767 直接發項目源檔），Cmd+R 重新載入即生效。**已載入過的回放檔案要重新選一次**（舊的解析結果在記憶體裡，仍是每幀一個時刻）。

# 02 公式區簡化：三卡九行併為一卡兩行，權重收進小字 · 2026-10-27 01:42

- **回報**：「可以把这个「黑箱行为对照／代理指标收敛效度检验」的计算公式，弄的简单一点么，这样方便大家在8条脑波之后查看。」→ 提出「一卡兩行」方案後，用戶回覆「好的，请优化」。
- **判斷（先查現狀再改）**：原公式區是三張卡、九行公式 + 一段 340 字說明。真正的冗餘不在字數，而在**把 `wβ = wα = wθ = 1` 印出來**——權重既然全取 1 且非廠商參數，寫成一般式只會讓讀者以為我們解出了某組待擬合權重，與「不可識別」那節的結論相反。也就是說這一處既是排版負擔，也是說服力負擔。
- **改法（頁面）** `index.html` `#band-methods`：
  - 三卡 → 一卡。主式只留兩行大字：`專注代理　E = β / (α + θ)`、`放鬆代理　A = α / (δ + θ + α + β)`。
  - 兩行小字承接必要資訊：①`α = Low Alpha + High Alpha　β = Low Beta + High Beta　γ 不入式：額肌肌電污染。` ②`係數全取 1；E 值域 (0, ∞)，A 值域 [0, 1]；兩者均不與設備 eSense 換算。`
  - 一般式 `E = wβ·β / (wα·α + wθ·θ)`、`A = wα·α / (wδ·δ + wθ·θ + wα·α + wβ·β)` 降為最後一行小字，並保留 Pope 1995 [4]／Klimesch 1999 [6] 出處與「權重全取 1 為本頁宣告值，非廠商參數」。
  - 340 字說明壓成一句，只留下必須留下的效度邊界：`E 屬任務層面判別，尚未建立與主觀專注評分之效標關聯 [5]；A 只讀作 α 佔比，不是放鬆分數 [7]。`
  - **α/β 的合成式明確保留**（不可刪）：只寫兩式的話，讀者會拿單條 `lowAlpha` 當 α 代入，結果差一倍；它是「怎麼算才對」的必要資訊，不是推導。
  - 三塊論證（一、可識別性／二、雙路徑對照／三、邊界條件）一字未刪，順序不變——公式區只負責「配方」，論證留在其後。
- **改法（樣式）** `neural-worm/style.css`：`.formula-grid` 由三欄自動排列改為單欄 `1fr`；`.formula-main` 字級 `clamp(15px,1vw,18px)` → `clamp(16px,1.3vw,21px)`（行數少了，主式可以更大）；卡片內距 `18px 20px 16px` → `20px 22px 18px`，行距 gap 10px → 7px；`.formula-meta` 去掉 `margin-top:auto`（單卡無需撐底）。刪除已成死規則的 `.methods-section h5`（`index.html` 內已無 `<h5>`）。
- **改法（i18n）** `src/i18n.mjs`：刪 11 條隨改版失效的詞條（`頻帶合成 · 四項輸入`、`θ = 1.0 …`、`γ 不進入：…`、`專注度代理 · ATTENTION`、`放鬆度代理 · MEDITATION`、三條公式鍵、兩條 `w…=1` 值域鍵、兩條 `依據…`），新增 5 條三語詞條（兩行主式、兩行小字、一般式行、短 note）。全形空格（U+3000）沿用原文，未引入 HTML 實體。
- **驗收**：
  - Playwright 五檔寬度（1680／1440／1280／900／430）＋ 三語（zh-Hant／zh-Hans／en）：兩行主式**全部單行不換行**（`getClientRects().length = 1`），`document.scrollWidth - innerWidth = 0`，公式卡寬度隨內容區自適應（1680→1392、1440→1152、1280→992、900→648、430→398）。三語文本各自完整（`專注代理`／`专注代理`／`Attention proxy`），無混排。
  - 改後 02 方法區在 1440×1100、zh-Hant 下高度 **706px**（三卡時未留實測值，故不宣稱前後差額；可比較的是行數：九行公式＋340 字說明 → 兩行主式＋三行小字）。
  - JS **223/223**；`npm run build` 通過（`dist/` 重建）；`git diff --check` 乾淨。
- **已知未修**：≤760px 時固定定位的 `#nav-toggle` 仍會壓在滾動上來的內容上（430px 截圖可見其遮住「專注代理」首字）。此為全站既有行為，與本輪改動無關，仍需另立一輪處理。
- **需重啟採集器？不需要**——只改 `index.html`、`style.css` 與 `src/i18n.mjs`；8767 直接發項目源檔，重新載入（Cmd+R）即生效。

# 採集器回填 60 秒聚合緩衝，02 開啟即有完整窗口 · 2026-10-24 12:58

- **回報**：「02 模块，怎么又回到 15s 的监视状态了？」→ 診斷後在三個修法中選 **A（採集器回填）**，用戶回覆「ok a」。
- **根因（先查再改）**：02 的時間窗一直是 60 秒（`app.mjs` 的 `history.filter(p=>p.timestamp>=Date.now()-60000)`、`waveform-view.mjs` 三處 x 軸分母 `60000`、刻度 −60/−45/−30/−15/0），沒有被改回 15 秒。真正的限制在資料來源：`history` 是純前端記憶體，只在 ws 收到包時 push，頁面重載、切換輸入、重連、停止採集都會清空；採集器端 `Stream.raw` 只有 `deque(maxlen=8192)`（512 Hz 下約 16 秒），且只存 raw ADC 樣本，不含頻段與 eSense。所以**頁面開得比採集晚多久，曲線就只有多長**——15 秒是「本頁開了 15 秒」的巧合，不是窗口設定。
- **改法（採集器端）**：`gateway/acquisition.py`
  - `Stream` 新增 `history = deque(maxlen=600)`，只存**聚合採樣**，不存封包日誌。
  - 新增 `_record_history()`：只有當該次 `accept` 帶有 eSense／頻段／訊號品質欄位時才記一點；一點取**合併後**的 `self.fields`（eSense `0x04/0x05` 與頻段 `0x83` 可分包到達，各存一點會得到兩條互相缺值的鋸齒序列）；同一 0.25 秒內重複抵達就**改寫**該點而不新增。點內含 `ts`、`packets`（沿用 `self.frames`，前端 worm 軌跡需要單調遞增的硬體計數）、`attention`／`meditation`／`poorSignal`／`bands`。
  - 新增 `history_payload()`：只回傳 `now` 前 60 秒內的點，並附上**這批點所屬的身份**（`source`／`sessionId`／`transport`／`connectionEpoch`）。
  - `snapshot(cursor, now, backfill=False)`：`backfill=True` 時多帶一個 `history` 鍵；預設不帶，其他呼叫端（`runtime()`、既有測試）行為不變。
  - `_clear_eeg()` 與 `accept()` 的 epoch 分支一併 `history.clear()`：緩衝屬於「一次連線的資料」，換鏈路或 Stop 後不得把上一段接上去。
- **改法（傳輸）**：`gateway/device_gateway.py` 的 `live()` 增加 `backfill` 旗標，**每個 socket 只在第一幀**帶回填，之後的幀與原本一樣小；`session_id` 變更（採集器重建 `Stream`）時重新允許一次。
- **改法（頁面）**：`src/eeg.mjs` 新增 `backfilledSnapshots(payload, now)`，把緩衝點還原成與即時包同構的 snapshot：
  - 這些點**已是過去**，若走 `normalizeSnapshot` 會被 `fieldTimestamps` 的 3 秒新鮮度閘門全部判成過期，故直接以 `ts*1000` 建立，並標 `backfilled:true`、`transportFresh:true`。
  - 沿用即時包的規則：`attention`／`meditation` 必須是 0–100 的整數，且 **0 代表「未計算」→ `valid:false`**；`alpha = lowAlpha + highAlpha`、`beta = lowBeta + highBeta`（與即時路徑同一算法）；`indexSampleKey` 以 `[ts, ts]` 補齊，讓 `drawIndices`／`buildWormTrace` 的去重與分段邏輯照常運作。
  - 超出 60 秒窗或時間在未來的點丟棄；缺值不插補。
  - `neural-worm/app.mjs` 的 `ingest()`：先取出並移除 `packet.history`（避免寫進錄音或留在 `snapshot.raw`），再以**回填自帶的身份**作為本次 identity。若不這樣做，一個 transport 為 `none` 的心跳包會把身份算成 `[...,'none',...]`，下一個真實包立刻清空剛填好的歷史。合併時按 `indexSampleKey` 去重，重連不會疊出重複點。
- **驗收**：
  - `node --check` 全通過；JS **223/223**（新增 `tests/eeg.test.mjs`「a page that opens late is filled from the collector buffer」1 條）。
  - gateway **58/58**（`test_gateway` 新增 3 條：60 秒窗與只在首幀出現、一 tick 一點且合併 eSense 與頻段、`end_connection` 清空緩衝）。
  - 端到端（假採集器 + Playwright，1440×1100，zh-Hant）：先灌 60 點緩衝再連 3 秒即時，02 頁八條頻段曲線 `canvas.dataset.samples` 皆為 **66**，曲線橫跨整個 −60s～0s 畫面（截圖 `.workbuddy/memory/backfill-02.png`）。修正前同一腳本只有 6 點、曲線擠在右端。
  - `npm run build` 通過；`git diff --check` 乾淨。回填負載大小：60 點八頻帶約 5 KB，只在連線第一幀傳一次。
- **需重啟採集器？需要**——動了 `gateway/acquisition.py` 與 `gateway/device_gateway.py`。撰寫本條時 8767 並未在監聽，直接重啟（`Start-macOS.command`／`Neural Resonance.app`）即載入新碼；若舊進程仍在跑，`started_before_sources()` 會以 `gateway/*.py` 的 mtime 判定並拒絕沿用（正在採集時會拒絕）。頁面端只需重新載入。

# 移除全站頁腳的「方法與來源」入口 · 更正 EVIDENCE 的三層表述 · 2026-10-19 21:55

- **回報**：「你看一下 http://127.0.0.1:8767/docs/EVIDENCE.html 這個方法與來源是不是重複了，可以刪除或者優化？」＋「我看 02 波形捕獲 右下角是這個內容 不應該在這個界面」。
- **核對結果（先查再改）**：
  - 該字樣來自 `index.html` 的全站 `footer` 第三個子元素 `<a href="./docs/EVIDENCE.html">方法與來源</a>`，`setView()` 只切換 `#view-*` 的 `hidden`，footer 在三個視圖共用，因此 01／02／03 的右下角都會出現。實測 02 視圖：`body[data-view=waveforms]` 下該連結位於 (1353, 1744)，文字「方法與來源」。
  - 同一目標 `docs/EVIDENCE.html` 另有側欄入口 `aside > details「資料與方法」>「查看來源文件」`（`index.html:35`），全站可見。**兩個入口、兩個名字指向同一份文件，這才是「重複」的實體**。
  - 內容層另有一處重複且**已互相矛盾**：`docs/EVIDENCE.md` §可復算的統計 › 頻段、代理指標與設備指數 寫「波形頁只呈現一層資訊，不再區分黑盒與白盒」，與 02 現行「三層數值（設備頻段值／本頁代理指標／設備原生指數）」的呈現相反；該段與頁內「方法與邊界」模組重複。
- **改法**：
  - `index.html`：刪除 footer 內的「方法與來源」連結，footer 只保留版本字串（`footer p` 本為 `display:none`，故視覺上只剩左下角版本號）。三個視圖同時生效，未加 `body[data-view=…]` 特例。
  - `neural-worm/style.css`：刪除因此失效的 `footer a{font-size:11px}`；`footer p{display:none}` 保留。
  - `docs/EVIDENCE.md` §3.1：改寫為三層表述（頻段值與 Meditation 指數由設備算法產生、代理指標由本系統按公開公式計算、分開座標不互換），並把「詳見 BAND-INDICES」改為「公式、係數與邊界見波形頁內『方法與邊界』模組，完整推導見 BAND-INDICES」；頁首更新行由「2026-10-09，版本0.11.3」改為「2026-10-19，版本0.11.4」。
  - `docs/EVIDENCE.html` 由 `tools/build-method-docs.py` 重建（9711 → 9811 bytes）。
- **未做（另需決定）**：沒有刪除 `docs/EVIDENCE.md/.html` 本體。它仍被 8 處工具與 6 處文檔引用（`tools/build-method-docs.py`、`deploy-planar-worm.ps1`、`system-full-browser.py`、`verify-planar-windows.py`、`README.md`、`DATA-INPUT.md`、`COMPATIBILITY.md`、`NEURAL-WORM.md`、`PROMPT-HANDOFF.md`、`MAPPING.md`、`RELEASE-v0.9/0.10/0.11.md`），刪檔要同步改這些引用，屬獨立一輪。
- **驗收**：`node --check` 全通過；JS 222/222；`npm run build` 通過；`git diff --check` 乾淨。用 Playwright 對 8767 實機（zh-Hant）檢查三個視圖：footer 只剩「NEURAL RESONANCE / v0.11.4」、`links: []`，側欄「查看來源文件」仍在；`curl` 確認 8767 上的 `docs/EVIDENCE.html` 已是新版（9811 bytes，含「三層」與「版本0.11.4」，無「只呈現一層資訊」）。
- **需重啟採集器？不需要**——只改 `index.html`、`style.css` 與 `docs/`；8767 直接發項目源檔，重新載入（Cmd+R）即生效。

# 02 方法文檔移除「5.1 引文使用位置」 · 排版自適應複驗 · 2026-10-19 21:35

- **回報**：「5.1 引文使用位置 可以删除」。另承接上一輪（20:35 條目）的排版自適應與公式放大，該輪在量測階段被中斷，本輪補完驗收。
- **改法**：`docs/BAND-INDICES.md` 刪除 §5.1「引文使用位置」整節（9 行對照表，含 `[1]`–`[9]` 使用位置）。刪除理由：正文各處已就地標註編號（§1 [9]、§2 [1][2][3][6]、§3.1 [4][6][7]、§3.2 [8]、§4 [5]），對照表與正文重複，且每改一句正文就要同步修表，是維護負擔而非資訊。§5 參考文獻九條原樣保留。
- **連帶**：`tools/build-method-docs.py` 重建 `docs/BAND-INDICES.html`（12075 → 10878 bytes，`grep 引文使用位置` 為 0）。其餘七份方法文檔的 HTML 一併重建（內容未變，僅重新序列化）。
- **排版複驗（上一輪遺留）**：Playwright 量測 1680／1440／1280／1024／900／430 六檔寬度，`document.scrollWidth - innerWidth = 0`（無橫向溢出）；四條公式在六檔寬度皆單行不換行（`getClientRects().length = 1`）；公式卡 1680 三欄（456px）、1440 三欄（376px）、1280 兩欄（490px）、900 及以下單欄（648／398px）；`methods-block` 三欄同步降級。
- **已知且未修（非本模組問題）**：≤760px 時固定定位的 `#nav-toggle`（42×42，`left:13px;top:15px`）會壓在滾動上來的內容上，方法區標題首行被遮住一角。此為全站既有行為（01 各區塊同樣），修它要改全站 media query，屬 01 凍結區可見樣式，本輪不動；若要修，另立一輪單獨處理。
- **驗收**：`node --check` 全通過；JS 222/222；`npm run build` 通過；`git diff --check` 乾淨。
- **需重啟採集器？不需要**——只改文檔與其 HTML 產物，未動 `gateway/`，頁面重新載入（Cmd+R）即生效。

# 02「方法與邊界」排版自適應 · 公式獨立放大並帶係數 · 更正英文為 Meditation · 2026-10-19 20:35

- **回報**：三件事——(1) 方法區排版沒有跟頁面做自適應的寬窄；(2) 公式應該單獨拿出來放大、最好含有係數，用來反推 Attention 與 Meditation 兩個度；(3) 要求溯源本地文檔，確認第二個指數究竟是 Attention/Meditation 還是 Relaxation。
- **溯源（本輪先查再改）**：
  - `多模态设备/EEG/神念TGAM套件资料全集-20230904/mindset_communications_protocol.pdf`：目錄與正文均為 **ATTENTION eSense**、**MEDITATION eSense**；CODE 表 `0x04 - ATTENTION eSense (0 to 100)`、`0x05 - MEDITATION eSense (0 to 100)`；C 定義 `PARSER_ATTENTION_CODE 0x04`、`PARSER_MEDITATION_CODE 0x05`。MEDITATION 條目原文作 “mental calmness or relaxation”——**relaxation 只是對 Meditation 的解釋詞，不是欄位名**。
  - `TGAM数据流格式说明_2014.04.24.pdf`：「04 代表专注度Attention」「05 代表放松度Meditation」。
  - 專案內既有文檔 `docs/PLANAR-METHODS.md` 亦早已寫明「Y軸為Meditation（放鬆指數）」。
  - **結論：英文應用 Meditation。上一輪寫成 Relaxation 是錯譯**，本輪更正。
- **改法**：
  - `index.html`：`#band-methods` 重排為「三層數值說明（lead）→ 公式區（三張公式卡）→ 係數與依據 → 一、可識別性／二、雙路徑對照／三、邊界條件（三欄）」。
    - 公式卡改為獨立區塊、等寬大字、帶左邊框面板：`α = 1.0 · Low Alpha + 1.0 · High Alpha`、`β = 1.0 · Low Beta + 1.0 · High Beta`、`θ = 1.0 · Theta　δ = 1.0 · Delta　γ = 0`；`E = wβ·β / (wα·α + wθ·θ)`（wβ = wα = wθ = 1，值域 (0, ∞)）；`A = wα·α / (wδ·δ + wθ·θ + wα·α + wβ·β)`（四項權重皆 1，值域 [0, 1]）。
    - 刪除原「頻段合成：…」段落與兩條公式 bullet（內容已由公式卡承擔），避免同一頁兩份公式。
  - `neural-worm/style.css`：`.methods-grid`／`.formula-grid` 一律 `repeat(auto-fit,minmax(min(100%,340px),1fr))`，寬螢幕三欄、窄螢幕自動降為兩欄或一欄；公式字級 `clamp(15px,1vw,18px)`（隨視窗縮放，最小仍大於正文 11.5px）；移除原 `max-width:82ch` 的固定行寬——那正是「不跟頁面自適應」的來源。
  - `src/i18n.mjs`：新增公式卡、係數說明等 16 條三語詞條；刪除三條隨改版失效的舊詞條；英文 `Relaxation` → **`Meditation`**（含 `放鬆度`、`放鬆指數`、`專注 / 放鬆`、`專注 × 冥想／放鬆`、二維圖軸標等共 12 處）。
  - `tests/i18n.test.mjs`：`t('放鬆度','en')` 斷言由 `Relaxation` 改為 `Meditation`。
  - `docs/BAND-INDICES.md` §3.1：補帶權一般式與「權重全取 1 為宣告值、非廠商參數」說明，並重建 `BAND-INDICES.html`。
- **係數的理由（寫進頁面）**：權重全取 1 是本頁宣告值，不是廠商參數；廠商權重正是「不可識別」的部分，單次同步記錄擬合出的權重也不具跨人、跨設備可移植性。宣告等權使公式可復算、可證偽，讀者亦可改權重重算。這使「帶係數」不落入假精確。
- **凍結區例外（已由用戶指示）**：`放鬆度`／`放鬆指數` 兩個 i18n 英文譯值屬 01 側邊欄可見文案，本次僅改**英文譯值**，未動 01 的 DOM id、結構、行為與繁體文案；單獨在此記錄，不與其他改動混談。
- **驗收**：JS 222/222、`npm run build`、`git diff --check` 乾淨；以 Playwright 在 1680／1280／900／430 四檔寬度截圖檢查（`/tmp/tc-*.png`），無橫向溢出（`scrollWidth == innerWidth`），公式在三檔桌面寬度皆單行不換行。
- **需重啟採集器？不需要**——本輪只改前端靜態文案、樣式、i18n 與 docs；頁面重新載入（Cmd+R）即生效。

# 02「方法與邊界」提升為頁內模組 · 刪除完整文檔外鏈 · 2026-10-19 17:50

- **回報**：「方法與邊界：腦波頻段與指數」原本只是 02「參考文獻」摺疊區裡的一條連結，等於被藏起來；要求拿出來放在「腦波頻段與指數」底下成為模組、論證學理，並刪掉「閱讀完整方法文檔 ↗」外鏈——「就要學理凝練性說明就好」。
- **改法**：
  - `index.html`：新增 `<section class="methods-section" id="band-methods">`，位於「從頻段到指數」之後、「參考文獻」之前。內容＝三層來源對照表（層級／產生者／本頁處理）＋四條凝練學理：為何取比值（絕對功率跨人不可比、比值為無因次量）、計算邊界（缺失斷線不插值、分母非正不出無限大、相對 Alpha 不含 Gamma）、適用邊界（單通道前額、無 FAA、不構成臨床診斷）。
  - 刪除「參考文獻」摺疊區裡指向 `docs/BAND-INDICES.html` 的舊連結（新模組已自帶完整學理，不再需要外跳）；`docs/BAND-INDICES.html` 檔案保留，仍可從文件直連。
  - `neural-worm/style.css`：新增 `methods-section`／`methods-note`／`methods-table` 樣式。
  - `src/i18n.mjs`：同步三語詞條；刪掉隨外鏈而生、隨即孤兒化的 `閱讀完整方法文檔 ↗` 鍵。
- **踩坑（i18n）**：section-line 標籤最初寫成 `METHODS &amp; BOUNDARIES`，`tests/i18n-keys.test.mjs` 的「static markup never renders mixed script」讀的是 **HTML 原始文本**（看到 `&amp;`），而 `translateDocument()` 走的是 **DOM 解碼後**的文本節點（看到 `&`），兩邊永遠對不上，鍵必然匹配失敗。改用 `AND` 寫法（與同級 `FROM BANDS TO INDICES`、`EEG BANDS / Eight Brainwave Bands` 一致），繞開實體歧義。
- **驗收**：JS 222/222（含 i18n 靜態文本與單文本節點兩例）、`npm run build`、`git diff --check` 乾淨。
- **本輪只改 02 前端靜態文案與樣式，未動 01 凍結區，不需要重啟採集器。**

# 01「設備設定」模組凍結 · 2026-10-19 02:35

- **決定**：01 設備設定開發到此為止，**鎖定**。之後開發 02 波形捕獲、03 音樂與神經響應時不再改動此模組。
- **凍結範圍**：
  - `index.html` 的 `<section id="view-settings">` 整段——設備識別、`#gateway-panel`、`#device-monitor`（採集事實監控）、歷史導入回放、TGAM 轉換、採集器安裝說明。
  - `neural-worm/app.mjs` 的 gateway／設備識別／記錄標識／監看段。
  - `src/gateway-settings.mjs`（`cableFor()`／`detectedDevice()`／`derivedDeviceLabel()`／`runtimeSummary()`／`deviceDiagnostic()` 等純函式）。
  - `gateway/device_gateway.py` 的既有行為與文案（`ble_worker`、`recording_label`、`apply_config` 的影響範圍）。
- **紀律**：不重排、不改名、不改寫凍結區的 DOM id、文案與行為。02／03 需要這裡的狀態時，只**新增**接口或純函式，不動既有出口（例如 `state.core`／`state.devices`／`/api/runtime` 的既有欄位）。確有必要改 01 時，單獨說明理由並取得同意，不夾在別的改動裡。
- **凍結基線**：Python 90/90、JavaScript 222/222、`npm run build` 與 `git diff --check` 乾淨；`#view-settings` 內共 40 個 id；全頁截圖 `.workbuddy/memory/freeze-01-baseline.png`（1440×1100，繁體）。三者任一變化即代表凍結區被改動。
- **本輪未改任何行為**，只記錄狀態，故**不需要重啟採集器**。

# 「刷新設備」改為「重新載入」＝頁面 Cmd+R · 2026-10-19 凌晨

- **回報**：「目前采集器仍是较旧的进程，没有刷新端点…」這段提示沒有用；要求按鈕直接做網頁的重新載入（Cmd+R），比伺服器端重掃可靠。
- **取捨**：上一輪把「重整頁面」搬到伺服器端（`POST /api/gateway/refresh` → `restart_bluetooth()`），代價是它依賴一條**只有新進程才有**的路由，於是舊進程上必定失敗，還得再寫一段要人「重開採集器」的文案去解釋失敗。一個補救鍵不該比它要補救的問題更複雜。
- **改法**：
  - `index.html`：按鈕文字 `刷新設備` → `重新載入`，`title` 標明「重新載入本頁，等同 Cmd+R」；面板提示句同步改寫（面板卡住或畫面與設備不同步時按）。
  - `neural-worm/app.mjs`：處理器縮成一行 `()=>location.reload()`；移除 `disabled=Boolean(data.upstream)`——重新載入在任何模式下都安全，不存在需要禁用的狀態。
  - `src/i18n.mjs`：新增 `重新載入` 與按鈕 `title` 兩條；刪掉隨舊按鈕而生的五條（`刷新設備`／`刷新中`／`已重新掃描…`／`刷新未完成`／`目前採集器仍是較舊的進程…`／`正在接收有效資料，未刷新…`）。
  - `POST /api/gateway/refresh` 仍留在後端（可作為不經頁面的無線重啟手段），但**頁面不再呼叫它**。
- **為什麼這樣才對**：重新載入會丟掉本頁這一側的一切——快取清單、串流讀取器、停在舊狀態的狀態列——再從一次新的 `/api/runtime` 重建。**採集進行中按也安全**：錄音在採集器進程裡寫檔，頁面重載不會中斷它。而頁面上沒有任何按鈕能重建採集器的無線模組，所以按鈕不該假裝能做。
- **驗收**（實機 8767，簡體介面）：按鈕讀 `重新加载`；點擊後 `window.__alive` 標記消失（確實是新文件）、面板仍在、**沒有任何 `/api/gateway/refresh` 請求**、無 pageerror。
- **測試**：`tests/i18n.test.mjs` 新增「補救鍵必須是 `location.reload()` 且不得依賴伺服器路由」一例；JS 222/222、Python 90/90、`npm run build` 與 `git diff --check` 乾淨。

# 「刷新設備」老是 405 · 舊進程自動替換 · 2026-10-19 凌晨

- **回報**：按「刷新設備」一直得到「刷新未完成：HTTP 405」，重開採集器也沒用。
- **為什麼是 405 而不是 404**：`create_app()` 最後一條路由是 `add_get("/{path:.*}", static)`——GET 的靜態兜底。舊進程裡沒有 `POST /api/gateway/refresh` 這條路由，所以這個 POST 落到靜態處理器，aiohttp 回 `405 Method Not Allowed` 並附 `Allow: GET,HEAD`。也就是說：**頁面是新的，後端是舊的**。
- **為什麼「重新開啟採集器」沒用**：`main()` 的單實例分支只要 `health.build == BUILD` 就沿用舊進程、只再開一次瀏覽器。而 `BUILD` 是手寫常數 `portable-20261017-eeg-autosave-v1`，連日改動後端它一次都沒變 → 每次雙擊 Start 都「成功」復用了那個跑著舊程式碼的進程。
- **改法一：以檔案時間判定新舊**（`device_gateway.py`）：新增 `newest_source_mtime()` 與 `started_before_sources()`——`runtime.json` 是啟動時寫的，它的 `updatedAt` 就是進程啟動時間（不需要新欄位，舊進程的檔案也適用）；只要 `gateway/*.py` 比它新一秒以上，這個進程就是在跑舊程式碼。
- **改法二：Start 改為「跑磁碟上的程式碼」**：判定為舊進程時呼叫 `replace_stale_instance()`——先讀 `/api/runtime`，**正在採集（`acquisition.running`）則拒絕**（殺掉 worker 會結束會話、下次開始另開一個 .tgam），否則 `SIGTERM` 舊 pid，等鎖釋放、等舊端口不再回應（`wait_until_gone()`，8 秒）才 `run_owned`。不等的話 `run_owned` 會往下一個端口退讓，靜默把控制台搬到 8768，使用者的書籤就指向空了。
- **改法三：文案不再回顯狀態碼**：前端遇 `HTTP 404|405` 直接說「目前採集器仍是較舊的進程，沒有刷新端點；重新開啟採集器（Start-macOS.command／Start-Windows）後再試。」三語同步。
- **驗收**：
  - 同一資料目錄起 A，`touch acquisition.py` 後起 B → B 印 `Replacing stale collector pid 52969 with the current code`，A 退出、B 接管 8791。
  - 不改檔案再起一次 → `Existing independent instance http://127.0.0.1:8791/`，沿用不重啟。
  - 全新進程 8792 → `POST /api/gateway/refresh` 回 `200`（舊進程同一個請求回 `405`，`Allow: GET,HEAD`）。
  - 瀏覽器（實機 8767，攔截成 405）→ 顯示新的重啟指引，按鈕復原、無 pageerror。
- **待辦**：這一輪的程式碼要**重新啟動採集器**才生效；但重啟後就不必再手動找進程了——之後每次改 `gateway/*.py`，雙擊 Start 會自己把舊進程換掉（正在採集時除外，會明確拒絕）。

# 本機採集器狀態不再印位元組數 · 2026-10-19 凌晨

- **回報**：「有效資料 · 0 bytes 依舊是」——即使藍牙在工作，本機採集器狀態的第二行仍是 0；使用者判斷這個字節計數的監控可以直接刪掉。
- **決定**：`deviceDiagnostic()` 在 `state==='receiving'` 時只輸出「有效資料」，**不再附 `bytes` 與 `validPackets`**。這一行的職責是回答「硬體有沒有在工作、沒在工作該做什麼」，而不是累計流量；單次采集的「有效封包」本來就在監看頁，重複一次只是噪音。
- **為什麼不是「把數字修對」**：`bytes` 由各條傳輸各自發布（USB 讀取迴圈、藍牙 notify 累加），只要有一條漏了就是 0——而 0 在一條健康的鏈路上讀起來像「什麼都沒收到」，比不顯示更糟。這種「取決於哪條傳輸恰好有填」的欄位不該上狀態列。
- **保留**：`/api/runtime` 的 `devices.*.bytes` / `validPackets` 仍在（除錯時可確認有無收到通知），只是不再上頁面；`gateway/device_gateway.py` 只有註解跟著改，行為不變。
- **驗收**：實機 8767、只攔 `/api/runtime` 偽造藍牙串流 → `脑电 BLE：有效数据`（無 `0 bytes`、無 `512 数据包`），`runtime-summary` 不變，無 pageerror。JavaScript 221/221。

# 去掉平台標籤 · 「重新掃描」改為真正的「刷新設備」· 刪除多餘的保存鍵 · 2026-10-19 凌晨

- **回報**：① `自動 · 唯一型號匹配 · macOS` 這串不對，採集器也支援 Windows；② 「重新掃描」與「保存設備身份與記錄標識」兩顆鍵好像沒用，問能不能刪或改；③ 頁面刷新確實能解掉藍牙卡住無反應。
- **平台標籤**：`#gateway-platform` 由 `sys.platform` 決定，在任何一台機器上都只會說出「你在哪台主機上」，對跨平台的採集器沒有資訊量。已從 `index.html` 與 `refreshGateway()` 一併移除（`/api/gateway/devices` 仍回傳 `platform`，只是不再上頁面）。
- **「重新掃描」為什麼像沒用**：它的處理器只有 `gatewaySelectionDirty=false; refreshGateway()`——重新 GET 一次 `/api/gateway/devices`。資料沒變時畫面上什麼都不會發生，而真正能救藍牙的是**讓 worker 放下半開連線重建掃描器**，那件事它從來沒做過。
- **改法**（`POST /api/gateway/refresh`，前端按鈕改名「刷新設備」）：
  - 後端呼叫 `acquisition.restart_bluetooth()`（合作式退出 → 新 worker 建新掃描器），與 `apply_config` 共用 `config_lock`，避免兩次重啟互相踩。
  - **守衛**：若 `ble.state === "receiving"`（正在收到有效資料）則拒絕，回 `{"refreshed": false, "reason": "receiving"}`。重啟會結束當前會話、重連時另開一個 `.tgam`，不能落在正在錄的鏈路上；而按鈕要治的「卡住」恰好是**沒有**在收資料的狀態，所以這個守衛不影響用途。前端據此顯示「正在接收有效資料，未刷新；要重新掃描請先停止采集。」
  - 按鈕在請求期間禁用並顯示「刷新中」，`finally` 一律還原，失敗顯示「刷新未完成：HTTP xxx」。
- **「保存設備身份與記錄標識」直接刪除**，理由不是它沒功能，而是它的功能應該即時發生：
  - 記錄標識早在 2026-10-18 就改成自動寫入（空值時填前十位）＋「應用設備名稱」改名，這顆鍵只剩身分那半。
  - 身分那半（USB／BLE 下拉）本來**必須**按這顆鍵才生效——介面讓下拉看起來已經選好，採集器卻還在用舊身分，正是最容易錄錯檔案的地方（「· 尚未保存」標記就是為了補這個洞）。
  - 現在 `change` 即 `POST /api/gateway/config`（`saveIdentity()`），成功後清掉 pin 與標記；失敗則保留「· 尚未保存」並顯示原因。下拉＝決定，沒有第二步。
- **文案**：面板說明補上「藍牙卡住或連不上時按『刷新設備』，採集器會放下連線重新掃描。設備一經選定即時寫入，不需要另按保存。」；命名規範段刪掉最後一句「『保存設備身份與記錄標識』會一次寫入…」。三語同步。
- **死鍵清理**：`保存設備身份與記錄標識`、`身份与记录设备标识已保存，采集器已重新识别设备。`、`重新掃描`（兩處）、`先插上設備並按「重新掃描」…`；新增 `刷新設備`、`刷新中`、`已重新掃描，藍牙會重新連線。`、`刷新未完成`、`正在接收有效資料，未刷新；…`、`設備身份已保存，採集器已重新識別設備。`
- **驗收（實機 8767 + Chromium，僅攔截 POST/GET 以免動到正在用的採集器）**：section 行只剩 `自動 · 唯一型號匹配`；按鈕列為 `開始采集｜啟動 EEG USB｜停止 腦電 BLE｜刷新設備`，`#gateway-save` 數量 0；改選藍牙 → 立刻 POST（`ble.address` 與 `name` 同時寫入，`eeg.deviceId` 保持原值不被半打的名字覆蓋）；刷新成功顯示「已重新掃描，藍牙會重新連線。」，守衛情境顯示「正在接收有效資料，未刷新…」且按鈕復原。無 pageerror。
- **測試**：Python 85/85（新增 `test_refresh_endpoint_rebuilds_the_radio_without_writing_config` 與 `test_refresh_is_refused_while_valid_data_is_arriving`）、JavaScript 221/221（`i18n.test.mjs` 改為斷言 `#gateway-refresh` 帶「刷新設備」、`#gateway-save`／`#gateway-platform` 不存在）。`npm run build`、`git diff --check` 乾淨。
- **注意**：新端點在 `device_gateway.py` 裡，**必須重啟採集器**；否則按「刷新設備」會得到 `HTTP 404`（舊進程沒有這條路由）。
- **回報**：正在用藍牙採集，本機採集器狀態卻顯示「來源 desktop_ble · EEG USB 未識別」，底下的「腦電 BLE：有效資料 · **0 bytes**」。
- **根因一（措辭）**：`refreshRuntime()` 無條件接上 `EEG USB ${brainlink?'已識別':'未識別'}`。USB worker 停用或沒插線時 `ports.brainlink` 是空字串，於是藍牙正常串流時旁邊永遠掛著一句「未識別」——字面為真（沒插線），讀起來卻像故障。同一行還直接把內部傳輸名 `desktop_ble` 印到頁面上。
- **根因二（數字）**：`bytes` / `validPackets` 只有 USB 的讀取迴圈在寫（`stream.status(key, bytes=received, …)`），藍牙 worker **完全沒有發布過這兩個欄位**。所以 `deviceDiagnostic()` 取 `row.bytes ?? 0` 永遠得 0：一條健康的無線鏈路被顯示成「有效資料 · 0 bytes」，而同一列的 USB 卻有真實位元組數。
- **改法**：
  - 新增純函式 `runtimeSummary(state, translate)`（`src/gateway-settings.mjs`）：只為**正在傳輸**的那條鏈路命名——`來源 腦電藍牙` / `來源 腦電 USB`；沒有資料時說「尚未收到有效腦波」；USB 只有在**確實識別到設備**時才補一句 `腦電 USB 已識別`（此時藍牙在串流），「沒插線」不再冒充「未識別」。內部傳輸名不再上頁面。
  - 英文組句補空格（`獨立採集器`＋`運行中` 原本拼成 `Standalone Acquisition ServiceRunning`）。
  - 藍牙 worker 加 `counters`（`bytes` / `packets` / `errors`）：每個 notify 累加 `len(data)`，`valid_frames` 與 `errors` 取各解碼器之和；收到有效幀時即時發布，0.5 秒監看拍再補一次（涵蓋「有位元組但沒有有效幀」的情況）；新連線的 `connected-waiting-data` 先把三項歸零，不沿用上個會話的數字。
- **驗收**：瀏覽器開實機 `8767`，只替換 `/api/runtime` 回應（不動已連上的耳機、不按開始）：
  - 舊行為：`獨立採集器運行中 · 來源 desktop_ble · EEG USB 未識別`
  - 現在（zh-Hans）：`独立采集器运行中 · 来源 脑电蓝牙`；裝置列 `脑电 BLE：有效数据 · 4096 bytes · 512 数据包`
  - 英文：`Standalone Acquisition Service Running · Source EEG Bluetooth`（間距已修）
- **測試**：`BluetoothConnectionTests.test_received_bytes_and_frames_are_published_for_bluetooth`（三幀 → `bytes=18`、`validPackets=3`、`protocolErrors=0`）；`gateway-settings.test.mjs` 新增五例（藍牙不冒充 USB 故障、USB 在藍牙串流時仍具名、USB 會話只命名一次、閒置不命名傳輸、英文間距）。Python 83/83、JavaScript 221/221。
- **注意**：`device_gateway.py` 有改，**必須重啟採集器**才會出現真實位元組數；前端是靜態檔，重新整理即生效。
- **回報**：側欄「有效封包」跟「開始采集／結束采集」不聯動，結束後不清零。
- **根因**：`Stream.frames` 只在 `__init__` 設過一次 0。`_clear_eeg()` 清了 `fields`／`raw`／`protocol_errors`，**偏偏漏了 `frames`**；`accept()` 換來源時同樣只清前四項。於是停止後計數停在最後一個值，再按開始則從上一個會話的總數接著往上走——一個跨會話累加的數字，卻標著「有效封包」。
- **改法**（`gateway/acquisition.py`，兩處）：
  - `_clear_eeg()` 加 `self.frames = 0`：Stop 之後立即回到 0，與同一函式裡已經歸零的 `protocol_errors` 一致。
  - `accept()` 換來源的 `epoch` 分支加 `self.frames = 0`：新連線（含 USB↔藍牙切換）第一包報 1，不會延續舊總數。
  - **`self.sequence` 不動**：那是原始樣本序號，前端拿它當 per-client 游標（`snapshot(cursor)`），歸零會讓每個客戶端重讀整份日誌。
- **驗收（真實採集器 + 真瀏覽器，非只跑單元測試）**：以假 TGAM 串口起一個 8779 採集器，Chromium 開真頁面——開始前 0；執行中 32（狀態 Valid Data）；按停止後 **0**（未修前為 4，見下方敏感度）；再按開始為 **5**（不是 33），證明按會話重新計數。02 頁的 `monitor-packets` 同步為 0。
- **測試**：`StreamTests` 新增兩例（停止歸零且 `rawSequence` 保持單調、換傳輸重設）；`test_lifecycle` 在 worker 收工後斷言 `eegPackets == 0`；`test_portable` 新增端到端一例（經 `/ws/live` 收到 ≥2 包 → `POST /api/gateway/config {"acquisition":{"running":false}}` → 下一個 `transport: none` 的快照必須 `eegPackets == 0`）。**已驗敏感度**：把 `_clear_eeg` 那行拿掉，端到端測試立刻得到 `4 != 0`，`test_lifecycle` 三例全紅。
- **結果**：Python 82/82（原 79）、JavaScript 215/215、`git diff --check` 乾淨。
- **注意**：改了 `device_gateway.py`，**必須重啟採集器**（Python 不會熱更新）。

# 腦電 BLE 連線不穩 · 長駐掃描器 · 即時響應「開始采集」 · 2026-10-19 凌晨

- **回報**：BLE 的啟動與開始采集對設備的響應不穩定，偶爾才連得上。
- **根因一（最關鍵）**：每一輪都 `BleakScanner.discover(timeout=5)`，等於每 5～7 秒**重建一次 CoreBluetooth central manager**。新 manager 剛建立的那幾秒回報不到東西，於是同一個設備會在清單裡「忽然消失」，能不能連上取決於按下去的那一刻掃描是不是熱的。
- **根因二**：識別後待命固定 `sleep(5)`，醒來再掃 5 秒。按下「開始采集」後最多 **10 秒**沒有任何反應，操作者只會再按一次或按停止。
- **根因三**：掃描與連線期間 `running`／停止都無法中斷；連線失敗 2 秒後又用一個全新掃描器重試；而且**沒有「連線中」這個狀態**，`retrying`／`connected-waiting-data` 在前端沒有對應文案，失敗一律顯示成「本次掃描未發現藍牙設備」——明明設備已找到，只是連線出問題。
- **改法**：
  - **長駐掃描器**（`listening_scanner()`，`detection_callback` 累積 `seen`，20 秒新鮮度）。CoreBluetooth 不再重建，peripheral handle 保持有效，匹配下一拍就有；重連時可直接用快取的 `BLEDevice`，不必等它重新廣播。
  - **待命改 0.2 秒一拍**，按下開始的下一拍就進入 `connecting`，不再有 5＋5 秒的空窗。
  - **狀態分相**：`connecting`（正在連接）／`retrying`（連線中斷，自動重試）／`connected-waiting-data`（已連線等資料）各有文案，前端 `bleDiagnostic()` 同步四句新文案（繁簡英）。
  - **指數退避** 1→2→4→8 秒，成功即歸零。CoreBluetooth 需要時間釋放失敗的 peripheral，猛打只會把一次失敗變成一串失敗。
  - **只訂閱一個 notify 特徵**（`notifyUuid` 優先，其次 `ffe1`）。原本會訂閱所有 notify 特徵，多服務設備會送來重複位元組，解碼器報協議錯誤，讓本來正常的鏈路看起來壞掉。
  - **`last_packet` 與 `last_valid` 分開**：20 秒完全沒有資料才重連；有資料但沒有有效幀只報 `invalid-protocol`，不亂斷線（重連治不好協議不對）。
  - **重啟藍牙改為合作式退出**（`ble_halt`）：不再中途 `cancel()` 一個連線嘗試，4 秒後才強制取消——被取消的半開連線正是下一次失敗的來源。
  - **權限探測結果快取**（`ble_permitted`）：探測要開子進程，每次重新指向設備都重探一次是白等的。
- **測試**：新增 `BluetoothConnectionTests` 四例——① 連線失敗後掃描器**只建一次**（`starts == 1`）並重試成功；② 按開始後 **0.4 秒內**進入 `connecting`（用真實計時）；③ 多個 notify 特徵時只訂閱 `ffe1`；④ 已連線但無資料是 `retrying/connect-failed`，**不會**被報成 `waiting/device-not-found`。**已驗敏感度**：把待命 `sleep` 改回 5 秒，②立刻在 0.4 秒內失敗。
- **前端**：`bleDiagnostic()` 新增 `connecting`／`retrying`／`connected-waiting-data` 三支，四句文案三語同步；`tests/gateway-settings.test.mjs` 新增一組斷言（這三種以前都掉進「本次掃描未發現藍牙設備」）。
- **驗收**：Python 79/79（原 75）、JavaScript 215/215（原 214）、`npm run build` 與 `git diff --check` 乾淨；瀏覽器冒煙四種狀態實測為「正在連接藍牙設備 · 稍候／藍牙連線中斷 · 正在自動重試／藍牙已連線 · 但收到的不是 ThinkGear 資料／藍牙已連線 · 等待有效資料」，無 pageerror。
- **注意**：此輪改了 `device_gateway.py`，**必須重啟採集器**。另外，若 USB 同時在串流，藍牙依設計會讓位並顯示「USB 正在傳送 · 藍牙掃描暫停」——那不是連線不穩。


# 藍牙錄音一律落成 unknown-device · 採集器讀錯了配置段 · 2026-10-19 凌晨

- **回報**：藍牙自動連接後，存下來的檔名反而是 `unknown-device`。
- **證據**：兩個同目錄的檔案頭自己說話：
  - `eeg-unknown-device-20261018-233340.tgam` → `"deviceId":"unknown-device","transport":"desktop_ble"`
  - `eeg-HR-S0AA758-20261019-000516.tgam` → `"deviceId":"HR-S0AA758","transport":"usb"`
- **根因**：`ble_worker` 的 `profile = self.config["ble"]`，而取名那行寫的是 `profile.get("deviceId", "")`——**藍牙配置段沒有 `deviceId`**，所以恆為空字串，`safe_device_id("")` 就成了 `unknown-device`。USB 走 `self.config["eeg"]`，所以一直正確。同一台設備兩條路、兩套取值，這才是「藍牙很奇怪」的全部原因。
- **改法**：新增模組級 `recording_label(config, announced)`：已存標識永遠優先（換硬件不改名的既有規則）；只有空或仍是 `unknown-device` 時，才用**連接上的設備名**（前十位）。BLE 傳入掃描到的 `name`，USB 傳入該埠的 `description`，兩條路共用同一函式，不可能再分叉。
- **順帶（這才是「自動連接」的關鍵）**：取名不再依賴瀏覽器。藍牙鏈路可以自己接上，頁面沒開、或停在 02/03 時 `refreshGateway()` 根本不輪詢，前端的自動寫入就不會發生——現在採集器自己就能命名。
- **`unknown-device` 的語義統一**：它是檔名兜底，不是名字。前端原本把 `storedRaw==='unknown-device'` 當成「操作者故意清空」而停止偵測（`eegLabelOff`），與採集器的新行為矛盾；現已刪掉這個分支與 `eegLabelOff` 變數——存成 `unknown-device` 視為「還沒命名」，會重新填上設備名。
- **測試**：新增 `RecordingLabelTests`（已存優先、`unknown-device` 與空值回退、UUID／`n/a` 不當名字）、`BluetoothRecordingTests`（用假 `BleakClient` 跑一次真實 `ble_worker`，斷言落檔名為 `eeg-HR-S0AA758-…`）、`DeviceNameTests`（十字符、尾隨分隔符、識別碼）。**已驗敏感度**：把取值改回 `profile.get("deviceId","")`，該測試立刻得到 `eeg-unknown-device-20261019-001646.tgam`。Python 75/75（原 67）、JavaScript 214/214。
- **瀏覽器冒煙**：新增第七段——採集器只剩 `unknown-device` 時，面板重新填入 `STM32-Virt` 並寫回採集器；七段全綠、無 pageerror。
- **注意**：此輪改了 `device_gateway.py`，**必須重啟採集器**才生效；已開啟的錄音檔不會改名（檔名在第一次寫入時就定了），重啟後新開的藍牙會話才會正確命名。

# 有標識就沿用舊名 · 換設備不自動改名 · 2026-10-18 深夜

- **回報**：藍牙斷了改用 USB COM 口，標識應該**由人自己命名**；不命名就沿用之前的老名字（`HR-S0AA758`），不要自動換成 USB 的名字。
- **根因**：`eegLabelStale` 把「動過設備下拉」當成「要求換名」，之後 `syncDeviceLabel()` 会让已保存的標識讓位給偵測值，若那個值又剛好是我們自己寫過的（`eegLabelWritten`）就還會**自動 POST 改掉採集器裡的檔名**。也就是說：換硬件＝悄悄改檔名，正好發生在操作者最不會注意的時候。
- **改法**：刪掉 `eegLabelStale` 這條路徑。標識與硬件決策徹底分離——`change` 事件只釘住選擇，不再碰標識；`syncDeviceLabel()` 只要採集器裡有標識就直接沿用它，偵測只在標識為空（新裝機）時填一次並寫入。改名只有一條路：改寫輸入框 → 按「應用設備名稱」。
- **狀態行說出落差**：標識與當前設備不同名時追加「目前設備 STM32 Virt，但檔名仍沿用此標識」。既不擅自改名，也不裝作沒這回事；兩者同名時不加任何字。
- **順帶兩處一致性**：
  - `derivedDeviceLabel()` 也認 `ble.enabled`（原本只有徽標認）：藍牙關掉時不再把記憶中的名字當成當前設備，否則「警示」會被一個不存在的設備抵銷掉。
  - 名稱回填順序：下拉清單重建在標識繪製**之後**，所以藍牙剛回到範圍內的那一次刷新只知道位址、不知道名字。`derivedDeviceLabel()`／`detectedDevice()` 現在直接讀本次掃描（`bleCandidates` 按位址查），少一次「先顯示 USB、兩秒後變藍牙」的抖動。
- **文案**：命名規範段改為「……在標識還是空的時候，預設填入該前十位並即時寫入；一旦有了標識就沿用它，換設備（例如藍牙中斷改用 USB）不會自動改名，要改名請改寫後按「應用設備名稱」。」（繁簡英三語同步）。新增 `目前設備`、`但檔名仍沿用此標識`。
- **測試**：新增瀏覽器冒煙 `label-sticky.py` 六段——① 藍牙斷、只剩 USB：欄位仍是 `HR-S0AA758`、徽標 `STM32 Virtual COM Port · USB`、**零 POST**；② 動設備下拉後仍不改名、仍零 POST；③ USB 拔掉、藍牙回來並在接收：警示消失、名字不變；④ 手動改名 `MY-USB-01` 並按鈕後才 POST；⑤ 全部斷開：人名不被覆寫、不被擦掉；⑥ 換一根同型號的線：警示回來、名字仍不動。另有 `label-smoke.py` 的舊斷言（換硬件後重新派生為 `CP2102-USB`）改寫為新規則。JavaScript 214/214、Python 67/67、`git diff --check` 乾淨。
- **真機 8767 實測**：欄位 `HR-S0AA758`、徽標 `設備 · STM32 Virtual COM Port · USB`、狀態行 `已寫入採集器 · 記錄檔名 eeg-HR-S0AA758-<開始時間> · 目前設備 STM32 Virt，但檔名仍沿用此標識`，無 pageerror。

# 側邊徽標漏掉 USB · 未保存身份就顯示「未連接」 · 2026-10-18 深夜

- **回報**：USB 插着，徽標卻說「設備 · 未連接」。查證 `GET /api/gateway/devices`：`devices` 裡確實有 `STM32 Virtual COM Port`（VID 1155／PID 22336），但 `config.eeg.serialNumber` 與 `location` 都是空——操作者用的是「自動 · 唯一型號匹配」。
- **根因**：徽標的 USB 分支只在**保存過身份**（serial／location）時才去找對應列。沒保存就等於「沒有 USB」，於是明明插着線也顯示未連接。當初給藍牙補的唯一匹配回退（`bleCandidates`）沒有同步給 USB，兩邊用了兩套規則。
- **改法**：抽出共用的 `cableFor(devices, profile)`，與採集器 `serial_selection()` 對齊——**保存了身份**就按 serial／location 找；**沒保存**就取 VID/PID 相符的那一台，且**只有唯一一台才算數**（兩台同型號＝歧義，寧可顯示未連接也不猜）。`detectedDevice()` 與 `derivedDeviceLabel()` 都改用它，徽標與標識從此同一套規則。
- **順帶**：藍牙已被關掉時不再把記憶中的名字當成當前設備（`ble.enabled===false` 且非 `receiving` 就不認），否則徽標會宣稱一台不可能在錄音的設備。
- **測試**：新增 `a plugged-in cable is named even before any USB identity is saved`——實機快照資料（STM32 + cu.debug-console 幽靈列）下徽標為 `STM32 Virtual COM Port`、標識為 `STM32 Virt`（十字符）；兩台同型號→皆空；只有幽靈列→空；藍牙關閉→空。JavaScript 214/214、Python 67/67。
- **真機 8767 實測**：徽標 `設備 · STM32 Virtual COM Port · USB`，標識 `HR-S0AA758`，狀態行 `已寫入採集器 · 記錄檔名 eeg-HR-S0AA758-<開始時間>`，無 pageerror。

# 記錄用設備標識：加「應用設備名稱」按鈕 · 側邊顯示完整設備名 · 2026-10-18 深夜

- **新增按鈕**：`#eeg-label-apply`「應用設備名稱」——改寫輸入框後按它，只寫入標識，不動 USB／BLE 身份。沒改寫就不必按：預設值（設備名前十位）在連接後已經自動寫入，這一顆只是「自命名」的出口。
- **按鈕會自己判斷該不該可按**：`paintLabelApply()` 比對正規化後的輸入與採集器現值，相同就 `disabled` 並以 `title` 說明「目前標識已生效」。等於把「已生效／待套用」寫在按鈕狀態上，不必再從文字推測。
- **側邊顯示完整設備名**：新增 `#eeg-detected` 徽標，例如 `設備 · HR-S0AA758 · 藍牙` 或 `設備 · CP2102 USB to UART Bridge Controller · USB`。標識取前十位是為了當檔名，徽標保留**全名**，被截斷的標識不再是唯一可見的資訊。取值集中在新函式 `detectedDevice()`（`src/gateway-settings.mjs`），優先序與 `derivedDeviceLabel()` 一致：正在接收的藍牙 > USB 線 > 唯一識別的藍牙；兩台同名不猜、CoreBluetooth UUID 不當名字、未連接顯示「設備 · 未連接」。
- **提示改指向最近的按鈕**：輸入框打字後若與生效值不同，狀態行追加「按「應用設備名稱」生效」（原本指向遠處的「保存設備身份與記錄標識」）。命名規範段同步：「『記錄用設備標識』預設就是該前十位並即時寫入；要自命名就改寫後按「應用設備名稱」。」
- **i18n**：新增 `應用設備名稱`、`目前標識已生效`、`設備`、`藍牙`、`設備 · 未連接`、`按「應用設備名稱」生效`；刪除已無呼叫端的 `按「保存設備身份與記錄標識」生效`。
- **測試**：`detectedDevice` 七例（USB 全名、接收中藍牙反超、未保存但唯一識別、記憶名稱、兩台不猜、UUID 不當名、全空）。真機 8767 實測：徽標 `設備 · HR-S0AA758 · 藍牙`、按鈕 `disabled=true / title=目前標識已生效`；填入 `MY-LAB-01` 後按鈕啟用、狀態行 `記錄檔名 eeg-MY-LAB-01-<開始時間> · 按「應用設備名稱」生效`，全程無 pageerror。JavaScript 213/213、Python 67/67。

# 記錄用設備標識自動寫入 · 狀態行不再說謊 · 2026-10-18 深夜

- **問題**：標識只填進輸入框（DOM 與本地變數），採集器命名用的是**它自己的** `config.eeg.deviceId`。所以面板寫著「記錄檔名 eeg-HR-S0AA758-<開始時間>」，實際落盤卻是 `eeg-unknown-device-….tgam`——除非操作者另外按一次「保存設備身份與記錄標識」。介面承諾了按鈕沒提過的事。
- **改法**：新增 `autoWriteDeviceLabel()`，識別到設備就把標識 POST 成 `{eeg:{deviceId}}`，不必點擊。`apply_config` 的 `devices_changed` 本來就把 `deviceId` 排除在外，所以寫標識不會重啟工作線程、不會打斷採集。同一個值只嘗試一次，失敗也記住（`eegLabelFailed`），避免採集器沒回應時每 2 秒重打一次。
- **人手命名永不被靜默覆蓋**：只有「空」或「上一次是我們自己寫入的值」（`eegLabelWritten`）才允許自動更新。操作者用按鈕保存過自訂名之後，即使換了硬件，狀態行只說「自動填入 · 按「保存設備身份與記錄標識」才寫入檔名」，不會擅自改掉他的錄音檔名。
- **狀態行只說兩件事**：`已寫入採集器 · 記錄檔名 eeg-X-<開始時間>`（生效中，不管這個名字是自動偵測還是按鈕存的）與 `尚未寫入採集器 · … · 按「保存設備身份與記錄標識」生效`（只是顯示值）。原本分成「已自動寫入」與「已記住設備標識」兩種說法反而誤導——實測回應「是不是還要點一下確認」，因為「已記住」讀起來像「只記在介面上」。輸入框打字後若與生效值不同，追加同一句提示。`已記住設備標識`、`已自動寫入 · 可直接改寫`、`自動填入 · 按「保存設備身份與記錄標識」才寫入檔名` 三條已從 i18n 刪除，不留死鍵。
- **位置事實（免得再被懷疑改錯檔）**：8767 的 `static()` 直接讀 `ROOT / name`（白名單 `index.html`、`src/`、`neural-worm/`、`public/`、`docs/`，`Cache-Control: no-cache`）；專案內沒有 `Neural Resonance.app`，`Start-macOS.command` 必然落到「跑專案 gateway」分支；`dist/` 只是 `npm run build` 的產物，供 8099 預覽與打包，8767 不讀。實測 `curl http://127.0.0.1:8767/neural-worm/app.mjs` 已含新字串，真實面板截圖即為新文案。**驗收基準改為對 8767 截圖，不再只跑 `dist/` + 8123。**
- **新手裝也能命名**：`derivedDeviceLabel()` 新增 `bleCandidates`，在**尚未保存位址**但掃描唯一匹配時就用該設備名。否則第一次開機永遠標籤為空，檔案先落成 `unknown-device`，要等第一次保存才正確。兩台以上同名不猜（`''`），已保存位址仍優先。
- **順手修的 i18n 缺陷**：藍牙下拉的選項文字由 `t()` 產生，而**譯文不是鍵**，`translateDocument()` 只能翻譯鍵，所以語言一切換那些選項就卡在上一個語言（實測：繁體頁面的下拉顯示整句英文，旁邊的 USB 下拉卻是繁體——因為後者每次刷新都重建，前者被 `dataset.signature` 守衛住）。把 `getLanguage()` 併入 signature，語言變更即重建。
- **文案**：命名規範段改為「會自動填入該前十位並即時寫入，不滿意可直接改寫，改寫後按「保存設備身份與記錄標識」生效」（繁簡英三語）。
- **測試**：`derivedDeviceLabel` 新增四例（未保存位址＋唯一匹配、已保存位址優先、兩台不猜、UUID 不當名）；瀏覽器冒煙四段——① 只識別不點擊就已 POST `{'deviceId':'HR-S0AA758'}` 且狀態為「已自動寫入」；② 手改 `MY-LAB-01` 並保存後以按鈕為準；③ 換硬件後人手命名不被覆寫且沒有多餘 POST。JavaScript 212/212。

# 藍牙不再反覆「正在掃描」· 選擇不被「開始采集」重置 · 2026-10-18 深夜

- **症狀一**：按「保存設備身份與記錄標識」後，狀態行一直顯示「3 台藍牙設備 · 正在掃描藍牙設備」，而且每秒反覆。**根因在採集器**：`ble_worker` 每一輪迴圈開頭無條件寫 `state="scanning"`，而上一輪剛寫過 `ready / awaiting-start`；掃描 5 秒、待命 2 秒，於是面板在「已識別」與「正在掃描」之間永遠來回。**改法**（`gateway/device_gateway.py`）：新增 `identified` 標記——一旦唯一匹配成立就不再發布 `scanning`（射頻仍在背景每 5 秒刷新一次附近清單，但那是為了清單，不是為了識別）；匹配數不等於 1 時才把 `identified` 歸零，重新回到 `waiting`＋具體原因。待命沉睡由 2 秒改 5 秒，與掃描週期對齊。操作者讀「正在掃描」＝識別失敗，這個狀態位不能當成進度指示器用。
- **症狀二**：選好藍牙後按「開始采集」，勾選被重置回已保存身份（通常是空的「自動識別」）。**根因在前端**：`refreshGateway()` 每 2 秒把選擇器整個重建，選中值一律由 `data.config.ble.address` 反推；剛點的那台還沒保存、又不在本次掃描結果裡，就被丟掉。**改法**：新增 `gatewayBleChoice`，把「操作者選了但還沒保存」的位址釘住——`null` 表示沒有意見（跟隨已保存身份），`''` 表示刻意清空。重建時 `desired = gatewayBleChoice ?? config.ble.address`；該設備不在本次掃描中時補一個選項，名稱取自 `gatewayBleNames` 記憶而不是裸 CoreBluetooth UUID。保存成功與手動「重新掃描」時釋放釘子，身份回到已保存值。
- **症狀三（同一個毛病的另一半）**：只要動過任何一個下拉選單，`gatewaySelectionDirty` 就讓 `refreshGateway()` **整塊返回**——不只選擇器，連「N 台藍牙設備 · …」這行診斷也一起凍住。操作者在仍在掃描時挑了一台、又沒按保存，那行就永遠停在「正在掃描藍牙設備」，與症狀一看起來一模一樣。**改法**：`rows`／`labels`／`signature` 的計算與 `gatewayBleNames` 快取移到守衛之前，只把兩個選擇器的 DOM 重建放進 `if(!gatewaySelectionDirty)`；診斷行、保存按鈕、提示句每次刷新照常更新。理由：重建選擇器會關掉展開中的選單（所以要停），但診斷行是給人看的狀態，挑完設備的人正是盯著它的人。
- **未保存的選擇要看得出來**：採集器連的是**已保存**位址，沒保存的勾選看著生效、實際不生效。新增 `markPendingBleChoice()`，把該行標成「HR-S0AA758 · 尚未保存」；保存後標記自動消失。標記用 `dataset.base` 暫存原文，同一份清單內改選時先還原，不會疊出第二個「· 尚未保存」。
- **順手補的 i18n**：新增 `尚未保存`（簡「尚未保存」／英 "Not saved yet"），否則該片段會落到不完整的字元對照表，出現繁簡混排。
- **測試**：新增 `BluetoothIdentificationTests`（`gateway/tests/test_gateway.py`）——用即時 `sleep` 替身讓 worker 快速跑多輪，斷言 `scanning` 只出現一次且在第一輪。**已驗證其敏感度**：把守衛拿掉後同一測試得到 2588 ≠ 1。Python 67/67、JavaScript 212/212。
- **瀏覽器冒煙**（`/tmp/ble-picker-smoke.py`）：狀態行 `2 台藍牙設備 · 已識別藍牙設備 · 等待按「開始采集」`（無「正在掃描」）→ 選 `HR-S0AA758` → 開始采集並讓掃描多出一台新設備（觸發重建）→ 選擇仍在且帶「尚未保存」→ 保存後 POST 內容含 `address` 與 `name` → 標記消失 → 手動刷新仍保選擇 → **未保存時換選另一台並離開／回到 01，診斷行照樣更新為「已保存的藍牙身份本次未出現」，選擇仍是 `BrainLink · 尚未保存`**；全程無 pageerror。另回歸 `label-smoke.py`（標識自動填入四段）與 `replay-shot.py`（回放時鐘 00:24 / 00:39）皆通過。
- **待決（本輪不動）**：繁體文案裡「開始**采集**／停止**采集**」與同句的「**採集**器」字形不一致。盤點：`src/i18n.mjs` 27 條繁體鍵、`src/gateway-settings.mjs` 16 處、`index.html` 7 處、`neural-worm/app.mjs` 6 處。建議做法是**只給這 27 條補上顯式 `zh-Hant` 值**（採集），不動鍵名與呼叫端，避免 56 處字串同時變動；`tests/i18n.test.mjs` 現有兩條把「采集已停止」釘成繁體期望值，需同步改為「採集已停止」。

# 記錄用設備標識自動填入 · 不滿意可直接改寫 · 2026-10-18 晚

- **原狀**：欄位永遠空白，只顯示「未設置設備標識，記錄文件名將使用 unknown-device」。採集器明明已經識別出設備，操作者還是得自己另找名字手打——這一欄的用途就是「自動抓取後不滿意再改」。
- **改法**：識別到硬件就把名字前十位填進 `#eeg-device-id`。取值集中在新函式 `derivedDeviceLabel()`（`src/gateway-settings.mjs`）。優先序固定為：**已保存的標識 > 操作者正在輸入的 > 自動識別**。
- **取誰的十位**：藍牙正在 `receiving` 就取藍牙名（記住的線可能沒插，實際寫檔的是耳機）；否則 USB 優先——USB 串流時射頻待命，寫檔的是那條線。適配器沒有描述就用序號；CoreBluetooth UUID 永不當成名稱。
- **改寫與交還**：自己打的字由 `eegLabelEdited` 保護，5 秒輪詢不會蓋掉未保存的輸入；清空欄位＝交還自動識別；在下拉改選硬件時 `eegLabelStale` 讓舊的已保存標識不再權威，自動值重新填入直到再次保存；保存空標識是明確選擇 `unknown-device`，`eegLabelOff` 阻止自動填入又把它蓋回去。
- **界面**：狀態行改為「自動填入 · 可直接改寫 · 記錄檔名 eeg-X-<開始時間>」；命名規範段補一句「『記錄用設備標識』會自動填入該前十位，不滿意可直接改寫」。
- **順手修的 i18n 缺陷**：`translateDocument()` 的屬性翻譯原本只在 `trans !== origVal` 時才寫入。zh-Hant 下譯文往往就等於原文，於是永遠不寫回，placeholder／aria-label／title 會卡在上一種語言（實測：繁體頁面的存檔目錄顯示英文「Leave empty to use EEG Data…」）。改為一律寫入解析後的值，en → 繁 → 簡 → en 四段往返實測正確。
- **測試**：`derivedDeviceLabel` 九例（含藍牙 `receiving` 反超、無描述回退序號、UUID 不當名）；`normalizeDeviceId('CP2102 USB')`／`'V+ iPhone'` 三例；瀏覽器冒煙四段（自動填入／保存值優先／手打不被覆蓋／換硬件重算）。JavaScript 212/212。


# 導入歷史數據改成回放播放器 · 2026-10-18 晚

- **問題**：01 的「導入歷史數據」只有一個檔案選擇器與一行狀態文字，真正能按的播放鍵藏在左側「回放」分頁裡；而那個「暫停」按鈕其實是把 `timer` 清掉，既不回零也不叫「停止」，導入後也沒有任何位置感——看不出檔案多長、播到哪裡。
- **改法**：區塊本身成為播放器 —— 檔案選擇 → 標題列（檔名 · 設備標識 · 樣本數 · 檔案大小）→ 播放／暫停（同一顆按鈕，標籤與 `aria-pressed` 同步）→ 停止（歸零）→ 可拖動進度條 → `mm:ss / mm:ss` 時鐘。左側「回放」分頁只留一句說明與「前往導入記錄」按鈕，避免出現第二套控制。
- **計算集中**：新增 `src/replay-player.mjs`（`replaySpan()`／`replayPosition()`／`formatClock()`／`formatBytes()`），純函式、不碰 DOM，可直接單元測試。時間**截斷不四捨五入**：9.6 秒顯示 `00:09` 而不是 `00:10`，時鐘不能比播放頭先到終點。
- **節流**：播放時每個封包都寫一次 DOM 會與圖表搶主執行緒（TGAM 每秒數百封包），`paintReplay()` 以 200 ms 節流，控制列自己不會掉幀。
- **拖動＝跳躍，不是重跑**：不重放前面全部封包（十萬級樣本會卡死），滾動窗從新位置繼續；停止則清空歷史窗，否則畫面會顯示播放頭還沒到達的資料。
- **封包間隔上限 1 秒**：檔案若有長空隙，傳輸列不會被凍住。
- **CSS 修正**：`.history-import input` 原本是絕對定位加 `opacity:0`，只為了藏起檔案選擇器；新增的進度條同樣是 `input`，會一併被藏掉。改為 `.history-import label input`。
- **檢視切換不再吃掉回放**：`setView()` 原本在進入 01／02 時無條件 `setMode('live')`，只要切換語言或分頁就等於停止回放。改為 `mode==='replay'` 時保留（檔案不是即時串流，它的傳輸列就在 01），只有合成示範仍會被丟掉。
- **語言切換要重繪**：`#history-info` 是「N 個樣本」這類片段即時組出來的句子，`translateDocument()` 只改靜態文本節點，改不回來；`onLanguageChange()` 補一次 `paintReplay(true)`，否則切到簡體仍顯示「80 個樣本 · 32.4 KB」。
- 03 的「匯入記錄」同步接受 `.tgam`／`.jsonl`，與 01 共用同一個 `loadRecording()`。
- 新增 `tests/replay-player.test.mjs`（5 項）：單封包零長度、亂序時間戳取界、越界拖動夾取、時鐘進位、單位換算。`tools/browser-audit.py` 改用 `#replay-play`。JavaScript 測試 211/211。

# 記錄檔名改為 eeg-標識-開始時間 · USB 也取前十位 · 2026-10-18 晚

- **檔名順序**：`<標識>-eeg-<開始時間>.tgam` → **`eeg-<標識>-<開始時間>.tgam`**（例 `eeg-SOA-FA758-20261018-171500.tgam`）。理由：`EEG Data` 一個夾會混存多台設備的會話，`eeg-` 前綴讓同類檔案排在一起，其次是標識分組，時間仍是最後排序鍵。兩處同源改動：前端 `src/eeg-session.mjs` 的 `sessionFileName()`、採集器 `gateway/eeg_recording.py` 的 `EEGSessionStore`，並同步 `src/recording.mjs` 註釋。
- **舊檔仍可讀**：`decodeTgamFile()` 的正則同時接受兩種順序（`current` / `legacy` 命名組），改名前錄下的檔案照樣解析出 `deviceId` 與開始時間，不需要手動改名。
- **USB 標籤同樣取前十位**：`deviceLabel()` 對 `description` 與 `serialNumber`／`location` 都套 `shortDeviceName()`（十字符；截斷若落在分隔符，一併去掉尾隨 `-`／`_`／`.`／空白）。`STM32 Virtual COM Port · 8D7F57775351` → `STM32 Virt · 8D7F577753`，清單行長度與藍牙一致。標籤僅供顯示，匹配用的 `serialNumber`／`location` 原值不動；已保存身份選項也不再顯示整串序號。
- **常數改名**：`BLE_NAME_LIMIT` → `DEVICE_NAME_LIMIT`（舊名保留為別名，藍牙選擇器不必改）。
- **界面規範句同步**：新增「設備名稱取前十個字符，USB 與藍牙一致」，檔名示例改為 `eeg-SOA-FA758-20261018-171500.tgam`；繁簡英三語同步，維持單一文本節點。
- **測試同步**：`tests/eeg-session.test.mjs`、`tests/raw-eeg-session.test.mjs`、`tests/gateway-settings.test.mjs`（USB 標籤三例）、`gateway/tests/test_eeg_recording.py`（`eeg-unknown-device-` 前綴）。

# 藍牙名稱取前十位 · 命名規範上移 · 2026-10-18 晚

- 藍牙身份顯示與保存一律取廣播名前 10 位（`shortDeviceName()`）：`HR-S0AA758` 原樣保留；`BrainLink-Lite-2024` → `BrainLink`（截斷若落在分隔符，一併去掉尾隨的 `-`／`_`／`.`）；若該欄位意外是 CoreBluetooth 識別碼（`^[0-9a-f]{8}-`）一律視為無名稱，不會被截成半個 UUID。完整地址仍存在 `ble.address`，供匹配與 tooltip 使用。
- 命名規範段落由面板末尾上移至「記錄用設備標識」輸入框之前：先讀規則再填寫，不再出現「填完才看到規範」。段落維持單一文本節點（供 TreeWalker 整句翻譯）。
- 測試：`shortDeviceName` 覆蓋原樣、含空白、超長含分隔符、手機名、UUID 五種輸入；JavaScript 206/206、Python 66/66。

# 開始采集不再丟失藍牙身份 · 停止即停止 · 2026-10-18 晚

- 根因：`apply_config()` 只要配置有任何差異（包含 `acquisition.running`、`ble.address`）就 `stop() → 換新 Stream → start()`。Stream 一換，`candidates`／`nearby` 全被清空，面板上的藍牙身份在按下「開始采集」的瞬間消失；每次切換還要重新掃描 5 秒，這就是「識別不穩定」。
- 改法：只有 `eeg`／`bloodOxygen`／`gsr` 身份變更才重建 Stream；其餘只更新 config，藍牙改走 `Acquisition.restart_bluetooth()` 增刪或重指任務，Stream 與已發現設備保留。`ble.name` 不算身份變更，改個顯示名不會重啟射頻。
- 停止即停止：`serial_worker` 的讀取迴圈與 `ble_worker` 的已連線迴圈原本只檢查 `stop_event`，沒有檢查 `running` —— 按「停止采集」既不斷開 USB 也不斷開 BLE，還會繼續寫記錄檔。兩處都補 `if not self.running: break`。
- 狀態語義：`/api/runtime` 新增 `acquisition.running`；`#device-status` 與側欄 `#status` 改由 `acquisitionHeadline()` 產生，停止時顯示「采集已停止」，不再把「已識別，等待開始」誤報成「等待腦電設備」。`liveAcquisitionStatus(...,{running:false})` 直接回 `stopped`（快照會快取上一包，不能當成正在採集）。
- 選擇器穩定性：`refreshGateway()` 每 2 秒輪詢，原本每次都 `replaceChildren` 重建下拉，展開中的選單會被重建。現以 `name|address` 簽名校驗，只有候選真的變化才重建。
- 新增測試：開始／停止不更換 Stream 且保留 `candidates`／`nearby`；`runtime` 回報 `running`；藍牙開關不更換 Stream 並記為 `disabled`；停止時狀態為 `stopped`。JavaScript 205/205、Python 66/66。

# 藍牙身份與顯示修正 · 2026-10-18 晚

- 藍牙清單不再把 CoreBluetooth UUID 當設備名顯示：預設只顯示廣播名，UUID 收進 tooltip；只有兩台同名時才補 8 位前綴區分。現場實測兩台具名設備為 `HR-S0AA758`（81BD5162-…）與 `V+ iPhone 15 Plus`，`matched` 只含前者。
- `ble.name` 納入配置（`config.example.json` 加 `"name": ""`，`validate_config` 檢型別與長度）：保存身份時一併記住名稱，設備關機未掃到時顯示「HR-S0AA758 · 已保存身份」，而不是「已保存身份 · 本次掃描未發現」或裸 UUID。
- 修正「已記住設備標識 · unknown-device」的錯誤陳述：`unknown-device` 是檔名回退值，不是操作者輸入的標識。狀態行改回「未設置設備標識，記錄文件名將使用 unknown-device」，`eegDeviceId` 同步存空字串（`refreshGateway` 與 `gateway-save` 兩處）。
- 靜態文案補詞條：01 面板「設備會自動識別…請先停掉 USB」與「等待設備連接」原本不在詞表，簡體模式逐字回退成「才会开啟已识别的連线／讓藍牙暂停掃描」。新增測試掃描 `index.html` 全部文本節點，凡退回字表就會混排者一律報錯。
- 「記錄檔名」統一為「記錄文件名」，與命名規範句一致（詞條與四處呼叫同步）。JavaScript 測試 203/203，Python 測試 63/63。

# 藍牙查不到的真因 · TCC 中止 · 2026-10-18

- 查清「怎麼查不到這個藍牙」：macOS 26 對未在 Info.plist 聲明 `NSBluetoothAlwaysUsageDescription` 的**責任進程**觸發 TCC 保護，不是回傳錯誤，而是直接 `SIGABRT` 結束進程。崩潰報告原文：`This app has crashed because it attempted to access privacy-sensitive data without a usage description`，堆疊為 `__TCC_CRASHING_DUE_TO_PRIVACY_VIOLATION__`。也就是說：一按「啟動 腦電 BLE」，採集器整個被系統殺掉，掃描結果永遠是空的；先前「選單卡住／01 不能點」也與此同源。
- 修正：新增子進程能力探測 `bluetooth_permitted()`（原始碼模式用 `-c`，凍結包用 `--bluetooth-probe` 自重入）。被拒時 `ble_worker` 不再嘗試掃描，改為 `state="blocked"`、`reason="bluetooth-permission"` 並等待，**採集器存活**。實測啟用後連續 20 秒 `alive=True`、狀態穩定為 `blocked`。
- 面板不再只給空清單：`GET /api/gateway/devices` 新增 `bleNearby`（本次掃描所有有名稱的設備）與 `bleStatus`（state／reason／message／scanned），01 模組新增一行藍牙狀態與「自動識別相容設備（清除已保存身份）」選項，可直接改選附近設備、或清掉失效的舊身份。
- 保存的 BLE 身份維持嚴格匹配（不會因為同名就換一台設備採集），但「已保存身份 · 本次掃描未發現」與「附近有 N 台但名稱不符」現在分開表述，不再都顯示成「未發現目標設備」。
- 繁簡混排根治：`deviceDiagnostic()` 增加 `translate` 參數，句子改由 `t()` 逐段組裝；原本 `系統未授權藍牙訪問；授權後重新啟動藍牙采集` 不在詞表，簡體模式逐字回退成「授權後重新啟动」。同時把 14 條設備診斷語句、4 個標籤、`有效資料`／`封包`／`等待` 全部登記為詞條。
- 新增兩條回歸測試：`gateway-settings.mjs` 內所有會寫進 DOM 的診斷語句必須存在於 `TRANSLATIONS`；命名規範段落直接從 `index.html` 讀出再比對詞表，避免頁面與詞表漂移。JavaScript 測試 202/202，Python 測試 62/62。
- 命名規範按使用者原話統一為「僅保留英文字母、數字、點、下划线与连字号…最長 64 個字符…記錄文件名為」，繁簡英三語同步。

# 02 波形頁重構 · 2026-10-17

- 02 頁改為教學敘事：八條原生腦波頻段的定義與前額葉解讀 → 60 秒可視化 → 由公開公式推出參與度β/(α+θ)與相對Alpha α/(δ+θ+α+β)，再與設備原生專注／放鬆指數分開座標對照。
- 移除黑盒／白盒分析層級切換、RAW EEG 原始波形區、以及「保存波形 PNG／保存透明遮罩／匯出 CSV」三個按鈕。
- 新增[腦波頻段與指數](BAND-INDICES.md)方法文檔，列明公式、缺失值規則、單通道邊界與六條參考文獻。
- 代理指標缺失值一律回傳`null`並斷線，分母為零不回傳無限大；不與廠商 eSense 換算。
- 示範資料補齊八條原生頻段，使預設示範與真實設備一致。
- 移除不再使用的`src/raw-waveform.mjs`及其測試；記錄、回放與`.tgam`歸檔未變。
- 01# 凍結範圍未改：設備連接、即時採集、目錄授權、歷史導入／回放、`.tgam`容器與 JSON／CSV 導出均維持原狀。

# 02 學理部分重寫 · 2026-10-18

- 重寫[腦波頻段與指數](BAND-INDICES.md)：新增三層來源對照（設備頻段值／本頁代理指標／設備 eSense）、相對功率的跨設備不可比說明、alpha 分段有文獻依據而 beta 分段屬設備實作的區分，以及「A 的分母不含 gamma」對指標意義的後果。
- 文檔補上引文使用位置索引（[2] 補至 FAA 邊界句）；參與度 E 的範圍改記為「無上界，文獻實測區間待核」，不再給未標口徑的 0.1–3。
- 頁面公式塊補`θ = Theta　δ = Delta（γ 不進入合計）`一行，使頁面與文檔的合計定義一致。
- 修正代理指標面板：左邊距由 58 改為 42，與其下方原生指數圖共用同一 0–60 秒 x 軸；刻度文字由 `toPrecision(3)`（1.00／0.500／0.00）改為一位小數（1.0／0.5／0.0），並把最後一個刻度收進畫布內，不再被裁切。
- 頻段卡片的當前值改為兩位小數（原本直接輸出裝置浮點全精度，如`21.250360276036833`）；頻段圖縱軸刻度改為三位有效數字後去除尾零（32／24／16／8／0，不再混用 32.00 與 8.000）。
- 新增回歸測試：兩行共 8 個刻度文字全部落在畫布內、刻度格式為一位小數、曲線 x 座標與`drawIndices`同一映射。JavaScript 測試 191/191。

# 02 推導段重寫 · 2026-10-18

- §3 由五小節壓為三小節（3.1 兩個代理指標／3.2 為何取比值／3.3 計算規則與值域邊界），改為學術敘述，公式以等寬塊呈現、命題以正文呈現、層級以標題呈現。
- 依原始文獻補強推導鏈：E 沿用 Pope et al.(1995) 在候選定義中判別最佳的 β/(α+θ)，並記明原研究為 40 秒窗、每 2 秒更新，本頁 60 秒窗屬顯示選擇；「為何取比值而非單一頻段」改引 Prinzel et al.(2003) 及其轉引的 Lubar(1991)、Streitberg et al.(1987)。
- 新增 `[6] Jensen & Mazaheri (2010)` 作為 A 的解釋限制：alpha 升高亦可為對非作業區域的主動抑制，故 A 只讀作「相對 Alpha 比重」，不作為放鬆分數。
- 新增 `[1] Berka et al. (2007)` 說明 E 的效度建立於任務層面判別，不與主觀「專注」評分等值。
- 參考文獻由 6 條增至 9 條，改依 APA 字母序排列並全面重編號（[1]–[9]）；頁面參考文獻清單同步為 9 條。

# 02 三語覆蓋修正 · 2026-10-18

- 更正：使用者所指的「三種」是主頁的簡體／繁體／英文三語切換，不是三種字體層級。經逐條核對，02 頁新增的 40 條文案（八條頻段的名稱、定義、前額葉解讀，以及導語、區段標題、公式三行、邊界說明、文獻標題與文檔連結）在 `src/i18n.mjs` 中均具備 `zh-Hans` 與 `en` 欄位。
- 修正一處漏譯：`#wave-units` 徽章直接輸出 `bandUnits` 原始字串，繞過翻譯；示範模式下顯示為「合成示範相對值」。現改為顯示時套用 `t()`，並補「合成示範相對值」「來源頻段值 · 單位未回報」兩條詞條。設備或採集器自帶的單位標籤（如 `ThinkGear relative power`）仍原樣輸出，不被翻譯。
- 未三語化的部分屬既有規定：九條參考文獻條目保留英文原文；[腦波頻段與指數](BAND-INDICES.html)方法文檔為繁體單語（交付一律繁體）。

# 02 側欄改為設備狀態讀數 · 2026-10-18

- 02# 波形捕獲的側欄左下角改為與 01# 鎖死態一致：標籤固定為「設備狀態」，徽章為「EEG」，專注度／放鬆度與有效封包顯示「—」，資料狀態顯示「等待 / 暫停」，說明句為「等待真實 EEG 設備連接；示範與回放已停止。」。
- 改動機制：原本只對 `settings` 視圖生效的六條 `body[data-view="settings"]` CSS 鎖死規則（隱藏 tabs、三檔輸入面板、capture、details）改為全站生效；`setView` 的強制 live 判斷由 `settings` 擴到 `settings || waveforms`；`initialize` 對 `#waveforms` 直接載入也強制 live，堵住預設示範偷跑。
- 移除側欄的「示範／實時／回放」三檔與兩條滑杆、以及「開始記錄／匯出 JSON」；資料源切換改由 03# 面板內的「資料入口」列（實時／回放／示範）獨立承擔，側欄不再重複。
- 02 無資料時新增空態說明「尚未接入 EEG 裝置：八條頻段與兩個代理指標等待真實資料，連接請前往 01 設備設定。」；單位徽章空值由空白改為「—」。
- 已知副作用：02 不再有記錄入口，錄製須走 03# 工具列；WebSocket 網址輸入框隨 live 面板一併隱藏，手填位址須改走 01# 或既有設定端點；由 03 切到 02 會 `stop()` 正在跑的示範／回放。
- 同步修訂 `tools/verify-device-status.py` 與 `tools/browser-audit.py`：側欄隱藏控件改為腳本化 `.click()`，並改斷言等待態而非示範資料。JavaScript 測試 191/191。

# 識別不等於開始 · 移除示範入口 · 修正按鈕標籤繁簡 · 2026-10-18

- **自動識別後不再自動開始**：`config.example.json` 新增 `acquisition.running`（預設 `false`）。`serial_worker()` 與 `ble_worker()` 仍持續列舉埠與掃描藍牙並發布候選（識別照舊），但**未按下「開始采集」前不會開啟任何連線**；狀態為 `已識別，等待开始`（reason `awaiting-start`）。停止時亦回到此狀態，不再自動重連。
- `validate_config()` 校驗 `acquisition.running` 必須為布林值；`Acquisition.running` 以屬性讀取配置。介面新增 `#gateway-run`（開始采集／停止采集），儲存目錄未就緒時停用。
- **測試須顯式選擇開始**：`test_lifecycle`、`test_portable`、`test_audit`、`test_eeg_recording` 的採集夾具補上 `{"acquisition": {"running": True}}`，與操作者行為一致；未補時工作執行緒停在等待狀態，`test_lifecycle` 會無限等待。gateway Python 測試 60/60。
- **按鈕標籤改為整句詞條**：原先以 `` `停止 ${...}` `` 拼接後整串丟給 `t()`，該字串從未存在於詞表，必然退回不完整的 `toSimplified()` 字級映射（`動→动` 有映射、`啟→启` 無，於是輸出「啟动」）。現改為四個完整詞條：停止／啟動 × EEG USB／腦電 BLE。
- **不再以殘缺示範資料執行**：`public/config.json` 的 `startupMode` 由 `demo` 改為 `live`；03# 研究面板的「資料入口」移除「示範」按鈕；`selectInput()` 對 `demo` 直接返回，合成資料無法再從介面啟動。`tools/serve.mjs` 啟動時明確列印「Preview only — no device service」並指向 `http://127.0.0.1:8767/`，避免被誤認為第二個可用控制台。
- JavaScript 測試 199/199、gateway Python 測試 60/60。

# 修復：面板命名與顯示的四处問題 · 2026-10-18

- **BLE 已保存身份不再顯示裸識別碼**：`refreshGateway()` 原以 `data.config.ble.address`（macOS 的 UUID 形式，如 `81BD5162-0685-EF0B-…`）作為選項標籤，看起來像一個裝置名稱。改為「**已保存身份 · 本次掃描未發現**」，並把實際位址放進選項的 `title`（懸停可見），讓選項表達的是狀態而非識別碼。
- **`unknown-device` 不再被當成已保存的標識顯示**：`unknown-device` 是檔名回退值，不是使用者輸入的標識。`initialize()`、`refreshGateway()` 與 `gateway-save` 三處在正規化結果為 `unknown-device` 時都讓輸入框維持空白，`localStorage` 亦存空字串；狀態行另以「未設置設備標識，記錄檔名將使用 unknown-device」說明。
- **兩處硬編碼繁體未經 `t()`**：`new Option('自動 · 唯一型號匹配')` 與 `new Option('自動識別唯一相容設備')` 直接寫死繁體字串，簡體介面下會混入繁體。已包上 `t()`。
- **命名規範段落簡繁混排的真正成因**：`translateDocument()` 以 TreeWalker **逐個文字節點**翻譯，段落內嵌 `<code>` 會把整句切成數段，每段都匹配不到整句詞條，因而各自退回不完整的 `toSimplified()` 字級轉換 —— `底線→底线`、`連續字元→連续字元` 這類錯誤詞與混排正是這樣產生的。已移除段落內的 `<code>`（改用「」），使整句成為單一文本節點並與詞條逐字對齊。
- **防回歸**：`tests/i18n-keys.test.mjs` 新增兩條 —— (1) 斷言 `gateway-hint`／`band-intro`／`boundary-note` 段落內不含行內元素；(2) 斷言命名規範整句在 zh-Hans 下含「下划线」且不含任何殘留繁體字，en 下含 `underscore`。JavaScript 測試 199/199。


# 修復：i18n key 與呼叫端不同步導致簡繁混排 · 2026-10-18

- **症狀**：01# 採集器區塊狀態列顯示「按 USB 身份识别；COM 号或 macOS 设备**路徑**改变**後**自动**重連**。」—— 同一句裡簡體與繁體混排。
- **根因**：`t()` 在查不到 key 時**不報錯**，改以 `toSimplified()` 就地轉換；而該字表並不完整，`路/後/連` 等字未被覆蓋，於是輸出簡繁混排。本輪更新中性化文案時只改了 `src/i18n.mjs` 的 key，漏改 `app.mjs:620` 的呼叫端字串，兩邊就此脫鉤。
- **修復**：`app.mjs:620` 改為新 key；`app.mjs` 另有兩處硬編碼中文未經 `t()`（保存成功提示、設備清單不可用、轉換完成／失敗），一併補上詞條與包裝。
- **防回歸**：新增 `tests/i18n-keys.test.mjs`，掃描 `app.mjs` 內所有 `t('…')` 字面量，斷言每一個都存在於 `TRANSLATIONS`；另以一個測試鎖定上述失效型別（缺 key 時 `toSimplified()` 會留下繁體字），以及平台中性文案在三語下皆可解析。掃描同時抓出既有遺漏 `轉換完成`／`轉換失敗` 兩個 key，已補齊。JavaScript 測試 197/197。
- 註：01# 採集器設備識別區塊為設備識別、保存目錄、記錄標識與各通路啟停的唯一入口，**不得刪除**；後續僅做呈現層優化。

# 記錄設備標識：單一命名規範 · 保存一鍵寫入 · 2026-10-18

- **兩套規則合一**：後端 `safe_device_id()` 一直是「規範化」（把非法字元併為連字號），前端卻是「拒絕」（不符合正則就報錯中止）。同一個標識在兩端規則不同，會出現前端放行、後端卻改名，或前端擋下後端其實能處理的輸入。現以 `gateway/eeg_recording.py` 的行為為準，於 `src/recording.mjs` 新增 `normalizeDeviceId()` 與 `deviceIdNeedsNormalizing()`，前端改為規範化而非拒絕。
- **規範寫進介面**：採集器區塊明列規則與檔名樣式 —— 僅保留英文字母、數字、點、底線、連字號；其餘連續字元合併為單一連字號；去除首尾的 `-._`；最長 64 字元；留空為 `unknown-device`。記錄檔名為 `<標識>-eeg-<開始時間>[-NN].tgam`（檔名順序同日晚間改為 `eeg-<標識>-<開始時間>`，見上）。
- **輸入即預覽**：`#eeg-device-id` 監聽 `input`，即時顯示正規化後的標識與將產生的檔名（例如 `SOA FA758` → `eeg-SOA-FA758-<開始時間>`），不必背誦規則。
- **保存按鈕語意明確化**：`#gateway-save` 文字由「保存設備身份」改為「**保存設備身份與記錄標識**」，並在說明中指明它一次寫入 USB／BLE 身份與此標識；保存後同步寫入 `localStorage` 並回填正規化後的值。
- 新增 `tests/device-naming.test.mjs`（已加入 `npm test` 序列）：九組案例直接對照 Python `safe_device_id()` 於 2026-10-18 的實測輸出，兩端規則一旦分岔即失敗。JavaScript 測試 194/194。

# 修復：app.mjs 語法錯誤導致整個前端失效 · 2026-10-18

- 症狀：頁面載入後所有視圖無法切換（02 可見但 01 無法互動），側欄導航無反應。
- 根因：上一則變更以行號切片刪除 `confirmDeviceId()` 時多刪了一行，把緊接著的 `function ingest(packet,{capture=true,now=Date.now()}={}){` 一併移除，導致 `app.mjs` 出現 `SyntaxError: Illegal return statement`。ES module 語法錯誤使整個模組不載入，故所有互動全停。
- 修復：補回 `ingest()` 的函式簽名行。
- 教訓：本次 `npm test` 192/192 全綠卻沒抓到 —— 現有測試沒有任何一項真正 `import` `app.mjs`（只有一項以文字讀取它），因此語法錯誤完全繞過測試。已補上以 `node --check` 對 `neural-worm/*.mjs` 與 `src/*.mjs` 全量語法檢查，並確認 `dist/neural-worm/app.mjs` 同樣通過。
- 後續凡是改動 `app.mjs`，驗收序列一律為：`node --check` → `npm test` → `npm run build` → `git diff --check`。

# 01# 保存身份與記錄標識合併 · 採集器區塊取消折疊與平台中立化 · 2026-10-18

- **一鍵保存**：`<details id="gateway-panel">` 內原本有兩顆各管一件事的按鈕 —— `#gateway-save`（保存設備身份）與 `#confirm-device-id`（保存記錄用設備標識）。兩者都是「告訴採集器這是哪台裝置」，拆成兩步只會讓人漏掉其中一步。現 `gateway-save` 一次送出 `eeg.deviceId` 連同 USB／BLE 身份，並同步寫入 `localStorage`；`confirmDeviceId()` 函式與其按鈕、綁定一併移除。保存前仍會校驗標識字元集（英數字、點、底線、連字號，≤64），失敗即中止且不送出。
- **取消折疊**：`#gateway-panel` 由 `<details>` 改回 `<section>`，狀態列改用與全頁一致的 `.section-line`（`採集器設備識別`＋右側狀態）。`style.css` 移除 `.gateway-panel>summary` 相關樣式。
- **平台中立**：原先保存後提示寫死「按 USB 身份識別；**COM 號或 macOS 設備路徑**改變後自動重連」，在 Windows 上讀起來是錯的（COM 是 Windows、macOS 路徑是 macOS）。三處語系一併改為「**設備路徑或 COM 號**改變後自動重連」。區塊標題右側的 `#gateway-platform` 仍由 `sys.platform` 動態顯示 `macOS`／`Windows`，不是寫死。
- 連帶清理：`.direct-device` / `.direct-note` 樣式對應的 HTML 已在上一輪刪除，一併移除；提示段落改用新類別 `.gateway-hint`；移動端 `@media` 內重複的 `.gateway-panel{padding:0 18px}` 修正為與基礎規則一致的 `padding:18px`。
- `tools/verify-portable-browser.py` 不再需要點開 `<summary>`；`tests/i18n.test.mjs` 新增三條反向斷言（不得回退成 `<details id="gateway-panel"`、不得出現 `confirm-device-id`、須為 `<section id="gateway-panel`）。JavaScript 測試 192/192、gateway Python 測試 60/60。

# 01# 記錄保存目錄可設定，啟停受其約束 · 2026-10-18

- **後端**：`recording_directory()` 更名為 `resolve_storage(config)`，回傳 `(directory, error)`。`config.example.json` 新增 `storage.directory`（空字串＝使用專案目錄下的 `EEG Data`）。自選目錄優先；選了但不可寫時回退使用者資料目錄並帶回錯誤原因，不再靜默改寫使用者的選擇。
- **執行期切換**：`Acquisition` 新增 `storage_directory` 屬性、`storage_ready` 屬性與 `use_storage()`（會先關閉舊記錄器再重建）。`apply_config()` 偵測到 `storage` 變更時即呼叫 `use_storage()`，不必重啟應用。
- **API**：`GET /api/gateway/devices` 新增 `storage: {directory, ready, error}` 欄位，供前端判斷能否啟停。
- **介面**：採集器區塊新增「記錄保存目錄」輸入框（`#storage-directory`，留空＝專案目錄下的 `EEG Data`）、「套用保存目錄」（`#storage-apply`）與狀態行（`#storage-state`，顯示實際路徑或不可寫原因）。
- **啟停閘門**：`setGatewayEnabled()` 在 `storage.ready` 為假時拒絕並提示「請先設定可寫入的記錄保存目錄」；兩顆啟停按鈕同步加上 `title` 說明。避免資料無處落地仍開始採集。
- 實測三種情境：未選＝`<專案>/EEG Data`；自選（含中文與空格的路徑）可建立且可寫；不可寫路徑回退至使用者資料目錄並回報原因。
- `tests/i18n.test.mjs` 新增 `storage-directory` / `storage-apply` / `storage-state` 結構斷言。JavaScript 測試 192/192、gateway Python 測試 60/60。

# EEG Data 改存專案目錄 · 01# 每條通路的啟停開關 · 2026-10-18

- **存檔位置**：`device_gateway.py` 新增 `recording_directory()`，記錄改存 `ROOT / "EEG Data"`（即專案目錄下），隨專案與安裝包一起移動。實測解析為 `/Users/yangweijia/music generation model/theory/EEG Data`。若該目錄不可寫（凍結後的 `.app` 套件或唯讀安裝），以寫入探測確認後回退到 `data_directory() / "EEG Data"`，不讓存檔失敗連帶中斷採集。設定檔、`service.log`、`runtime.json` 等執行期狀態仍留在使用者資料目錄 —— 只有記錄資料跟著專案走。
- **每條通路的啟停**：`index.html` 於採集器區塊加入 `#gateway-eeg-toggle`、`#gateway-ble-toggle` 兩顆按鈕，文案依當前 `config.*.enabled` 切換為「停止／啟動 EEG USB」與「停止／啟動 腦電 BLE」。`app.mjs` 的 `setGatewayEnabled()` 以 `POST /api/gateway/config` 送出 `{key:{enabled}}`；後端 `apply_config()` 在配置變更時會 `acquisition.stop()` 後重新 `start()`，故切換即時生效，無須重開應用。`upstream` 模式下按鈕停用。
- **藍牙看不到裝置的原因已寫進介面**：採集器的 `ble_worker` 在 USB 於 3 秒內有資料時會進入 `standby` 不掃描（`device_gateway.py`），因此新增說明句「USB 正在傳送資料時，採集器會讓藍牙暫停掃描；要看藍牙請先停掉 USB。」，並把操作順序寫成「先插上設備並按『重新掃描』→ 選身份 → 用啟停按鈕控制採集」。`bleDevices` 清單本來就由 `/api/gateway/devices` 回傳並填入 `#gateway-ble-select`，本次確認無需改動。
- 說明文字與 `README.md` 同步改為「桌面採集器自動保存至專案目錄下的 EEG Data 文件夾」，並刪除 README 中已不存在的瀏覽器直連與目錄授權章節。
- 新增 i18n 詞條「啟動」「停止」「先插上設備並按…」；`tests/i18n.test.mjs` 新增兩顆啟停按鈕的結構斷言。JavaScript 測試 192/192、gateway Python 測試 60/60。

# 01# 移除瀏覽器直連，EEG 存檔路徑固定為 EEG Data · 2026-10-18

經使用者明確指示執行（01# 凍結範圍的第四度放開）。桌面採集器已成為**唯一** EEG 連接與存檔路徑。

- **介面刪除**：
  - `<details id="direct-device">`（「瀏覽器直連 · 後備」）連同其下 USB / 串口與藍牙 / BLE 兩張卡、`#baud` 波特率下拉、`#usb-state` / `#ble-state` / `#direct-state` 狀態標記，全部移除。
  - 「選擇瀏覽器保存目錄」按鈕與 `#eeg-directory-name` 狀態行移除 —— 該目錄授權本來只服務瀏覽器直連的 `.tgam` 存檔。
- **程式移除**（`neural-worm/app.mjs`）：
  - 匯入 `BrowserDeviceInput`、`hasEEGDirectoryPermission` / `loadEEGDirectoryHandle` / `saveEEGDirectoryHandle`、`BrowserRawEEGSessionWriter`。
  - 函式 `saveBrowserEEGBytes`、`closeBrowserEEGWriter`、`chooseEEGDirectory`、`restoreEEGDirectory`、`toggleBrowserDevice`、`updateDeviceConnectionControls`。
  - 狀態變數 `directTransport`、`directTransportState`、`browserEEGDirectory` / `browserEEGWriter` / `browserEEGIdentity` / `browserEEGSaveQueue`，以及 `initialize()` 內的 `await restoreEEGDirectory()`。
  - `updateDeviceMonitor()` 的分流簡化為固定的「等待設備資料」；`refreshRuntime()` 的存檔判斷簡化為 `if(state.storage)`。
- **保留（刻意）**：`src/device-input.mjs`、`src/eeg-directory.mjs`、`src/raw-eeg-session.mjs` 三个模組檔案與其測試一併保留（仍可獨立測試，未被其他程式引用）；`liveAcquisitionStatus()` 的 `browser_usb` / `browser_ble` 防禦分支保留，因封包仍可能帶這些 transport 標記。
- **EEG Data 資料夾本來就是寫死的**：`gateway/device_gateway.py` 以 `Acquisition(config, directory / "EEG Data")` 建構記錄器，無任何設定項。實測路徑：macOS `~/Library/Application Support/NeuralResonance/EEG Data/`、Windows `%LOCALAPPDATA%\NeuralResonance\EEG Data\`。介面於「采集事实数据监控」的狀態列直接顯示該實際路徑（`app.mjs` 以 `state.storage.directory` 填入），說明文字改為「桌面採集器自動保存至固定的 EEG Data 文件夾，實際路徑顯示於下方狀態列」並同步三語。
- `tests/i18n.test.mjs` 改為反向斷言：明確禁止 `serial-connect` / `ble-connect` / `baud` / `usb-state` / `ble-state` / `choose-eeg-directory` / `eeg-directory-name` / `direct-device` / `direct-state` 重新出現在頁面。JavaScript 測試 192/192。

# 01# 合併兩條 EEG 連接路徑為主從兩層 · 2026-10-18

- 使用者指出「採集器設備識別」與「USB / 串口 · 藍牙 / BLE 的選擇 EEG 設備」功能重疊。二者實為同一目的的兩種 transport（`usb` / `desktop_ble` vs `browser_usb` / `browser_ble`），永不同時佔用同一裝置，但頁面以兩個平級區塊並列，使用者無從判斷該走哪條。
- `index.html`：兩張手動卡（`.device-method-grid`）包進 `<details id="direct-device">`，摘要為 **「瀏覽器直連 · 後備」** 並帶 `<small id="direct-state">` 即時狀態；正文加一句說明「桌面採集器已自動連接設備時，此處可略過」。01 現為單一主路徑（採集器）+ 單一收合後備，不再有兩個同級的「選擇 EEG 設備」介面。
- 修正誤導性標籤：波特率下拉原標「串口波特率」，但 `app.mjs` 只把它傳給 `devices.serial(...)`，**採集器完全不讀這個值**（採集器取自 `gateway/config.example.json` 的 `config.eeg.baud`）。改為「瀏覽器直連波特率」，說明改為「只影響此處的瀏覽器直連；採集器使用自身設定。TGAM 設備請選 57600。」
- `neural-worm/app.mjs` 的 `updateDeviceConnectionControls()` 同步寫入 `#direct-state`：取當前實際連線的 browser-direct transport（usb／ble）狀態文字，兩者皆未連線時顯示「未連接」，避免收合後看不到自身狀態。
- `style.css` 新增 `.direct-device` 摘要樣式（`＋／－` 指示、hover、分隔線）與 `.direct-note`。
- i18n 以新鍵取代「常見 TGAM 設備請選 57600；其他設備請按說明書設定。」，新增「瀏覽器直連波特率」「瀏覽器直連 · 後備」「桌面採集器已自動連接設備時…」三條。`tests/i18n.test.mjs` 同步更新並新增結構斷言（`#gateway-panel` 必須早於 `#direct-device`）。JavaScript 測試 192/192、gateway Python 測試 60/60。

# 01# 記錄用設備標識併入採集器設備識別 · 2026-10-18

- `index.html`：`.eeg-profile`（EEG 設備序列號 / 檔案標識）由 `#gateway-panel` 之外的獨立區塊，移入 `<details id="gateway-panel">` 末尾（`#gateway-message` 之後），與「重新掃描／保存設備身份」同屬設備身份設定。
- 理由：該欄位設定的是**記錄檔案的命名標識**（寫入採集器的 `config.eeg.deviceId`，用於 `.tgam` 檔名），與選擇哪一台 USB 轉接器是同一組「設備身份」操作，分成兩處反而割裂。
- 標籤改為平台中性用語：`EEG 設備序列號 / 檔案標識` → `記錄用設備標識`；狀態文案 `未設置設備標識，檔名將使用 unknown-device` → `未設置設備標識，記錄檔名將使用 unknown-device`（英文改為 `No recording device ID set; saved sessions will be named unknown-device`）。原措辭在中文讀作「文件名」、且未說明是記錄檔，易被理解為僅指某個平台的檔案系統。
- 行為變化（刻意）：因該欄位透過採集器 API `/api/gateway/config` 保存，純網頁預覽（無採集器）下本來就無法生效，故隨 `#gateway-panel` 一併在採集器不可用時隱藏，不再顯示無效控制項。`localStorage` 還原與輸入邏輯不變。
- i18n 以新鍵取代舊鍵（`EEG 設備序列號 / 檔案標識`、`未設置設備標識，檔名將使用 unknown-device` 已無殘留引用）。JavaScript 測試 192/192。

# 01# 採集器設備區塊降噪 · 2026-10-18

- `index.html`：`#gateway-panel` 由 `<section>` 改為 `<details>`，**預設收合**，並移至 `.collector-status` 之後、「USB / 串口」與「藍牙 / BLE」兩張卡之前。理由：桌面情境下採集器是自動主路徑，兩張卡是瀏覽器直連的人工後備，順序改為「自動 → 後備」。
- 移除區塊內原有的 `section-line`（「本機採集器設備」）與 `<h3>已發現的設備</h3>`；改由 `<summary>` 承載區塊標題與關鍵狀態。
- `<summary>` 承載唯一真正需要常駐的資訊：`#gateway-state`（`自動 · 唯一型號匹配` 或 `使用已保存身份`，由 `config.eeg` 是否已有 serialNumber／location 決定）與 `#gateway-platform`。
- 「重新掃描／保存設備身份」兩顆按鈕包進 `.gateway-actions` 統一間距；`style.css` 新增 `.gateway-panel>summary` 的揭示樣式（`＋／－` 指示、hover、`[open]` 時加分隔線），`.gateway-panel` 內距改由 summary 承擔，`max-width:720px` 適配同步更新。
- 淨效果：01 首屏由 7 個區塊減為 1 行可展開的摘要列；設備清單與身份選擇器保留原功能，僅在需要排查自動識別時才展開。
- 新增 i18n 詞條「採集器設備識別」「使用已保存身份」。`tools/verify-portable-browser.py` 同步改為先點開 `<summary>` 再讀 `#gateway-inventory`（並移除已失效的 `#gateway-open` 斷言）。JavaScript 測試 192/192、gateway Python 測試 60/60。

# 修正：設備身份不再以作業系統節點名呈現 · 2026-10-18

經使用者明確重新開放 01#（本項為第三項，前兩項見下）。問題是「前後端分層錯亂」：後端的作業系統設備節點名被直接當成前端標籤渲染。

- **三處洩漏全部移除**：
  - `neural-worm/app.mjs` `refreshRuntime()` 的 `#runtime-summary` 原為 `EEG USB ${core.ports?.brainlink}`，會印出 `/dev/cu.usbmodem8D7F577753511`；改為只報Presence（`EEG USB 已識別` / `EEG USB 未識別`）。
  - 同檔 `#gateway-inventory` 清單列首行原為 `device.port`；改為裝置型號名稱（`STM32 Virtual COM Port`），次行顯示 `序列號 8D7F57775351`，無序列號時退回 `USB 型號 0483:5740`。
  - `src/gateway-settings.mjs` 的 `identityOptions()` 標籤原為 `${d.port} · …`；新增匯出函式 `deviceLabel()` 統一產出顯示用名稱。
- **零功能損失**：設備匹配本來就只走 `serialNumber`／`location`，`value` 欄位從不包含 port；故節點名純屬裝飾，且隨平台而變（Windows 是 `COM18`、macOS 是 `/dev/cu.*`）。
- **保留唯一性**：兩台同型且無序列號的轉接器仍以 USB 拓撲槽位（`location`）區分，不回到以節點名區分。
- 後端 `/api/runtime` 的 `ports.brainlink` 欄位保留（供診斷與日誌），僅前端不再渲染；如需更嚴格的分層可另行移除。
- 新增 i18n 詞條「已識別」「序列號」「USB 型號」「USB 設備」；新增回歸測試 `device labels name the hardware; an operating-system port path never reaches the page`（同時覆蓋 `/dev/cu.*` 與 `COM\d`）。JavaScript 測試 192/192。


# 修正：EEG 採集波特率預設值 · 2026-10-18

- **根因**：`gateway/config.example.json` 的 `eeg.baud` 預設為 `115200`，而 TGAM／BrainLink 裝置使用 `57600`。採集器能依 VID/PID 唯一匹配並開啟 `/dev/cu.usbmodem8D7F577753511`，卻讀不到任何位元組，控制台因此長期停在「獨立採集器運行中 · 尚未收到有效腦波」，且 `snapshot.transport` 因 `fresh` 為假而恆為 `none`。
- **三方不一致**：介面 `index.html:132` 的波特率下拉預設為 `57600 · TGAM 推薦`；`gateway/tests/test_eeg_recording.py` 的錄製夾具亦以 `57600` 為準；僅採集器預設值為 `115200`。
- 修正為 `57600`。本機 `~/Library/Application Support/NeuralResonance/config.json` 尚不存在，故當時生效值即為此預設值；且倉庫內無 `Neural Resonance.app`，啟動走源碼路徑直接讀工作區設定，改動立即生效。
- `tools/start-macos.sh` 的 `bundle_has_current_eeg_module()` 比對清單補入 `gateway/config.example.json`，避免日後存在便携 `.app` 時，設定變更不會使舊 bundle 失效。
- 驗證：`sh -n` 通過；`./Start-macOS.command --setup-only` 回傳 `Isolated locked environment ready (offline).`（退出碼 0）；gateway Python 測試 60/60 通過。

# 啟動腳本 · 清理舊採集器 · 2026-10-18

- `Start-macOS.command` 新增 `stop_stale_collectors()`，於三個啟動點（便攜 `.app`、已就緒 runtime 快速路徑、首次建置環境路徑）於啟動前呼叫；`--setup-only` 不觸發清理。
- 動因：仍在執行的採集器會佔住 EEG 串口，新實例無法開啟該埠，於是控制台長期停在「尚未收到有效腦波」。
- 範圍限定：`pgrep -f` 的比對式本身即包含本 checkout 路徑（`$ROOT/gateway/device_gateway.py` 與 `$ROOT/Neural Resonance.app/Contents/MacOS`），故其他專案的採集器不會被終止。存活判斷使用 `kill -0`，**不使用 `ps`**。
- 流程：先 `SIGTERM`，最多等待 3 秒（30 × 0.1s）仍未退出才 `SIGKILL`；命中時在終端列印 `Stopping previous collector:<pid>`。
- 驗證：`sh -n` 語法檢查通過；實測兩個偽造進程（本專案與他專案各一），本專案舊進程被終止、他專案進程不受影響。

# 01# 重新開放（限兩項修正）· 2026-10-18

使用者明確重新開放 01# EEG 設備設定模組，範圍僅限以下兩項；其餘凍結範圍（設備連接、即時採集、目錄授權、歷史導入／回放、`.tgam` 容器與 JSON／CSV 導出）維持不變。

- **採集器設備清單只列真實 USB 設備**：`gateway/acquisition.py` 的 `inventory()` 原樣回傳 `list_ports.comports()` 的全部端口，前端再整份渲染，導致 macOS 的 `/dev/cu.debug-console`、`/dev/cu.Bluetooth-Incoming-Port` 等非 USB 系統端口以「非USB · 無序列號」出現在「已發現的設備」。現於 `neural-worm/app.mjs:refreshGateway()` 加 `filter(device => device.vid !== null)`，僅顯示層過濾，採集器 API 與自動選路邏輯不動；清單為空時改顯示「尚未發現 USB 串口設備；插入後會自動識別。」
- **心跳包不再寫成採集資料行**：面板自述「只顯示通過協議校驗的 EEG 資料」，但 `ingest()` 對每個封包無條件建立監控行。本機採集器在沒有腦波時持續送 `transport:'none'`、`eeg` 為空的心跳，導致「來源 none · 數據包 0 · 專注度 — · 放鬆度 —」無限刷屏。現於建行前檢查封包是否真的帶有數值腦波內容（八條頻段任一為有限值，或 attention／meditation 有效），無則不寫行，feed 維持「尚未收到 EEG 封包」。
- 新增 i18n 詞條「尚未發現 USB 串口設備；插入後會自動識別。」（zh-Hans／en）。JavaScript 測試 191/191。

# 01# EEG 設備設定模組凍結 · 2026-10-17 · 基於 v0.11.4

截至 2026-10-17 22:30（UTC+8），01# EEG 設備設定模組暫時完成並凍結，作為後續開發基線。凍結只限本模組；修改、擴展或重新設計此模組前，先由使用者明確重新開放。

- 覆蓋設備連接與即時監控、瀏覽器保存目錄授權、歷史資料導入與回放。
- 新採集保存為單一自描述 `.tgam`：固定容器頭記錄會話元資料，後接未經解析改寫的設備原始字節；不另生成或要求選擇 `.meta.json`。
- 支援按需將 `.tgam` 轉為 JSON 或 CSV；轉換不改寫原始文件。
- 繼續兼容舊 JSON／JSONL 記錄與舊版純原始 `.tgam`。
- 原始流沒有逐封包時間戳；導入回放時間為約 513 包／秒的估算，不是設備精確時間。
- 基線版本沿用專案版本 `0.11.4`；此記錄是內部模組凍結標記，不代表整個專案已發佈新版本。

驗證基線：JavaScript 測試 188/188、Gateway Python 測試 60 項、前端構建成功、`git diff --check` 通過。未提交代碼、未建立 Git 標籤。

2026-10-18：將 macOS `.command` 縮為穩定薄入口，將環境準備與啟動移至 `tools/start-macos.sh`。已存在的 `.app` 除核對建置標記外，也逐檔核對01設備模組前端源碼；不一致時啟動當前源碼，避免舊包遮蔽01更新。重複啟動交由設備採集器單實例鎖管理，不再按進程名強制終止。未修改02波形模組行為。

# v0.11.4 · 独立部署与跨平台修正

修正干净 GitHub 源码缺件、Windows 乐谱换行与中文导出、环境污染检测和 WebKit 音乐选择布局；补充 Mac 源码及原生包的实际启动回归。见[发布说明](RELEASE-v0.11.4.md)。

# v0.11.3 · BLE迟到通知

将BLE通知解析器和身份令牌绑定至原连接，防止迟到回调跨会话；新增真实工作线程模拟回归。见[发布说明](RELEASE-v0.11.3.md)。

# v0.11.2 · macOS实际资源路径

修正Mac原生包网页404；源环境和原生包分别进行实际启动验收。v0.11.1因原生包门禁失败未发布正式安装包。详见[发布说明](RELEASE-v0.11.2.md)。

# v0.11.1 · 数据与环境复检

修复批次丢样本、传感器记录和时钟、重连隔离、配置并发、游标重建、连接超时和源码启动；增加跨平台及真实浏览器回归。见[v0.11.1发布说明](RELEASE-v0.11.1.md)和[兼容范围](COMPATIBILITY.md)。

# v0.11.0 · 左側三頁與課件音樂方案

- 左側導航、等比例XY畫布、展示模式與手機導航。
- 四套課件創作方案對應十要素；有來源的音樂觀測單獨顯示，缺失項收起。
- 記錄、JSON、CSV和摘要分開保存創作意圖與觀測，回放重現原方案。
- USB保存VID/PID及序列號；BLE保存地址／macOS UUID，設備改名或COM變號後依身份識別。
- 增加隔離環境安裝檢查入口，使用鎖定依賴。

詳見[v0.11發布說明](RELEASE-v0.11.md)及[課件逐頁對應](MUSIC-PLANS.md)。

# v0.10.0 · 來源與證據修正

撤下十種預置幾何和未校準音樂數值；保留原始軌跡、來源門禁與缺失。詳見[發布說明](RELEASE-v0.10.md)及[證據核對](EVIDENCE.md)。以下為歷史變更，舊映射及十網造型已在v0.10撤下。

# 版本紀錄

## 0.9.0 — 2026-10-08

神經蠕蟲與十網聯動的變更見本文件末尾及 [v0.9 發布說明](RELEASE-v0.9.md)。

## 0.7.0 — 2026-10-08

- 波形頁改為兩條設備原生指數、四條縱向頻段曲線和原始樣本。
- 增加采集來源、原始樣本游標、最後樣本時間和接觸狀態。
- 支援逐字段時間戳、來源 epoch、采樣率與缺失數，記錄／CSV 保留來源資訊。
- WebSocket 靜默超時後重連，舊連接不能覆寫新連接；手動停止取消重試。
- 已授權的瀏覽器 USB／BLE 中斷後重試，不重複彈出首次授權選擇器。
- 本機自動入口沿用同源核心接口，舊的已保存遠端地址不會改寫自動啟動目標。
- 公共靜態入口仍為示範，不自行探測或占用硬體。

實際設備識別、真實資料輸出、接觸良好與介面連接分開驗收；不能以測試通過保證所有設備。

## 0.6.0 — 2026-10-07

- 神經蠕蟲頁新增十項音樂參數的手動提示詞交接、複製和 JSON 匯出。
- 保留資料來源、session、有效樣本數、時間跨度、最大間隔和規則版本。
- 原生 0–100 指數與衍生 0–127 控制值分開記錄。
- 修復頂層指數、原始單位和來源在記錄／回放中的遺失。
- CSV 分開保存原生指數、頻段比值及有效性。
- 修復 ThinkGear 錯誤 payload 污染緩存、擴展碼誤讀及 eSense 不可用值處理。
- 31 項單元／契約測試通過；桌面、手機、剪貼簿及記錄回放路徑已驗證。

硬體連接和音樂模型生成應在各自的真實設備／服務上另行驗收。
# v0.9.0 · 神經蠕蟲與十網聯動

- 0–127 中心坐標、起末點、時間滑桿與共用歷史節點。
- 十種音樂組織幾何、可核對的密集／離散統計、恒定輸入不自行游走。
- 複雜／離散組織控制與音高／BPM 分開，保留實驗映射語義。
- 因果顯示平滑、缺失斷線、epoch 隔離及每 60 秒本地交接。
- 補充原始演奏蠕蟲文獻、Vmus 方法與來源適用邊界。
