# 觀測摘要與人工交接

資料流：設備原生指數 → 同一來源／session／epoch的有效窗口 →
觀測、來源和缺失 → 可複製文字及JSON。沒有自動EEG至音樂推斷。

在神經蠕蟲頁選擇10、30或60秒，按產生摘要。可選每60秒整理一次；
文字保留在本機，需主動複製、下載或上傳。選擇模型只記錄交接對象。

| 欄位 | 內容 |
|---|---|
| source / sessionId | 原始來源及session |
| firstTimestamp / lastTimestamp | 真正使用的樣本時間 |
| observedSamples / longestGapSeconds | 樣本數與最大間隔 |
| inputs | 明示按樣本計算的原生指數均值，不是百分比 |
| parameters / organizations | 音樂觀測與來源；未觀測為null |
| controls127 | 全部null，不生成音樂控制量 |
| coordinates127 | 原始指數的坐標換算，不是MIDI訊息 |
| observedCoverageSeconds / traceStatistics | 有效時間與可復算統計 |
| evidence / methodSources | 來源聲明、方法及研究來源ID |
| claimsInferredFromEeg | false |

ThinkGear eSense零值無效，接觸不良及斷流時不產生新摘要。舊記錄中的v2推算
不會重新用作觀測。語言模型不能修改數值或把缺失項補成音樂處方。
完整來源見[EVIDENCE.md](EVIDENCE.md)。
