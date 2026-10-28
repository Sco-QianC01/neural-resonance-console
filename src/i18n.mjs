/**
 * Internationalization (i18n) module for Neural Resonance Console
 * Supports:
 *  - zh-Hans: 简体中文 (Simplified Chinese)
 *  - zh-Hant: 繁體中文 (Traditional Chinese - base)
 *  - en: English
 */

export const LANGUAGES = {
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  'en': 'English'
};

const STORAGE_KEY = 'neural_resonance_lang';

const T2S_MAP = {
  "們": "们",
  "說": "说",
  "這": "这",
  "為": "为",
  "與": "与",
  "個": "个",
  "時": "时",
  "會": "会",
  "動": "动",
  "經": "经",
  "來": "来",
  "對": "对",
  "發": "发",
  "學": "学",
  "長": "长",
  "點": "点",
  "數": "数",
  "體": "体",
  "種": "种",
  "開": "开",
  "實": "实",
  "機": "机",
  "當": "当",
  "現": "现",
  "關": "关",
  "見": "见",
  "問": "问",
  "無": "无",
  "產": "产",
  "話": "话",
  "應": "应",
  "變": "变",
  "結": "结",
  "幾": "几",
  "總": "总",
  "業": "业",
  "頭": "头",
  "聽": "听",
  "設": "设",
  "報": "报",
  "記": "记",
  "傳": "传",
  "導": "导",
  "帶": "带",
  "題": "题",
  "認": "认",
  "質": "质",
  "術": "术",
  "張": "张",
  "線": "线",
  "電": "电",
  "視": "视",
  "規": "规",
  "義": "义",
  "處": "处",
  "場": "场",
  "聲": "声",
  "聯": "联",
  "資": "资",
  "達": "达",
  "標": "标",
  "進": "进",
  "過": "过",
  "觀": "观",
  "寫": "写",
  "區": "区",
  "調": "调",
  "別": "别",
  "單": "单",
  "節": "节",
  "統": "统",
  "確": "确",
  "熱": "热",
  "類": "类",
  "階": "阶",
  "織": "织",
  "樂": "乐",
  "響": "响",
  "譜": "谱",
  "網": "网",
  "絡": "络",
  "選": "选",
  "輯": "辑",
  "簡": "简",
  "歷": "历",
  "檔": "档",
  "態": "态",
  "創": "创",
  "備": "备",
  "誤": "误",
  "錄": "录",
  "專": "专",
  "鬆": "松",
  "範": "范",
  "頻": "频",
  "壓": "压",
  "輸": "输",
  "補": "补",
  "採": "采",
  "脈": "脉",
  "儀": "仪",
  "暫": "暂",
  "斷": "断",
  "續": "续",
  "檢": "检",
  "測": "测",
  "試": "试",
  "驗": "验",
  "證": "证",
  "衛": "卫",
  "劃": "划",
  "優": "优",
  "圖": "图",
  "紙": "纸",
  "畫": "画",
  "輕": "轻",
  "較": "较",
  "軟": "软",
  "轉": "转",
  "載": "载",
  "軸": "轴",
  "輪": "轮",
  "輔": "辅",
  "辦": "办",
  "務": "务",
  "協": "协",
  "雙": "双",
  "廳": "厅",
  "廠": "厂",
  "廣": "广",
  "庫": "库",
  "懷": "怀",
  "懸": "悬",
  "戀": "恋",
  "驚": "惊",
  "懼": "惧",
  "慮": "虑",
  "憲": "宪",
  "寶": "宝",
  "尋": "寻",
  "壽": "寿",
  "將": "将",
  "樹": "树",
  "權": "权",
  "條": "条",
  "樣": "样",
  "樓": "楼",
  "欄": "栏",
  "歐": "欧",
  "歡": "欢",
  "歲": "岁",
  "歸": "归",
  "殘": "残",
  "殼": "壳",
  "毀": "毁",
  "畢": "毕",
  "氣": "气",
  "滿": "满",
  "漸": "渐",
  "潤": "润",
  "濃": "浓",
  "濟": "济",
  "濤": "涛",
  "濾": "滤",
  "瀏": "浏",
  "靈": "灵",
  "災": "灾",
  "爐": "炉",
  "爭": "争",
  "獨": "独",
  "環": "环",
  "疊": "叠",
  "療": "疗",
  "盤": "盘",
  "監": "监",
  "碼": "码",
  "礙": "碍",
  "礎": "础",
  "禮": "礼",
  "積": "积",
  "穩": "稳",
  "競": "竞",
  "筆": "笔",
  "籤": "签",
  "純": "纯",
  "納": "纳",
  "紐": "纽",
  "細": "细",
  "終": "终",
  "給": "给",
  "絕": "绝",
  "維": "维",
  "緊": "紧",
  "緒": "绪",
  "緣": "缘",
  "編": "编",
  "緩": "缓",
  "練": "练",
  "緻": "致",
  "縣": "县",
  "縮": "缩",
  "縱": "纵",
  "績": "绩",
  "繆": "缪",
  "纖": "纤",
  "職": "职",
  "腳": "脚",
  "脫": "脱",
  "臉": "脸",
  "臟": "脏",
  "臨": "临",
  "臺": "台",
  "舉": "举",
  "舊": "旧",
  "艙": "舱",
  "艦": "舰",
  "藝": "艺",
  "蘋": "苹",
  "薦": "荐",
  "藥": "药",
  "藍": "蓝",
  "蘇": "苏",
  "蘭": "兰",
  "虛": "虚",
  "蟲": "虫",
  "蟻": "蚁",
  "覽": "览",
  "覺": "觉",
  "計": "计",
  "訂": "订",
  "訊": "讯",
  "註": "注",
  "請": "请",
  "諸": "诸",
  "課": "课",
  "誰": "谁",
  "論": "论",
  "識": "识",
  "譯": "译",
  "譽": "誉",
  "讀": "读",
  "讓": "让",
  "贊": "赞",
  "豐": "丰",
  "負": "负",
  "貢": "贡",
  "財": "财",
  "責": "责",
  "賦": "赋",
  "購": "购",
  "貫": "贯",
  "貼": "贴",
  "貴": "贵",
  "貸": "贷",
  "貿": "贸",
  "賀": "贺",
  "賓": "宾",
  "賞": "赏",
  "賢": "贤",
  "賣": "卖",
  "賭": "赌",
  "賴": "赖",
  "賺": "赚",
  "贈": "赠",
  "贏": "赢",
  "趙": "赵",
  "趕": "赶",
  "趨": "趋",
  "跡": "迹",
  "踴": "踊",
  "軀": "躯",
  "車": "车",
  "軌": "轨",
  "輝": "辉",
  "轄": "辖",
  "轍": "辙",
  "辭": "辞",
  "農": "农",
  "迴": "回",
  "邊": "边",
  "遷": "迁",
  "遺": "遗",
  "邁": "迈",
  "還": "还",
  "邏": "逻",
  "釋": "释",
  "郵": "邮",
  "鄉": "乡",
  "釀": "酿",
  "針": "针",
  "釣": "钓",
  "鈍": "钝",
  "鈉": "钠",
  "鋼": "钢",
  "錐": "锥",
  "錦": "锦",
  "錫": "锡",
  "錯": "错",
  "鍊": "炼",
  "鍵": "键",
  "鍾": "钟",
  "鐵": "铁",
  "鑑": "鉴",
  "鑿": "凿",
  "門": "门",
  "閉": "闭",
  "閒": "闲",
  "間": "间",
  "閥": "阀",
  "閣": "阁",
  "闊": "阔",
  "閱": "阅",
  "陸": "陆",
  "隊": "队",
  "隨": "随",
  "隱": "隐",
  "隸": "隶",
  "難": "难",
  "靜": "静",
  "韋": "韦",
  "韓": "韩",
  "頂": "顶",
  "頃": "顷",
  "項": "项",
  "順": "顺",
  "須": "须",
  "預": "预",
  "領": "领",
  "顆": "颗",
  "額": "额",
  "顏": "颜",
  "願": "愿",
  "風": "风",
  "飛": "飞",
  "飯": "饭",
  "飲": "饮",
  "飾": "饰",
  "飽": "饱",
  "餅": "饼",
  "館": "馆",
  "馬": "马",
  "馳": "驰",
  "駁": "驳",
  "駿": "骏",
  "鬥": "斗",
  "鬧": "闹",
  "鬱": "郁",
  "魚": "鱼",
  "魯": "鲁",
  "鮮": "鲜",
  "鳥": "鸟",
  "鳴": "鸣",
  "鹹": "咸",
  "麥": "麦",
  "黃": "黄",
  "齊": "齐",
  "齒": "齿",
  "龍": "龙",
  "龜": "龟",
  "顯": "显",
  "層": "层",
  "級": "级",
  "屬": "属",
  "號": "号",
  "準": "准",
  "構": "构",
  "疇": "畴",
  "躍": "跃",
  "離": "离",
  "陣": "阵",
  "複": "复",
  "據": "据",
  "腦": "脑",
  "匯": "汇"
};

export function toSimplified(text) {
  if (!text || typeof text !== 'string') return text;
  return text.split('').map(ch => T2S_MAP[ch] || ch).join('');
}

export const TRANSLATIONS = {
  "數據標註": {"zh-Hans": "数据标注", "en": "Data Annotation"},
  "ANNOTATION / PROMPT": {"zh-Hans": "标注 / 提示词", "en": "ANNOTATION / PROMPT"},
  "神經共振": {
    "zh-Hans": "神经共振",
    "en": "Neural Resonance"
  },
  "神經共振 · 波形、蠕蟲與設備": {
    "zh-Hans": "神经共振 · 波形、蠕虫与设备",
    "en": "Neural Resonance · Waveforms, Worms & Devices"
  },
  "開啟左側導航": {
    "zh-Hans": "开启左侧导航",
    "en": "Toggle Navigation"
  },
  "研究流程": {
    "zh-Hans": "研究流程",
    "en": "Research Workflow"
  },
  "設備設定": {
    "zh-Hans": "设备设定",
    "en": "Device Settings"
  },
  "波形捕獲": {
    "zh-Hans": "波形捕获",
    "en": "Waveform Capture"
  },
  "音樂與神經響應": {
    "zh-Hans": "音乐与神经响应",
    "en": "Music & Neural Response"
  },
  "腦波輸入": {
    "zh-Hans": "脑波输入",
    "en": "EEG Signal Input"
  },
  "資料來源": {
    "zh-Hans": "数据来源",
    "en": "Data Source"
  },
  "Language / 语言 / 語言": {
    "zh-Hans": "语言设置",
    "en": "Language Selection"
  },
  "01 / DEVICE & INTERFACES": {
    "zh-Hans": "01 / 设备与接口",
    "en": "01 / DEVICE & INTERFACES"
  },
  "02 / WAVEFORM CAPTURE": {
    "zh-Hans": "02 / 波形捕获",
    "en": "02 / WAVEFORM CAPTURE"
  },
  "03 / MUSIC & NEURAL RESPONSE": {
    "zh-Hans": "03 / 音乐与神经响应",
    "en": "03 / MUSIC & NEURAL RESPONSE"
  },
  "03 / OBSERVED SIGNAL": {
    "zh-Hans": "03 / 观测信号",
    "en": "03 / OBSERVED SIGNAL"
  },
  "03 / OBSERVATION HAND-OFF": {
    "zh-Hans": "03 / 观测摘要交接",
    "en": "03 / OBSERVATION HAND-OFF"
  },
  "示範": {
    "zh-Hans": "示范",
    "en": "Demo"
  },
  "實時": {
    "zh-Hans": "实时",
    "en": "Live"
  },
  "回放": {
    "zh-Hans": "回放",
    "en": "Replay"
  },
  "專注度": {
    "zh-Hans": "专注度",
    "en": "Attention"
  },
  "放鬆度": {
    "zh-Hans": "放松度",
    "en": "Meditation"
  },
  "自動變化": {
    "zh-Hans": "自动变化",
    "en": "Auto Vary"
  },
  "暫停示範": {
    "zh-Hans": "暂停示范",
    "en": "Pause Demo"
  },
  "繼續示範": {
    "zh-Hans": "继续示范",
    "en": "Resume Demo"
  },
  "示範已暫停": {
    "zh-Hans": "示范已暂停",
    "en": "Demo Paused"
  },
  "等待真實設備": {
    "zh-Hans": "等待真实设备",
    "en": "Waiting for Real Device"
  },
  "等待 / 暫停": {
    "zh-Hans": "等待 / 暂停",
    "en": "Waiting / Paused"
  },
  "等待真實 EEG 設備連接。": {
    "zh-Hans": "等待真实 EEG 设备连接。",
    "en": "Waiting for a real EEG device."
  },
  "等待真實 EEG 設備連接；合成示範已暫停。": {
    "zh-Hans": "等待真实 EEG 设备连接；合成示范已暂停。",
    "en": "Waiting for a real EEG device; synthetic demo paused."
  },
  "等待真實 EEG 設備連接；示範與回放已停止。": {
    "zh-Hans": "等待真实 EEG 设备连接；示范与回放已停止。",
    "en": "Waiting for a real EEG device; demo and replay have stopped."
  },
  "合成示範已暫停；按上方資料入口的「示範」可重新啟動。": {
    "zh-Hans": "合成示范已暂停；按上方数据入口的「示范」可重新启动。",
    "en": "Synthetic demo is paused; resume it from the Source row above."
  },
  "尚未接入 EEG 裝置：八條頻段與兩個代理指標等待真實資料，連接請前往 01 設備設定。": {
    "zh-Hans": "尚未接入 EEG 装置：八条频段与两个代理指标等待真实数据，连接请前往 01 设备设定。",
    "en": "No EEG device connected: the eight bands and both proxy indices wait for real data. Connect a device in 01 Device Setup."
  },
  "WebSocket 資料源": {
    "zh-Hans": "WebSocket 数据源",
    "en": "WebSocket Source"
  },
  "連接": {
    "zh-Hans": "连接",
    "en": "Connect"
  },
  "停止連接": {
    "zh-Hans": "停止连接",
    "en": "Disconnect"
  },
  "匯入 EEG JSON": {
    "zh-Hans": "导入 EEG JSON",
    "en": "Import EEG JSON"
  },
  "播放記錄": {
    "zh-Hans": "播放记录",
    "en": "Play Recording"
  },
  "暫停": {
    "zh-Hans": "暂停",
    "en": "Pause"
  },
  "有效封包": {
    "zh-Hans": "有效封包",
    "en": "Valid Packets"
  },
  "資料狀態": {
    "zh-Hans": "数据状态",
    "en": "Data Status"
  },
  "等待": {
    "zh-Hans": "等待",
    "en": "Waiting"
  },
  "示範由本頁生成，並非實際測量。": {
    "zh-Hans": "示范由本页生成，并非实际测量。",
    "en": "Demo generated by this page; not actual measurement."
  },
  "開始記錄": {
    "zh-Hans": "开始记录",
    "en": "Start Recording"
  },
  "停止記錄": {
    "zh-Hans": "停止记录",
    "en": "Stop Recording"
  },
  "匯出 JSON ↗": {
    "zh-Hans": "导出 JSON ↗",
    "en": "Export JSON ↗"
  },
  "0 個樣本": {
    "zh-Hans": "0 个样本",
    "en": "0 samples"
  },
  "個樣本": {
    "zh-Hans": "个样本",
    "en": "samples"
  },
  "資料與方法": {
    "zh-Hans": "数据与方法",
    "en": "Data & Methods"
  },
  "查看來源文件": {
    "zh-Hans": "查看来源文档",
    "en": "View Source Evidence"
  },
  "示範資料": {
    "zh-Hans": "示范数据",
    "en": "Demo Data"
  },
  "原始腦電與頻段功率": {
    "zh-Hans": "原始脑电与频段功率",
    "en": "Raw EEG & Band Power"
  },
  "設備指數與結果趨勢": {
    "zh-Hans": "设备指数与结果趋势",
    "en": "Device Indices & Trend"
  },
  "來源頻段值": {
    "zh-Hans": "来源频段值",
    "en": "Source Band Values"
  },
  "示範頻段值": {
    "zh-Hans": "示范频段值",
    "en": "Demo Band Values"
  },
  "合成示範相對值": {
    "zh-Hans": "合成示范相对值",
    "en": "Synthetic demo relative power"
  },
  "來源頻段值 · 單位未回報": {
    "zh-Hans": "来源频段值 · 单位未回报",
    "en": "Source band values · unit not reported"
  },
  "Alpha · 合計": {
    "zh-Hans": "Alpha · 合计",
    "en": "Alpha · Total"
  },
  "Beta · 合計": {
    "zh-Hans": "Beta · 合计",
    "en": "Beta · Total"
  },
  "研究步驟": {
    "zh-Hans": "研究步骤",
    "en": "Research Steps"
  },
  "音樂可視化": {
    "zh-Hans": "音乐可视化",
    "en": "Music Visualization"
  },
  "觀測坐標": {
    "zh-Hans": "观测坐标",
    "en": "Observation Coordinates"
  },
  "音樂要素": {
    "zh-Hans": "音乐要素",
    "en": "Musical Elements"
  },
  "選擇肖邦作品": {
    "zh-Hans": "选择肖邦作品",
    "en": "Select a Chopin Work"
  },
  "選擇音樂演示案例": {
    "zh-Hans": "选择音乐演示案例",
    "en": "Select a Performance Example"
  },
  "播放音樂": {
    "zh-Hans": "播放音乐",
    "en": "Play Music"
  },
  "暫停音樂": {
    "zh-Hans": "暂停音乐",
    "en": "Pause Music"
  },
  "播放": {
    "zh-Hans": "播放",
    "en": "Play"
  },
  "演奏曲線；點選或回車播放": {
    "zh-Hans": "演奏曲线；点击或回车播放",
    "en": "performance curve; select or press Enter to play"
  },
  "繼續觀察": {
    "zh-Hans": "继续观察",
    "en": "Resume observation"
  },
  "暫停觀察": {
    "zh-Hans": "暂停观察",
    "en": "Pause observation"
  },
  "播放演奏": {
    "zh-Hans": "播放演奏",
    "en": "Play performance"
  },
  "暫停演奏": {
    "zh-Hans": "暂停演奏",
    "en": "Pause performance"
  },
  "播放演奏樣例": {
    "zh-Hans": "播放演奏样例",
    "en": "Play performance example"
  },
  "暫停演奏樣例": {
    "zh-Hans": "暂停演奏样例",
    "en": "Pause performance example"
  },
  "音樂播放位置": {
    "zh-Hans": "音乐播放位置",
    "en": "Music Playback Position"
  },
  "肖邦 · 降D大調夜曲 Op.27 No.2": {
    "zh-Hans": "肖邦 · 降D大调夜曲 Op.27 No.2",
    "en": "Chopin · Nocturne in D-flat Major, Op. 27 No. 2"
  },
  "肖邦 · 降E大調夜曲 Op.9 No.2": {
    "zh-Hans": "肖邦 · 降E大调夜曲 Op.9 No.2",
    "en": "Chopin · Nocturne in E-flat Major, Op. 9 No. 2"
  },
  "delta頻段的時間波形": {
    "zh-Hans": "delta频段的时间波形",
    "en": "Delta band time waveform"
  },
  "theta頻段的時間波形": {
    "zh-Hans": "theta频段的时间波形",
    "en": "Theta band time waveform"
  },
  "alpha頻段的時間波形": {
    "zh-Hans": "alpha频段的时间波形",
    "en": "Alpha band time waveform"
  },
  "beta頻段的時間波形": {
    "zh-Hans": "beta频段的时间波形",
    "en": "Beta band time waveform"
  },
  "lowAlpha頻段的時間波形": {
    "zh-Hans": "lowAlpha频段的时间波形",
    "en": "Low alpha band time waveform"
  },
  "highAlpha頻段的時間波形": {
    "zh-Hans": "highAlpha频段的时间波形",
    "en": "High alpha band time waveform"
  },
  "lowBeta頻段的時間波形": {
    "zh-Hans": "lowBeta频段的时间波形",
    "en": "Low beta band time waveform"
  },
  "highBeta頻段的時間波形": {
    "zh-Hans": "highBeta频段的时间波形",
    "en": "High beta band time waveform"
  },
  "lowGamma頻段的時間波形": {
    "zh-Hans": "lowGamma频段的时间波形",
    "en": "Low gamma band time waveform"
  },
  "midGamma頻段的時間波形": {
    "zh-Hans": "midGamma频段的时间波形",
    "en": "Mid gamma band time waveform"
  },
  "即時採集狀態": {
    "zh-Hans": "实时采集状态",
    "en": "Live Acquisition Status"
  },
  "採集來源": {
    "zh-Hans": "采集来源",
    "en": "Signal Source"
  },
  "最後樣本": {
    "zh-Hans": "最后样本",
    "en": "Last Sample"
  },
  "原始樣本累計": {
    "zh-Hans": "原始样本累计",
    "en": "Cumulative Raw"
  },
  "接觸狀態": {
    "zh-Hans": "接触状态",
    "en": "Contact State"
  },
  "設備原生指數": {
    "zh-Hans": "设备原生指数",
    "en": "Device Native Indices"
  },
  "腦波頻段與指數": {
    "zh-Hans": "脑波频段与指数",
    "en": "Brainwave Bands and Indices"
  },
  "八條頻段按設備回報值逐條說明並可視化；其後用公開公式組成兩個代理指標，再與設備原生的專注／放鬆指數對照。頻段值由設備計算，代理指標由本頁計算，兩者不可互相換算。": {
    "zh-Hans": "八条频段按设备回报值逐条说明并可视化；其后用公开公式组成两个代理指标，再与设备原生的专注／放松指数对照。频段值由设备计算，代理指标由本页计算，两者不可互相换算。",
    "en": "Each of the eight bands is described and plotted from device-reported values; two proxy indices are then formed with published formulas and compared with the device's own attention and meditation indices. Band values come from the device, proxy indices from this page, and neither converts into the other."
  },
  "EEG BANDS / 八條腦波頻段": {
    "zh-Hans": "EEG BANDS / 八条脑波频段",
    "en": "EEG BANDS / Eight Brainwave Bands"
  },
  "定義 · 前額葉解讀 · 最近 60 秒": {
    "zh-Hans": "定义 · 前额叶解读 · 最近 60 秒",
    "en": "Definition · Prefrontal reading · last 60 s"
  },
  "ATTENTION / 專注：代理與原生": {
    "zh-Hans": "ATTENTION / 专注：代理与原生",
    "en": "ATTENTION / Proxy and Native"
  },
  "左軸 E 比值　右軸 原生 0–100": {
    "zh-Hans": "左轴 E 比值　右轴 原生 0–100",
    "en": "Left axis: E ratio　Right axis: native 0–100"
  },
  "MEDITATION / 放鬆：代理與原生": {
    "zh-Hans": "MEDITATION / 放松：代理与原生",
    "en": "MEDITATION / Proxy and Native"
  },
  "左軸 A 佔比　右軸 原生 0–100": {
    "zh-Hans": "左轴 A 占比　右轴 原生 0–100",
    "en": "Left axis: A share　Right axis: native 0–100"
  },
  "代理 E = β / (α + θ)": {
    "zh-Hans": "代理 E = β / (α + θ)",
    "en": "Proxy E = β / (α + θ)"
  },
  "原生 Attention": {
    "zh-Hans": "原生 Attention",
    "en": "Native Attention"
  },
  "代理 A = α / Σ": {
    "zh-Hans": "代理 A = α / Σ",
    "en": "Proxy A = α / Σ"
  },
  "原生 Meditation": {
    "zh-Hans": "原生 Meditation",
    "en": "Native Meditation"
  },
  "專注代理與設備原生專注度的雙縱軸對照曲線": {
    "zh-Hans": "专注代理与设备原生专注度的双纵轴对照曲线",
    "en": "Dual-axis comparison of the attention proxy and the device's native attention index"
  },
  "放鬆代理與設備原生放鬆度的雙縱軸對照曲線": {
    "zh-Hans": "放松代理与设备原生放松度的双纵轴对照曲线",
    "en": "Dual-axis comparison of the meditation proxy and the device's native meditation index"
  },
  "兩圖各為一組對照：實線為本頁按公開公式計算的代理指標（3 秒滑動平均），虛線為設備廠商未公開算法產生的 eSense 指數。左縱軸為代理值（E 為比值、A 為 0–1 佔比），右縱軸為原生指數（0–100）；兩軸各自量度、不作換算，線條是否同向起伏只表示一致程度，不代表數值相等。設備為單通道前額採集，不能計算左右半球不對稱（FAA），亦不構成臨床診斷。": {
    "zh-Hans": "两图各为一组对照：实线为本页按公开公式计算的代理指标（3 秒滑动平均），虚线为设备厂商未公开算法产生的 eSense 指数。左纵轴为代理值（E 为比值、A 为 0–1 占比），右纵轴为原生指数（0–100）；两轴各自量度、不作换算，线条是否同向起伏只表示一致程度，不代表数值相等。设备为单通道前额采集，不能计算左右半球不对称（FAA），亦不构成临床诊断。",
    "en": "Each chart is one comparison: the solid line is a proxy computed here from published formulas (3-second trailing mean), the dashed line is the device's own eSense index from an undisclosed vendor algorithm. The left axis carries the proxy (a ratio for E, a 0–1 share for A), the right axis the native index (0–100). The two axes are measured independently and are never converted into each other; whether the lines rise and fall together shows agreement, not equal values. The device is a single frontal channel, so hemispheric asymmetry (FAA) cannot be computed, and nothing here is a clinical diagnosis."
  },
  "參考文獻": {
    "zh-Hans": "参考文献",
    "en": "References"
  },
  "方法與邊界：腦波頻段與指數": {
    "zh-Hans": "方法与边界：脑波频段与指数",
    "en": "Methods and boundaries: brainwave bands and indices"
  },
  "METHODS AND BOUNDARIES / 方法與邊界": {
    "zh-Hans": "METHODS AND BOUNDARIES / 方法与边界",
    "en": "METHODS AND BOUNDARIES"
  },
  "公式 · 可識別性 · 邊界條件": {
    "zh-Hans": "公式 · 可识别性 · 边界条件",
    "en": "Formulas · identifiability · boundary conditions"
  },
  "本頁數值分三層：頻段值由廠商算法產生，代理指標由本頁按公開公式計算，專注與放鬆指數由廠商未公開算法產生。三層產生者不同，不可互相替代或換算。": {
    "zh-Hans": "本页数值分三层：频段值由厂商算法产生，代理指标由本页按公开公式计算，专注与放松指数由厂商未公开算法产生。三层产生者不同，不可互相替代或换算。",
    "en": "The numbers fall into three layers: band values come from the vendor algorithm, proxy indices are computed here from published formulas, and the attention and meditation indices come from an undisclosed vendor algorithm. Because the producers differ, no layer substitutes for or converts into another."
  },
  "公式：由頻段到兩個代理指標": {
    "zh-Hans": "公式：由频段到两个代理指标",
    "en": "Formulas: from bands to two proxy indices"
  },
  "專注代理　E = β / (α + θ)": {
    "zh-Hans": "专注代理　E = β / (α + θ)",
    "en": "Attention proxy　E = β / (α + θ)"
  },
  "放鬆代理　A = α / (δ + θ + α + β)": {
    "zh-Hans": "放松代理　A = α / (δ + θ + α + β)",
    "en": "Meditation proxy　A = α / (δ + θ + α + β)"
  },
  "α = Low Alpha + High Alpha　β = Low Beta + High Beta　θ = Theta　δ = Delta；γ 不入式：額肌肌電污染。": {
    "zh-Hans": "α = Low Alpha + High Alpha　β = Low Beta + High Beta　θ = Theta　δ = Delta；γ 不入式：额肌肌电污染。",
    "en": "α = Low Alpha + High Alpha　β = Low Beta + High Beta　θ = Theta　δ = Delta; γ is excluded: frontal muscle contamination."
  },
  "係數全取 1；E 值域 [0, ∞)，A 值域 [0, 1]（分母不大於零時輸出空值）；兩者均不與設備 eSense 換算。": {
    "zh-Hans": "系数全取 1；E 值域 [0, ∞)，A 值域 [0, 1]（分母不大于零时输出空值）；两者均不与设备 eSense 换算。",
    "en": "All weights are 1; E ranges over [0, ∞) and A over [0, 1], with a null output when the denominator is not positive; neither converts into the device eSense."
  },
  "一般式：E = wβ·β / (wα·α + wθ·θ)，A = wα·α / (wδ·δ + wθ·θ + wα·α + wβ·β)；E 之形式依 Pope 等（1995）[1]；A 為本頁自建之 α 佔比，分母限 δ–β 四項，其解讀依 Klimesch（1999）[2] 之 α 去同步化論述；權重全取 1 為本頁宣告值，非廠商參數。": {
    "zh-Hans": "一般式：E = wβ·β / (wα·α + wθ·θ)，A = wα·α / (wδ·δ + wθ·θ + wα·α + wβ·β)；E 之形式依 Pope 等（1995）[1]；A 为本页自建之 α 占比，分母限 δ–β 四项，其解读依 Klimesch（1999）[2] 之 α 去同步化论述；权重全取 1 为本页宣告值，非厂商参数。",
    "en": "General form: E = wβ·β / (wα·α + wθ·θ), A = wα·α / (wδ·δ + wθ·θ + wα·α + wβ·β); the form of E follows Pope et al. (1995) [1], while A is an alpha share constructed on this page whose denominator is limited to the four δ–β bands, and its reading follows Klimesch's (1999) [2] account of alpha desynchronisation; all weights are set to 1 by declaration on this page, not taken from the vendor."
  },
  "E 之效度建立於作業層面之判別，未與主觀專注評分建立效標關聯 [3]；A 只讀作 α 佔比，不是放鬆分數——α 升高亦可反映對非作業區域之主動抑制 [4]。": {
    "zh-Hans": "E 之效度建立于作业层面之判别，未与主观专注评分建立效标关联 [3]；A 只读作 α 占比，不是放松分数——α 升高亦可反映对非作业区域之主动抑制 [4]。",
    "en": "E has been validated at task level but not against subjective attention ratings [3]; A is read only as the alpha share, not a Meditation score — a rise in alpha can also reflect active inhibition of non-task regions [4]."
  },
  "一、問題陳述：eSense 之可識別性": {
    "zh-Hans": "一、问题陈述：eSense 之可识别性",
    "en": "1. Statement of the problem: the identifiability of eSense"
  },
  "二、方法：同輸入、雙路徑對照": {
    "zh-Hans": "二、方法：同输入、双路径对照",
    "en": "2. Method: one input, two parallel paths"
  },
  "三、邊界條件": {
    "zh-Hans": "三、边界条件",
    "en": "3. Boundary conditions"
  },
  "eSense 之 Attention 與 Meditation 由 ThinkGear 晶片內部算法生成，其輸入包含八條頻段功率與時域特徵；映射函數、基線校正與平滑參數均未公開（廠商口徑為多頻段綜合，Attention 偏重 β、Meditation 偏重 α）。就主機端可觀測量而言，可得者僅為頻段功率與 0–100 之輸出值。在輸入維度不完整、映射函數未知之條件下，該映射不具可識別性，故不存在由頻段功率反推其算法之可行路徑；本頁不主張還原廠商算法。": {
    "zh-Hans": "eSense 之 Attention 与 Meditation 由 ThinkGear 芯片内部算法生成，其输入包含八条频段功率与时域特征；映射函数、基线校正与平滑参数均未公开（厂商口径为多频段综合，Attention 偏重 β、Meditation 偏重 α）。就主机端可观测的量而言，可得者仅为频段功率与 0–100 之输出值。在输入维度不完整、映射函数未知的条件下，该映射不具可识别性，故不存在由频段功率反推其算法之可行路径；本页不主张还原厂商算法。",
    "en": "eSense's Attention and Meditation are generated by an algorithm inside the ThinkGear chip whose inputs include the eight band powers and time-domain features; the mapping, its baseline calibration and its smoothing parameters are all undisclosed (the vendor describes a multi-band synthesis with relative emphasis on beta for Attention and alpha for Meditation). On the host side the only observables are the band powers and the 0–100 outputs. With an incomplete input space and an unknown mapping, that mapping is not identifiable, so there is no feasible path from band powers back to the algorithm; this page makes no claim to reconstruct it."
  },
  "不可識別並不等於無從操作化：以文獻既有之操作型定義重建構念，可獲得可復算且可證偽之代理指標；其與設備指數之共變程度屬經驗問題，不由定義決定。": {
    "zh-Hans": "不可识别并不等于无从操作化：以文献既有之操作型定义重建构念，可获得可复算且可证伪之代理指标；其与设备指数之共变程度属经验问题，不由定义决定。",
    "en": "Non-identifiability does not preclude operationalisation: rebuilding the constructs from published operational definitions yields a recomputable, falsifiable proxy, and how far it covaries with the device indices is an empirical question rather than one settled by definition."
  },
  "本介面將同一批頻段功率並行輸入兩條路徑——廠商算法（輸出 Attention／Meditation）與本頁公式（輸出代理指標）。兩路徑輸入相同，其輸出之差異僅可歸因於算法本身；該差異構成可觀察之對象，用以檢驗代理指標與設備指數之共變關係。": {
    "zh-Hans": "本界面将同一批频段功率并行输入两条路径——厂商算法（输出 Attention／Meditation）与本页公式（输出代理指标）。两路径输入相同，其输出之差异仅可归因于算法本身；该差异构成可观察之对象，用以检验代理指标与设备指数之共变关系。",
    "en": "This console feeds the same band powers into two paths in parallel — the vendor algorithm, which outputs Attention and Meditation, and the formulas on this page, which output the proxies. With identical inputs the difference between the outputs is attributable only to the algorithms themselves, and that difference is the observable used to examine how the proxies covary with the device indices."
  },
  "頻段選擇之依據：θ 進入 E 之分母，因前額中線 theta 與工作記憶及認知控制相關 [5]。δ 作為低頻背景納入 A 之總量：delta 為慢波，深睡期主導，清醒時多為低幅背景 [6]；其於清醒時之升高另可能受疲勞、眼動或出汗影響，故 A 之解讀須一併考慮。γ 不納入：其與注意及記憶之關聯雖有文獻支持 [7]，惟消費級單通道之 gamma 幅度低，且與額肌肌電難以分離，納入分母將使指標隨肌電張力漂移。": {
    "zh-Hans": "频段选择之依据：θ 进入 E 之分母，因前额中线 theta 与工作记忆及认知控制相关 [5]。δ 作为低频背景纳入 A 之总量：delta 为慢波，深睡期主导，清醒时多为低幅背景 [6]；其于清醒时之升高另可能受疲劳、眼动或出汗影响，故 A 之解读须一并考虑。γ 不纳入：其与注意及记忆之关联虽有文献支持 [7]，惟消费级单通道之 gamma 幅度低，且与额肌肌电难以分离，纳入分母将使指标随肌电张力漂移。",
    "en": "Why these bands: θ enters the denominator of E because frontal midline theta is associated with working memory and cognitive control [5]. δ enters the total of A as a low-frequency reference: delta is a slow wave, dominant in deep sleep and a low-amplitude background when awake [6], and a rise in wakefulness may also reflect fatigue, eye movements or sweat, so any reading of A must allow for it. γ is excluded: although its association with attention and memory is documented [7], gamma on a consumer single channel is low in amplitude and hard to separate from frontal muscle activity, so including it would make the index drift with muscle tension."
  },
  "時間尺度：eSense 由晶片內部平滑後輸出，本頁比值為逐秒瞬時值，兩者若以不同時間尺度並置，曲線形狀必不一致，差異不盡歸因於算法。本頁對代理指標施以 3 秒尾隨平均（因果，不使用未來資料），與設備輸出之時間尺度對齊。於三段實測記錄（各 52–91 個有效讀數）中，此處理使專注代理與 Attention 之秩相關由 0.68／0.44／0.45 升至 0.89／0.71／0.67，放鬆代理與 Meditation 由 0.18／0.50／0.39 升至 0.29／0.61／0.59；窗口延長至 5 秒以上或改用居中窗口，相關皆下降，故取 3 秒。平滑僅作用於顯示序列，逐秒原始值隨記錄一併保存。": {
    "zh-Hans": "时间尺度：eSense 由芯片内部平滑后输出，本页比值为逐秒瞬时值，两者若以不同时间尺度并置，曲线形状必不一致，差异不尽归因于算法。本页对代理指标施以 3 秒尾随平均（因果，不使用未来数据），与设备输出之时间尺度对齐。于三段实测记录（各 52–91 个有效读数）中，此处理使专注代理与 Attention 之秩相关由 0.68／0.44／0.45 升至 0.89／0.71／0.67，放松代理与 Meditation 由 0.18／0.50／0.39 升至 0.29／0.61／0.59；窗口延长至 5 秒以上或改用居中窗口，相关皆下降，故取 3 秒。平滑仅作用于显示序列，逐秒原始值随记录一并保存。",
    "en": "Time scale: eSense is smoothed inside the chip before it is output, while the ratios here are per-second instantaneous values. Placing two time scales side by side guarantees that their shapes differ, and the difference is then not attributable to the algorithm alone. The proxies are therefore drawn with a 3-second trailing mean — causal, never using future readings — to match the time scale of the device output. Across three real recordings (52–91 valid readings each) this raised the rank correlation between the attention proxy and Attention from 0.68 / 0.44 / 0.45 to 0.89 / 0.71 / 0.67, and between the relaxation proxy and Meditation from 0.18 / 0.50 / 0.39 to 0.29 / 0.61 / 0.59; extending the window beyond five seconds or centring it lowered both, so three seconds is kept. Smoothing applies to the displayed series only; the per-second values are stored with the recording unchanged."
  },
  "量綱與可比性：頻段值為廠商歸一化之相對功率，其歸一化與平滑方式未公開，絕對量級僅於同一設備、同一工作階段內具可比性；取比值可消去共模功率，頻帶比值之判別力在文獻中較佳 [8]，故本頁不採絕對功率；E 與 A 為無因次量，僅宜於同一序列內比較趨勢。": {
    "zh-Hans": "量纲与可比性：频段值为厂商归一化之相对功率，其归一化与平滑方式未公开，绝对量级仅于同一设备、同一工作阶段内具可比性；取比值可消去共模功率，频带比值之判别力在文献中较佳 [8]，故本页不采绝对功率；E 与 A 为无因次量，仅宜于同一序列内比较趋势。",
    "en": "Units and comparability: the band values are vendor-normalised relative power whose normalisation and smoothing are undisclosed, so absolute levels are comparable only within one device and one working session. A ratio removes the common-mode power, and band ratios discriminate better in the literature [8], so absolute power is not used here; E and A are dimensionless and are only comparable as trends within one sequence."
  },
  "計算規則：任一輸入缺失或為非有限值時輸出空值並中止連線，不施行插值或以零替代；分母不大於零時輸出空值，不產生無限大或非數值；舊記錄或非 TGAM 來源僅提供聚合 α／β 時，回退採用聚合值，公式與語義不變。": {
    "zh-Hans": "计算规则：任一输入缺失或为非有限值时输出空值并中止连线，不施行插值或以零替代；分母不大于零时输出空值，不产生无限大或非数值；旧记录或非 TGAM 来源仅提供聚合 α／β 时，回退采用聚合值，公式与语义不变。",
    "en": "Computation rules: any missing or non-finite input yields an empty value and terminates the line, with no interpolation and no zero substitution; a denominator of zero or less yields an empty value rather than infinity or NaN; when older recordings or non-TGAM sources provide only aggregate α/β, the aggregate is used and the formula and its meaning are unchanged."
  },
  "判讀規則：兩路徑輸出之同向性可作為交叉參照；若出現系統性背離，應優先歸因於本頁未建模之成分（自適應基線、時域特徵、偽跡處理），而非逕行裁決其一為誤。兩者數值不具換算關係。": {
    "zh-Hans": "判读规则：两路径输出之同向性可作为交叉参照；若出现系统性背离，应优先归因于本页未建模之成分（自适应基线、时域特征、伪迹处理），而非径行裁决其一为误。两者数值不具换算关系。",
    "en": "Reading rules: agreement in direction between the two paths serves as a cross-reference; a systematic divergence should first be attributed to components this page does not model — adaptive baseline, time-domain features, artefact handling — rather than resolved by declaring one of them wrong. The two sets of values are not convertible."
  },
  "適用範圍：本介面為單通道前額採集，僅能描述前額中線與整體節律；不能計算左右半球不對稱（FAA）[9]，亦不能分離眼動、肌電與心電偽跡。所有讀數僅供研究觀測，不構成臨床診斷。": {
    "zh-Hans": "适用范围：本界面为单通道前额采集，仅能描述前额中线与整体节律；不能计算左右半球不对称（FAA）[9]，亦不能分离眼动、肌电与心电伪迹。所有读数仅供研究观测，不构成临床诊断。",
    "en": "Scope: this console records from a single frontal channel, so it describes the frontal midline and global rhythms only; it cannot compute hemispheric asymmetry (FAA) [9] or separate eye, muscle and cardiac artefacts. Every reading is a research observation, not a clinical diagnosis."
  },
  "Delta · δ": {
    "zh-Hans": "Delta · δ",
    "en": "Delta · δ"
  },
  "慢波，深睡（N3）主導，清醒時多為低幅背景。": {
    "zh-Hans": "慢波，深睡（N3）主导，清醒时多为低幅背景。",
    "en": "Slow waves, dominant in deep (N3) sleep and a low-amplitude background when awake."
  },
  "清醒時前額 delta 升高多與疲勞、眼動或出汗偽跡相關，不宜單獨當認知指標。": {
    "zh-Hans": "清醒时前额 delta 升高多与疲劳、眼动或出汗伪迹相关，不宜单独当认知指标。",
    "en": "In wakefulness a frontal delta rise mostly tracks fatigue, eye movements or sweat artefacts; it is not a stand-alone cognitive index."
  },
  "Theta · θ": {
    "zh-Hans": "Theta · θ",
    "en": "Theta · θ"
  },
  "困倦與入睡過渡的低頻節律。": {
    "zh-Hans": "困倦与入睡过渡的低频节律。",
    "en": "A low-frequency rhythm of drowsiness and the transition into sleep."
  },
  "前額中線 theta 與工作記憶、認知控制及錯誤監控相關；升高不必然是「更專注」。": {
    "zh-Hans": "前额中线 theta 与工作记忆、认知控制及错误监控相关；升高不必然是「更专注」。",
    "en": "Frontal midline theta relates to working memory, cognitive control and error monitoring; a rise is not necessarily more focus."
  },
  "Low Alpha · 8–10 Hz": {
    "zh-Hans": "Low Alpha · 8–10 Hz",
    "en": "Low Alpha · 8–10 Hz"
  },
  "Alpha 的低頻段，放鬆閉眼時最明顯。": {
    "zh-Hans": "Alpha 的低频段，放松闭眼时最明显。",
    "en": "The lower alpha band, most visible during relaxed eyes-closed rest."
  },
  "閉眼放鬆時升高，任務投入或注意外放時下降；單通道前額不能做左右不對稱分析。": {
    "zh-Hans": "闭眼放松时升高，任务投入或注意外放时下降；单通道前额不能做左右不对称分析。",
    "en": "Rises with relaxed eyes closed and falls with task engagement; a single frontal channel cannot assess hemispheric asymmetry."
  },
  "High Alpha · 10–13 Hz": {
    "zh-Hans": "High Alpha · 10–13 Hz",
    "en": "High Alpha · 10–13 Hz"
  },
  "Alpha 的高頻段，對警覺變化較敏感。": {
    "zh-Hans": "Alpha 的高频段，对警觉变化较敏感。",
    "en": "The upper alpha band, more sensitive to changes in vigilance."
  },
  "與低頻 Alpha 同步升高多見於安靜閉眼；快速下降常先於注意轉向。": {
    "zh-Hans": "与低频 Alpha 同步升高多见于安静闭眼；快速下降常先于注意转向。",
    "en": "Rising together with low alpha is typical of quiet eyes-closed rest; a rapid drop often precedes a shift of attention."
  },
  "Low Beta · 13–20 Hz": {
    "zh-Hans": "Low Beta · 13–20 Hz",
    "en": "Low Beta · 13–20 Hz"
  },
  "Beta 的低頻段，與主動思考、運動準備相關。": {
    "zh-Hans": "Beta 的低频段，与主动思考、运动准备相关。",
    "en": "The lower beta band, linked to active thinking and motor preparation."
  },
  "認知投入或需要維持反應時升高；與 Alpha 常呈反向走勢。": {
    "zh-Hans": "认知投入或需要维持反应时升高；与 Alpha 常呈反向走势。",
    "en": "Rises with cognitive engagement or sustained response demand; it often moves opposite to alpha."
  },
  "High Beta · 20–30 Hz": {
    "zh-Hans": "High Beta · 20–30 Hz",
    "en": "High Beta · 20–30 Hz"
  },
  "Beta 的高頻段，緊張與高負荷時活躍。": {
    "zh-Hans": "Beta 的高频段，紧张与高负荷时活跃。",
    "en": "The upper beta band, active under tension and high load."
  },
  "升高可反映緊張或高負荷，也極易混入額肌肌電，解讀須保守。": {
    "zh-Hans": "升高可反映紧张或高负荷，也极易混入额肌肌电，解读须保守。",
    "en": "A rise may reflect tension or high load, and is easily contaminated by frontal muscle activity."
  },
  "Low Gamma · 30–40 Hz 量級": {
    "zh-Hans": "Low Gamma · 30–40 Hz 量级",
    "en": "Low Gamma · 30–40 Hz order"
  },
  "Gamma 的低頻段，與注意及跨區整合相關。": {
    "zh-Hans": "Gamma 的低频段，与注意及跨区整合相关。",
    "en": "The lower gamma band, associated with attention and cross-regional integration."
  },
  "消費級單通道極易受肌電污染，只宜作趨勢參考，不作認知結論。": {
    "zh-Hans": "消费级单通道极易受肌电污染，只宜作趋势参考，不作认知结论。",
    "en": "Consumer single-channel recordings are highly prone to EMG contamination; treat them as a trend only."
  },
  "Mid Gamma · 40–50 Hz 量級": {
    "zh-Hans": "Mid Gamma · 40–50 Hz 量级",
    "en": "Mid Gamma · 40–50 Hz order"
  },
  "Gamma 的高頻段，信噪比低於低頻段。": {
    "zh-Hans": "Gamma 的高频段，信噪比低于低频段。",
    "en": "The upper gamma band, with lower signal-to-noise than the lower band."
  },
  "同樣易受肌電影響；本頁僅呈現設備回報值，不推導臨床或情緒結論。": {
    "zh-Hans": "同样易受肌电影响；本页仅呈现设备回报值，不推导临床或情绪结论。",
    "en": "Also EMG-prone; this page reports device values only and infers no clinical or emotional conclusion."
  },
  "僅繪製接觸良好且有效的設備指數；下方頻段和原始波形保留採集數值，接觸不良時不做音樂映射。": {
    "zh-Hans": "仅绘制接触良好且有效的设备指数；下方频段和原始波形保留采集数值，接触不良时不做音乐映射。",
    "en": "Plots only valid device indices under good contact; raw waveforms preserved below without music mapping on poor contact."
  },
  "RAW EEG / 有符號原始腦電": {
    "zh-Hans": "RAW EEG / 有符号原始脑电",
    "en": "RAW EEG / Signed Raw EEG"
  },
  "有符號原始腦電": {
    "zh-Hans": "有符号原始脑电",
    "en": "Signed Raw EEG"
  },
  "等待原始樣本": {
    "zh-Hans": "等待原始样本",
    "en": "Waiting for raw samples"
  },
  "窗口": {
    "zh-Hans": "窗口",
    "en": "Window"
  },
  "2 秒": {
    "zh-Hans": "2 秒",
    "en": "2 sec"
  },
  "8 秒": {
    "zh-Hans": "8 秒",
    "en": "8 sec"
  },
  "縱軸 ±": {
    "zh-Hans": "纵轴 ±",
    "en": "Vertical Axis ±"
  },
  "自動保持": {
    "zh-Hans": "自动保持",
    "en": "Auto Hold"
  },
  "原始腦電：零線、正負振幅與缺失斷點": {
    "zh-Hans": "原始脑电：零线、正负振幅与缺失断点",
    "en": "Raw EEG: baseline, signed amplitudes, and gaps"
  },
  "零線上下保留正負方向；秒軸由來源採樣率與樣本序號推算。顯示倍率不代表設備電壓增益。": {
    "zh-Hans": "零线上下保留正负方向；秒轴由来源采样率与样本序号推算。显示倍率不代表设备电压增益。",
    "en": "Zero-line preserves polarity; time axis derived from sample rate and sequence. Scale does not imply voltage gain."
  },
  "頻段顯示": {
    "zh-Hans": "频段显示",
    "en": "Band Display"
  },
  "原始相對功率": {
    "zh-Hans": "原始相对功率",
    "en": "Raw Relative Power"
  },
  "基線偏移": {
    "zh-Hans": "基线偏移",
    "en": "Baseline Offset"
  },
  "基線＝當前60秒窗口最早10個有效值的均值；負值表示低於基線。": {
    "zh-Hans": "基线＝当前60秒窗口最早10个有效值的均值；负值表示低于基线。",
    "en": "Baseline = mean of first 10 valid values in 60s window; negative indicates below baseline."
  },
  "保存波形 PNG": {
    "zh-Hans": "保存波形 PNG",
    "en": "Save Waveform PNG"
  },
  "保存透明遮罩": {
    "zh-Hans": "保存透明遮罩",
    "en": "Save Transparent Mask"
  },
  "匯出 CSV ↗": {
    "zh-Hans": "导出 CSV ↗",
    "en": "Export CSV ↗"
  },
  "最近 60 秒 · 收到多少，顯示多少": {
    "zh-Hans": "最近 60 秒 · 收到多少，显示多少",
    "en": "Last 60s · displays whatever is received"
  },
  "完整 Spout 即時輸出由獨立桌面波形工具提供。瀏覽器可保存透明 PNG；不宣稱瀏覽器直接輸出 Spout。": {
    "zh-Hans": "完整 Spout 实时输出由独立桌面波形工具提供。浏览器可保存透明 PNG；不宣称浏览器直接输出 Spout。",
    "en": "Live Spout output is provided by the standalone desktop tool. Browser saves transparent PNG; direct browser Spout not claimed."
  },
  "音樂與神經響應研究": {
    "zh-Hans": "音乐与神经响应研究",
    "en": "Music & Neural Response Study"
  },
  "採集記錄與創作方案": {
    "zh-Hans": "采集记录与创作方案",
    "en": "Acquisition Records & Plans"
  },
  "記錄 JSON": {
    "zh-Hans": "记录 JSON",
    "en": "Record JSON"
  },
  "記錄 CSV": {
    "zh-Hans": "记录 CSV",
    "en": "Record CSV"
  },
  "專注 × 冥想／放鬆": {
    "zh-Hans": "专注 × 冥想／放松",
    "en": "Attention × Meditation"
  },
  "專注 × 冥想／放鬆 ": {
    "zh-Hans": "专注 × 冥想／放松 ",
    "en": "Attention × Meditation "
  },
  "展示": {
    "zh-Hans": "展示",
    "en": "Exhibit"
  },
  "返回": {
    "zh-Hans": "返回",
    "en": "Back"
  },
  "座標": {
    "zh-Hans": "坐标",
    "en": "Coordinates"
  },
  "原生指數 · 0–100": {
    "zh-Hans": "原生指数 · 0–100",
    "en": "Native Index · 0–100"
  },
  "坐標換算 · 0–127": {
    "zh-Hans": "坐标换算 · 0–127",
    "en": "Control Range · 0–127"
  },
  "觀察窗口": {
    "zh-Hans": "观察窗口",
    "en": "Observation Window"
  },
  "60 秒": {
    "zh-Hans": "60 秒",
    "en": "60 sec"
  },
  "30 秒": {
    "zh-Hans": "30 秒",
    "en": "30 sec"
  },
  "10 秒": {
    "zh-Hans": "10 秒",
    "en": "10 sec"
  },
  "顯示平滑": {
    "zh-Hans": "显示平滑",
    "en": "Display Smoothing"
  },
  "原始位置 · 預設": {
    "zh-Hans": "原始位置 · 默认",
    "en": "Raw Position · Default"
  },
  "0.75 秒 · 僅顯示": {
    "zh-Hans": "0.75 秒 · 仅显示",
    "en": "0.75 sec · Display Only"
  },
  "2 秒 · 僅顯示": {
    "zh-Hans": "2 秒 · 仅显示",
    "en": "2 sec · Display Only"
  },
  "採樣軌跡 · 舊 → 新": {
    "zh-Hans": "采样轨迹 · 旧 → 新",
    "en": "Sample Trajectory · Old → New"
  },
  "形狀由有效樣本決定": {
    "zh-Hans": "形状由有效样本决定",
    "en": "Shape determined by valid samples"
  },
  "原生指數 · 中心 50, 50": {
    "zh-Hans": "原生指数 · 中心 50, 50",
    "en": "Native Index · Center 50, 50"
  },
  "坐標換算 · 中心 64, 64": {
    "zh-Hans": "坐标换算 · 中心 64, 64",
    "en": "Control Range · Center 64, 64"
  },
  "神經蠕蟲XY軌跡，按所選座標呈現採樣節點；點選可查看歷史樣本": {
    "zh-Hans": "神经蠕虫XY轨迹，按所选坐标呈现采样节点；点选可查看历史样本",
    "en": "Neural worm XY trajectory plotting sample nodes; click to inspect historical samples"
  },
  "等待有效腦波": {
    "zh-Hans": "等待有效脑波",
    "en": "Waiting for valid EEG"
  },
  "跟隨最新": {
    "zh-Hans": "跟随最新",
    "en": "Follow Live"
  },
  "查看歷史樣本": {
    "zh-Hans": "查看历史样本",
    "en": "Inspect History"
  },
  "等待樣本": {
    "zh-Hans": "等待样本",
    "en": "Waiting for samples"
  },
  "保存蠕蟲 PNG ↗": {
    "zh-Hans": "保存蠕虫 PNG ↗",
    "en": "Save Worm PNG ↗"
  },
  "可復算的窗口觀測": {
    "zh-Hans": "可复算的窗口观测",
    "en": "Verifiable Window Observations"
  },
  "XY · 當前坐標": {
    "zh-Hans": "XY · 当前坐标",
    "en": "XY · Current Coordinates"
  },
  "有效樣本數": {
    "zh-Hans": "有效样本数",
    "en": "Valid Sample Count"
  },
  "時間加權標準距離": {
    "zh-Hans": "时间加权标准距离",
    "en": "Time-Weighted Standard Distance"
  },
  "有效觀察 / 窗口": {
    "zh-Hans": "有效观察 / 窗口",
    "en": "Valid Coverage / Window"
  },
  "接收有效指數後呈現起點、終點和變化。": {
    "zh-Hans": "接收有效指数后呈现起点、终点和变化。",
    "en": "Displays start, end and trajectory changes after receiving valid indices."
  },
  "音高中心與旋律走向": {
    "zh-Hans": "音高中心与旋律走向",
    "en": "Pitch Center & Melodic Contour"
  },
  "所選樣本時間": {
    "zh-Hans": "所选样本时间",
    "en": "Selected Sample Time"
  },
  "顯示方式": {
    "zh-Hans": "显示方式",
    "en": "Display Mode"
  },
  "原始位置": {
    "zh-Hans": "原始位置",
    "en": "Raw Position"
  },
  "僅顯示": {
    "zh-Hans": "仅显示",
    "en": "Display Only"
  },
  "十要素": {
    "zh-Hans": "十要素",
    "en": "Ten Elements"
  },
  "旋律": {
    "zh-Hans": "旋律",
    "en": "Melody"
  },
  "節奏": {
    "zh-Hans": "节奏",
    "en": "Rhythm"
  },
  "和聲": {
    "zh-Hans": "和声",
    "en": "Harmony"
  },
  "力度": {
    "zh-Hans": "力度",
    "en": "Dynamics"
  },
  "力度／響度": {
    "zh-Hans": "力度／响度",
    "en": "Dynamics / Loudness"
  },
  "速度": {
    "zh-Hans": "速度",
    "en": "Tempo"
  },
  "調式": {
    "zh-Hans": "调式",
    "en": "Mode"
  },
  "曲式": {
    "zh-Hans": "曲式",
    "en": "Form"
  },
  "織體": {
    "zh-Hans": "织体",
    "en": "Texture"
  },
  "音色": {
    "zh-Hans": "音色",
    "en": "Timbre"
  },
  "演奏法": {
    "zh-Hans": "演奏法",
    "en": "Articulation"
  },
  "內容": {
    "zh-Hans": "内容",
    "en": "Content"
  },
  "創作方案": {
    "zh-Hans": "创作方案",
    "en": "Creative Plan"
  },
  "音樂觀測": {
    "zh-Hans": "音乐观测",
    "en": "Music Observation"
  },
  "方案": {
    "zh-Hans": "方案",
    "en": "Plan"
  },
  "舒緩": {
    "zh-Hans": "舒缓",
    "en": "Gentle"
  },
  "明快": {
    "zh-Hans": "明快",
    "en": "Bright"
  },
  "沉靜": {
    "zh-Hans": "沉静",
    "en": "Reflective"
  },
  "張力": {
    "zh-Hans": "张力",
    "en": "Tension"
  },
  "匯入規則": {
    "zh-Hans": "导入规则",
    "en": "Import Rules"
  },
  "匯入音樂方案規則": {
    "zh-Hans": "导入音乐方案规则",
    "en": "Import Music Plan Rules"
  },
  "恢復手動": {
    "zh-Hans": "恢复手动",
    "en": "Reset Manual"
  },
  "課件音樂方案": {
    "zh-Hans": "课件音乐方案",
    "en": "Courseware Music Plans"
  },
  "本層音樂關鍵詞": {
    "zh-Hans": "本层音乐关键词",
    "en": "Keywords for this element"
  },
  "圖形、數據與研究來源": {
    "zh-Hans": "图形、数据与研究来源",
    "en": "Graphics, Data & Research Sources"
  },
  "逐項證據、公式與資料規格 ↗": {
    "zh-Hans": "逐项证据、公式与数据规格 ↗",
    "en": "Evidence, Formulas & Specifications ↗"
  },
  "整理可追溯的觀測摘要": {
    "zh-Hans": "整理可追溯的观测摘要",
    "en": "Compile Traceable Observation Summary"
  },
  "輸出來源、時間、原始指數與音樂資料缺失。不由EEG指定音樂要素，後續創作需另提供需求或經校準模型。": {
    "zh-Hans": "输出来源、时间、原始指数与音乐数据缺失。不由EEG指定音乐要素，后续创作需另提供需求或经校准模型。",
    "en": "Outputs source, timestamps, raw indices and observation gaps. Music parameters are never inferred from EEG."
  },
  "目標模型": {
    "zh-Hans": "目标模型",
    "en": "Target Model"
  },
  "通用": {
    "zh-Hans": "通用",
    "en": "Generic"
  },
  "韶元 Shao": {
    "zh-Hans": "韶元 Shao",
    "en": "Shao Yuan"
  },
  "最近 60 秒": {
    "zh-Hans": "最近 60 秒",
    "en": "Last 60s"
  },
  "最近 30 秒": {
    "zh-Hans": "最近 30 秒",
    "en": "Last 30s"
  },
  "最近 10 秒": {
    "zh-Hans": "最近 10 秒",
    "en": "Last 10s"
  },
  "每 60 秒整理一次觀測摘要": {
    "zh-Hans": "每 60 秒整理一次观测摘要",
    "en": "Auto-summarize every 60s"
  },
  "手動產生": {
    "zh-Hans": "手动生成",
    "en": "Manual"
  },
  "整理摘要": {
    "zh-Hans": "整理摘要",
    "en": "Summarize"
  },
  "複製文字": {
    "zh-Hans": "复制文字",
    "en": "Copy Text"
  },
  "匯出觀測 JSON ↗": {
    "zh-Hans": "导出观测 JSON ↗",
    "en": "Export Observation JSON ↗"
  },
  "觀測摘要與缺失記錄": {
    "zh-Hans": "观测摘要与缺失记录",
    "en": "Observation Summary & Missing Records"
  },
  "先接收有效資料，再產生摘要。": {
    "zh-Hans": "先接收有效数据，再生成摘要。",
    "en": "Receive valid data first before generating summary."
  },
  "等待產生": {
    "zh-Hans": "等待生成",
    "en": "Waiting to generate"
  },
  "先以手動交接完成驗證。頁面不會呼叫雲端模型，也不會把示範或回放資料當成實測。": {
    "zh-Hans": "先以手动交接完成验证。页面不会呼叫云端模型，也不会把示范或回放数据当成实测。",
    "en": "Verify via manual handoff. The console makes no cloud API calls and never treats demo/replay as live measurements."
  },
  "設備與資料接口": {
    "zh-Hans": "设备与数据接口",
    "en": "Device & Data Interfaces"
  },
  "設備狀態": {
    "zh-Hans": "设备状态",
    "en": "Device Status"
  },
  "真實 EEG 設備": {
    "zh-Hans": "EEG 设备",
    "en": "EEG Device"
  },
  "EEG 設備": {
    "zh-Hans": "EEG 设备",
    "en": "EEG Device"
  },
  "設備連接": {
    "zh-Hans": "设备连接",
    "en": "Device Connection"
  },
  "EEG 設備連接": {
    "zh-Hans": "EEG 设备连接",
    "en": "EEG Device Connection"
  },
  "本機採集器狀態": {
    "zh-Hans": "本机采集器状态",
    "en": "Local Collector Status"
  },
  "本機採集器隨桌面應用啟動；純網頁預覽不會啟動 EEG 硬體。": {
    "zh-Hans": "本机采集器随桌面应用启动；纯网页预览不会启动 EEG 硬件。",
    "en": "The local collector starts with the desktop app; a browser-only preview does not start EEG hardware."
  },
  "選擇設備並連接後，接收資料會即時顯示在下方監控區；連線不會自動開始本地記錄。": {
    "zh-Hans": "选择设备并连接后，接收数据会实时显示在下方监控区；连接不会自动开始本地记录。",
    "en": "Incoming data appears in the monitor below after connection. Connecting does not automatically start local recording."
  },
  "支援標準 ThinkGear 資料封包；專有協議請使用對應桌面採集器。": {
    "zh-Hans": "支持标准 ThinkGear 数据包；专有协议请使用对应桌面采集器。",
    "en": "Supports standard ThinkGear packets; use the matching desktop acquisition service for proprietary protocols."
  },
  "串口波特率": {
    "zh-Hans": "串口波特率",
    "en": "Serial baud rate"
  },
  "57600 · TGAM 推薦": {
    "zh-Hans": "57600 · TGAM 推荐",
    "en": "57600 · Recommended for TGAM"
  },
  "115200 · 高速設備": {
    "zh-Hans": "115200 · 高速设备",
    "en": "115200 · High-speed devices"
  },
  "9600 · 低速設備（可能缺原始波形）": {
    "zh-Hans": "9600 · 低速设备（可能缺原始波形）",
    "en": "9600 · Low-speed devices (may omit raw waveform)"
  },
  "保存目錄已就緒": {
    "zh-Hans": "保存目录已就绪",
    "en": "Storage ready"
  },
  "保存目錄不可用": {
    "zh-Hans": "保存目录不可用",
    "en": "Storage unavailable"
  },
  "尚未選擇可用目錄": {
    "zh-Hans": "尚未选择可用目录",
    "en": "No usable folder chosen yet"
  },
  "請先設定可寫入的記錄保存目錄": {
    "zh-Hans": "请先设置可写入的记录保存目录",
    "en": "Choose a writable recording folder first"
  },
  "記錄保存目錄": {
    "zh-Hans": "记录保存目录",
    "en": "Recording Folder"
  },
  "留空＝使用專案目錄下的 EEG Data": {
    "zh-Hans": "留空＝使用项目目录下的 EEG Data",
    "en": "Leave empty to use EEG Data inside the project"
  },
  "套用保存目錄": {
    "zh-Hans": "应用保存目录",
    "en": "Apply Folder"
  },
  "轉換完成": {
    "zh-Hans": "转换完成",
    "en": "Conversion complete"
  },
  "轉換失敗": {
    "zh-Hans": "转换失败",
    "en": "Conversion failed"
  },
  "停止 EEG USB": {
    "zh-Hans": "停止 EEG USB",
    "en": "Stop EEG USB"
  },
  "啟動 EEG USB": {
    "zh-Hans": "启动 EEG USB",
    "en": "Start EEG USB"
  },
  "停止 腦電 BLE": {
    "zh-Hans": "停止 脑电 BLE",
    "en": "Stop EEG BLE"
  },
  "啟動 腦電 BLE": {
    "zh-Hans": "启动 脑电 BLE",
    "en": "Start EEG BLE"
  },
  "開始采集": {
    "zh-Hans": "开始采集",
    "en": "Start Acquisition"
  },
  "停止采集": {
    "zh-Hans": "停止采集",
    "en": "Stop Acquisition"
  },
  "已識別 · 等待開始": {
    "zh-Hans": "已识别 · 等待开始",
    "en": "Identified · waiting for start"
  },
  "請先按「開始采集」以連接已識別的設備。": {
    "zh-Hans": "请先按「开始采集」以连接已识别的设备。",
    "en": "Press Start Acquisition to connect the identified device."
  },
  "已保存身份 · 本次掃描未發現": {
    "zh-Hans": "已保存身份 · 本次扫描未发现",
    "en": "Saved identity · not seen in this scan"
  },
  "設備身份已保存，採集器已重新識別設備。": {
    "zh-Hans": "设备身份已保存，采集器已重新识别设备。",
    "en": "Device identity saved; the collector re-identified the device."
  },
  "重新載入": {
    "zh-Hans": "重新加载",
    "en": "Reload page"
  },
  "重新載入本頁，等同 Cmd+R": {
    "zh-Hans": "重新加载本页，等同 Cmd+R",
    "en": "Reload this page (same as Cmd+R)"
  },
  "保存未完成": {
    "zh-Hans": "保存未完成",
    "en": "Save did not complete"
  },
  "設備會自動識別，但不會自動開始傳送。按「開始采集」才會開啟已識別的連線；再次按「停止采集」即停止。USB 正在傳送資料時，採集器會讓藍牙暫停掃描；要看藍牙請先停掉 USB。面板卡住或畫面與設備不同步時按「重新載入」，即重新載入本頁（等同 Cmd+R），採集不會中斷。設備一經選定即時寫入，不需要另按保存。": {
    "zh-Hans": "设备会自动识别，但不会自动开始传送。按「开始采集」才会开启已识别的连线；再次按「停止采集」即停止。USB 正在传输资料时，采集器会让蓝牙暂停扫描；要看蓝牙请先停掉 USB。面板卡住或画面与设备不同步时按「重新加载」，即重新加载本页（等同 Cmd+R），采集不会中断。设备一经选定即时写入，不需要另按保存。",
    "en": "Devices are identified automatically but never start on their own. Press Start acquisition to open the identified connection; press Stop acquisition to close it. While USB is streaming the collector pauses Bluetooth scanning; stop EEG USB first to scan. If Bluetooth is stuck or will not connect, press Refresh devices: the collector drops the link and scans again. A selected device is written through immediately; there is no separate save step."
  },
  "等待設備連接": {
    "zh-Hans": "等待设备连接",
    "en": "Waiting for a device"
  },
  "等待 EEG 設備資料": {
    "zh-Hans": "等待 EEG 设备资料",
    "en": "Waiting for EEG device data"
  },
  "命名規範：僅保留英文字母、數字、點、底線與連字號；其餘連續字符合併為一個連字號，去除首尾的連字號、點與底線，最長 64 個字符，留空則使用 unknown-device。設備名稱取前十個字符，USB 與藍牙一致。「記錄用設備標識」在標識還是空的時候，預設填入該前十位並即時寫入；一旦有了標識就沿用它，換設備（例如藍牙中斷改用 USB）不會自動改名，要改名請改寫後按「應用設備名稱」。記錄文件名為「eeg-標識-開始時間.tgam」，例如 eeg-SOA-FA758-20261018-171500.tgam。": {
    "zh-Hans": "命名规范：仅保留英文字母、数字、点、下划线与连字号；其余连续字符合并为一个连字号，去除首尾的连字号、点与下划线，最长 64 个字符，留空则使用 unknown-device。设备名称取前十个字符，USB 与蓝牙一致。「记录用设备标识」在标识还是空的时候，预设填入该前十位并即时写入；一旦有了标识就沿用它，换设备（例如蓝牙中断改用 USB）不会自动改名，要改名请改写后按「应用设备名称」。记录文件名为「eeg-标识-开始时间.tgam」，例如 eeg-SOA-FA758-20261018-171500.tgam。",
    "en": "Naming rule: keep ASCII letters, digits, dot, underscore and hyphen; collapse every other run into a single hyphen; trim leading and trailing -._ ; cap at 64 characters; empty falls back to unknown-device. Device names are cut to their first ten characters, for USB and Bluetooth alike. While the recording label is empty it is filled with those ten characters and written through immediately; once it is set the label is kept, so changing hardware — Bluetooth dropping to the USB cable, say — never renames a recording. To rename, edit the field and press Apply name. Sessions are written as eeg-<label>-<start>.tgam, for example eeg-SOA-FA758-20261018-171500.tgam."
  },
  "已寫入採集器": {
    "zh-Hans": "已写入采集器",
    "en": "Written to the collector"
  },
  "目前設備": {
    "zh-Hans": "当前设备",
    "en": "connected device"
  },
  "但檔名仍沿用此標識": {
    "zh-Hans": "但文件名仍沿用此标识",
    "en": "but the file name keeps this label"
  },
  "尚未寫入採集器": {
    "zh-Hans": "尚未写入采集器",
    "en": "Not written to the collector yet"
  },
  "按「應用設備名稱」生效": {
    "zh-Hans": "按「应用设备名称」生效",
    "en": "press Apply name to apply"
  },
  "應用設備名稱": {
    "zh-Hans": "应用设备名称",
    "en": "Apply name"
  },
  "目前標識已生效": {
    "zh-Hans": "目前标识已生效",
    "en": "This name is already in force"
  },
  "設備": {
    "zh-Hans": "设备",
    "en": "Device"
  },
  "藍牙": {
    "zh-Hans": "蓝牙",
    "en": "Bluetooth"
  },
  "設備 · 未連接": {
    "zh-Hans": "设备 · 未连接",
    "en": "Device · not connected"
  },
  "將正規化為": {
    "zh-Hans": "将规范化为",
    "en": "Will be normalized to"
  },
  "記錄檔名": {
    "zh-Hans": "记录文件名",
    "en": "File name"
  },
  "藍牙采集未啟動 · 按「啟動 腦電 BLE」開始掃描": {
    "zh-Hans": "蓝牙采集未启动 · 按「启动 脑电 BLE」开始扫描",
    "en": "Bluetooth is off · press Start EEG BLE to scan"
  },
  "USB 正在傳送 · 藍牙掃描暫停；先按「停止 EEG USB」": {
    "zh-Hans": "USB 正在传输 · 蓝牙扫描暂停；先按「停止 EEG USB」",
    "en": "USB is streaming · Bluetooth scanning is paused; stop EEG USB first"
  },
  "正在掃描藍牙設備": {
    "zh-Hans": "正在扫描蓝牙设备",
    "en": "Scanning for Bluetooth devices"
  },
  "已識別藍牙設備 · 等待按「開始采集」": {
    "zh-Hans": "已识别蓝牙设备 · 等待按「开始采集」",
    "en": "Bluetooth device identified · waiting for Start"
  },
  "藍牙已連線並收到有效資料": {
    "zh-Hans": "蓝牙已连接并收到有效数据",
    "en": "Bluetooth connected with valid data"
  },
  "正在連接藍牙設備 · 稍候": {
    "zh-Hans": "正在连接蓝牙设备 · 稍候",
    "en": "Connecting to the Bluetooth device…"
  },
  "藍牙已連線 · 等待有效資料": {
    "zh-Hans": "蓝牙已连接 · 等待有效数据",
    "en": "Bluetooth connected · waiting for valid data"
  },
  "藍牙已連線 · 但收到的不是 ThinkGear 資料": {
    "zh-Hans": "蓝牙已连接 · 但收到的不是 ThinkGear 数据",
    "en": "Bluetooth connected · but the data is not ThinkGear"
  },
  "藍牙連線中斷 · 正在自動重試": {
    "zh-Hans": "蓝牙连接中断 · 正在自动重试",
    "en": "Bluetooth link dropped · retrying automatically"
  },
  "已保存的藍牙身份本次未出現 · 可在清單重新選擇": {
    "zh-Hans": "已保存的蓝牙身份本次未出现 · 可在清单重新选择",
    "en": "The saved Bluetooth identity did not appear · pick another row"
  },
  "附近的藍牙設備名稱不符 · 可在清單直接選擇": {
    "zh-Hans": "附近的蓝牙设备名称不符 · 可在清单直接选择",
    "en": "Nearby Bluetooth names do not match · pick one from the list"
  },
  "本次掃描未發現藍牙設備 · 檢查藍牙電源與系統權限": {
    "zh-Hans": "本次扫描未发现蓝牙设备 · 检查蓝牙电源与系统权限",
    "en": "No Bluetooth device found · check pairing and system permission"
  },
  "台藍牙設備": {
    "zh-Hans": "台蓝牙设备",
    "en": "Bluetooth devices"
  },
  "多台藍牙設備同名 · 請在清單指定身份": {
    "zh-Hans": "多台蓝牙设备同名 · 请在清单指定身份",
    "en": "Several Bluetooth devices share a name · pick one explicitly"
  },
  "已保存身份": {
    "zh-Hans": "已保存身份",
    "en": "Saved identity"
  },
  "尚未保存": {
    "zh-Hans": "尚未保存",
    "en": "Not saved yet"
  },
  "系統未授權藍牙訪問 · 允許後重新按「啟動 腦電 BLE」": {
    "zh-Hans": "系统未授权蓝牙访问 · 允许后重新按「启动 脑电 BLE」",
    "en": "Bluetooth access is not granted · allow it, then press Start EEG BLE again"
  },
  "系統未授權藍牙訪問；授權後重新啟動藍牙采集": {
    "zh-Hans": "系统未授权蓝牙访问；授权后重新启动蓝牙采集",
    "en": "Bluetooth access is not granted; allow it and restart Bluetooth acquisition"
  },
  "尚未配置設備型號": {
    "zh-Hans": "尚未配置设备型号",
    "en": "Device model is not configured"
  },
  "尚未識別相容設備；檢查電源、資料線及廠商驅動": {
    "zh-Hans": "尚未识别相容设备；检查电源、数据线及厂商驱动",
    "en": "No compatible device identified; check power, cable and vendor driver"
  },
  "已保存設備未出現；可重新選擇身份": {
    "zh-Hans": "已保存设备未出现；可重新选择身份",
    "en": "The saved device did not appear; pick an identity again"
  },
  "多台設備匹配，請選擇身份": {
    "zh-Hans": "多台设备匹配，请选择身份",
    "en": "Several devices match; choose an identity"
  },
  "尚無有效設備資料": {
    "zh-Hans": "尚无有效设备数据",
    "en": "No valid device data yet"
  },
  "有字節但無有效協議包；核對設備協議及波特率": {
    "zh-Hans": "有字节但无有效协议包；核对设备协议及波特率",
    "en": "Bytes arrive without valid packets; check protocol and baud rate"
  },
  "端口被占用或權限不足；關閉其他采集程式並檢查權限": {
    "zh-Hans": "端口被占用或权限不足；关闭其他采集程序并检查权限",
    "en": "Port is busy or permission is missing; close other acquisition apps and check access"
  },
  "已斷線，采集器會重新識別": {
    "zh-Hans": "已断线，采集器会重新识别",
    "en": "Disconnected; the collector will identify the device again"
  },
  "藍牙不可用、權限或連接異常；檢查系統藍牙設定": {
    "zh-Hans": "蓝牙不可用、权限或连接异常；检查系统蓝牙设置",
    "en": "Bluetooth unavailable, denied or failing; check system Bluetooth settings"
  },
  "USB 正在傳送；藍牙掃描暫停": {
    "zh-Hans": "USB 正在传输；蓝牙扫描暂停",
    "en": "USB is streaming; Bluetooth scanning is paused"
  },
  "附近藍牙名稱不符；可在清單選擇": {
    "zh-Hans": "附近蓝牙名称不符；可在清单选择",
    "en": "Nearby Bluetooth names do not match; choose one from the list"
  },
  "已識別設備，等待按「開始采集」": {
    "zh-Hans": "已识别设备，等待按「开始采集」",
    "en": "Device identified; waiting for Start"
  },
  "腦電 USB": {
    "zh-Hans": "脑电 USB",
    "en": "EEG USB"
  },
  "血氧 USB": {
    "zh-Hans": "血氧 USB",
    "en": "SpO2 USB"
  },
  "GSR": {
    "zh-Hans": "GSR",
    "en": "GSR"
  },
  "腦電 BLE": {
    "zh-Hans": "脑电 BLE",
    "en": "EEG BLE"
  },
  "有效資料": {
    "zh-Hans": "有效数据",
    "en": "Valid data"
  },
  "封包": {
    "zh-Hans": "封包",
    "en": "packets"
  },
  "等待": {
    "zh-Hans": "等待",
    "en": "Waiting"
  },
  "附近的藍牙設備": {
    "zh-Hans": "附近的蓝牙设备",
    "en": "Nearby Bluetooth devices"
  },
  "自動識別相容設備（清除已保存身份）": {
    "zh-Hans": "自动识别相容设备（清除已保存身份）",
    "en": "Auto-detect (clear saved identity)"
  },
  "開始時間": {
    "zh-Hans": "开始时间",
    "en": "start time"
  },
  "啟動": {
    "zh-Hans": "启动",
    "en": "Start"
  },
  "停止": {
    "zh-Hans": "停止",
    "en": "Stop"
  },
  "只影響此處的瀏覽器直連；採集器使用自身設定。TGAM 設備請選 57600。": {
    "zh-Hans": "只影响此处的浏览器直连；采集器使用自身设置。TGAM 设备请选 57600。",
    "en": "Applies to this browser-direct path only; the collector uses its own setting. Choose 57600 for TGAM devices."
  },
  "瀏覽器直連波特率": {
    "zh-Hans": "浏览器直连波特率",
    "en": "Browser-direct baud rate"
  },
  "瀏覽器直連 · 後備": {
    "zh-Hans": "浏览器直连 · 后备",
    "en": "Browser Direct · Fallback"
  },
  "桌面採集器已自動連接設備時，此處可略過；僅在未啟動採集器時使用。": {
    "zh-Hans": "桌面采集器已自动连接设备时，此处可略过；仅在未启动采集器时使用。",
    "en": "Skip this section while the desktop collector has the device connected; use it only when no collector is running."
  },
  "即時資料監控": {
    "zh-Hans": "实时数据监控",
    "en": "Live Data Monitor"
  },
  "采集事实数据监控": {
    "zh-Hant": "採集事實資料監控",
    "zh-Hans": "采集事实数据监控",
    "en": "Acquisition Facts Monitor"
  },
  "监控只显示通过协议校验的 EEG 数据；每行按 100 毫秒聚合。自动存档保留设备收到的原始字节，包括未通过校验的数据，不重复保存解析后的 JSON。桌面采集器自动保存至用户数据目录的 EEG Data 文件夹；浏览器直连需先选择并授权保存目录。": {
    "zh-Hant": "監控只顯示通過協議校驗的 EEG 資料；每行按 100 毫秒聚合。自動存檔保留設備收到的原始位元組，包括未通過校驗的資料，不重複保存解析後的 JSON。桌面採集器自動保存至專案目錄下的 EEG Data 資料夾，實際路徑顯示於下方狀態列。",
    "zh-Hans": "监控只显示通过协议校验的 EEG 数据；每行按 100 毫秒聚合。自动存档保留设备收到的原始字节，包括未通过校验的数据，不重复保存解析后的 JSON。桌面采集器自动保存至项目目录下的 EEG Data 文件夹，实际路径显示于下方状态列。",
    "en": "The monitor shows only protocol-validated EEG data, aggregated in 100 ms rows. Archiving preserves received raw device bytes, including invalid frames, without duplicating parsed JSON. The desktop collector always saves to an EEG Data folder inside the project directory; its full path is shown in the status line below."
  },
  "监控只显示通过协议校验的 EEG 数据；每行按 100 毫秒聚合。自动存档保留设备收到的原始字节，包括未通过校验的数据，不重复保存解析后的 JSON。桌面采集器自动保存至项目目录下的 EEG Data 文件夹，实际路径显示于下方状态列。": {
    "zh-Hant": "監控只顯示通過協議校驗的 EEG 資料；每行按 100 毫秒聚合。自動存檔保留設備收到的原始位元組，包括未通過校驗的資料，不重複保存解析後的 JSON。桌面採集器自動保存至專案目錄下的 EEG Data 資料夾，實際路徑顯示於下方狀態列。",
    "zh-Hans": "监控只显示通过协议校验的 EEG 数据；每行按 100 毫秒聚合。自动存档保留设备收到的原始字节，包括未通过校验的数据，不重复保存解析后的 JSON。桌面采集器自动保存至项目目录下的 EEG Data 文件夹，实际路径显示于下方状态列。",
    "en": "The monitor shows only protocol-validated EEG data, aggregated in 100 ms rows. Archiving preserves received raw device bytes, including invalid frames, without duplicating parsed JSON. The desktop collector always saves to an EEG Data folder inside the project directory; its full path is shown in the status line below."
  },
  "选择浏览器保存目录": {
    "zh-Hant": "選擇瀏覽器保存目錄",
    "zh-Hans": "选择浏览器保存目录",
    "en": "Choose Browser Save Folder"
  },
  "尚未选择浏览器保存文件夹": {
    "zh-Hant": "尚未選擇瀏覽器保存資料夾",
    "zh-Hans": "尚未选择浏览器保存文件夹",
    "en": "No browser save folder selected"
  },
  "已選保存文件夾": {
    "zh-Hant": "已選保存資料夾",
    "zh-Hans": "已选保存文件夹",
    "en": "Selected save folder"
  },
  "已記住保存文件夾": {
    "zh-Hant": "已記住保存資料夾",
    "zh-Hans": "已记住保存文件夹",
    "en": "Remembered save folder"
  },
  "正在等待系統確認文件夾選擇": {
    "zh-Hant": "正在等待系統確認資料夾選擇",
    "zh-Hans": "正在等待系统确认文件夹选择",
    "en": "Waiting for the system to confirm the folder selection"
  },
  "瀏覽器未確認文件夾選擇，尚未取得保存授權。": {
    "zh-Hant": "瀏覽器未確認資料夾選擇，尚未取得保存授權。",
    "zh-Hans": "浏览器未确认文件夹选择，尚未取得保存授权。",
    "en": "The browser did not confirm the folder selection, so save permission was not granted."
  },
  "內置瀏覽器未返回所選文件夾，請在 Chrome 或 Edge 打開此頁後重新選擇。": {
    "zh-Hant": "內置瀏覽器未將所選資料夾交給頁面，請在 Chrome 或 Edge 開啟此頁後重新選擇。",
    "zh-Hans": "内置浏览器未将所选文件夹交给网页，请在 Chrome 或 Edge 打开此页面后重新选择。",
    "en": "The embedded browser did not return the selected folder. Reopen this page in Chrome or Edge and select it again."
  },
  "保存授權未取得": {
    "zh-Hant": "尚未取得保存授權",
    "zh-Hans": "尚未取得保存授权",
    "en": "Save permission not granted"
  },
  "瀏覽器無法確認已保存所選目錄，請重新選擇。": {
    "zh-Hant": "瀏覽器無法確認已保存所選目錄，請重新選擇。",
    "zh-Hans": "浏览器无法确认已保存所选目录，请重新选择。",
    "en": "The browser could not confirm the selected folder was saved. Please select it again."
  },
  "文件夾已選，本次頁面可保存；瀏覽器未能記住選擇。": {
    "zh-Hant": "資料夾已選，本次頁面可保存；瀏覽器未能記住選擇。",
    "zh-Hans": "文件夹已选，本次页面可保存；浏览器未能记住选择。",
    "en": "Folder selected and usable on this page, but the browser could not remember it."
  },
  "保存文件夾選擇未能記住": {
    "zh-Hant": "保存資料夾選擇未能記住",
    "zh-Hans": "保存文件夹选择未能记住",
    "en": "The save-folder selection could not be remembered"
  },
  "选择 EEG Data 保存目录": {
    "zh-Hans": "选择 EEG Data 保存目录",
    "en": "Choose EEG Data Folder"
  },
  "桌面采集器会自动保存；浏览器直连尚未授权目录": {
    "zh-Hant": "桌面採集器會自動保存；瀏覽器直連尚未授權目錄",
    "zh-Hans": "桌面采集器会自动保存；浏览器直连尚未授权目录",
    "en": "Desktop collector saves automatically; no folder authorized for direct browser capture"
  },
  "記錄用設備標識": {
    "zh-Hans": "记录用设备标识",
    "en": "Recording Device ID"
  },
  "確認並記住": {
    "zh-Hans": "确认并记住",
    "en": "Confirm and Remember"
  },
  "例如 SOA-FA758": {
    "zh-Hant": "例如 SOA-FA758",
    "zh-Hans": "例如 SOA-FA758",
    "en": "For example, SOA-FA758"
  },
  "由设备文件提供": {
    "zh-Hant": "由設備文件提供",
    "zh-Hans": "由设备文件提供",
    "en": "From device manual"
  },
  "选填": {
    "zh-Hant": "選填",
    "zh-Hans": "选填",
    "en": "Optional"
  },
  "設備標識僅可使用英文字母、數字、點、底線或連字號。": {
    "zh-Hans": "设备标识仅可使用英文字母、数字、点、下划线或连字符。",
    "en": "Device ID may contain only letters, numbers, dots, underscores, or hyphens."
  },
  "未設置設備標識，記錄文件名將使用 unknown-device": {
    "zh-Hans": "未设置设备标识，记录文件名将使用 unknown-device",
    "en": "No recording device ID set; saved sessions will be named unknown-device"
  },
  "設備標識暫不可用": {
    "zh-Hans": "设备标识暂不可用",
    "en": "Device ID temporarily unavailable"
  },
  "本機採集器設備標識保存失敗": {
    "zh-Hans": "本机采集器设备标识保存失败",
    "en": "Could not save device ID to local collector"
  },
  "此瀏覽器不支援資料夾授權，請使用桌面採集器自動保存。": {
    "zh-Hans": "此浏览器不支持文件夹授权，请使用桌面采集器自动保存。",
    "en": "This browser does not support folder access; use the desktop collector for automatic saving."
  },
  "尚未授權瀏覽器 EEG 保存目錄": {
    "zh-Hans": "尚未授权浏览器 EEG 保存目录",
    "en": "No browser EEG save folder is authorized"
  },
  "請先選擇瀏覽器 EEG 保存目錄，再連接設備。": {
    "zh-Hans": "请先选择浏览器 EEG 保存目录，再连接设备。",
    "en": "Choose a browser EEG save folder before connecting a device."
  },
  "瀏覽器 EEG 保存目錄已授權": {
    "zh-Hans": "浏览器 EEG 保存目录已授权",
    "en": "Browser EEG save folder authorized"
  },
  "已記住瀏覽器 EEG 保存目錄，連接前需重新授權。": {
    "zh-Hans": "已记住浏览器 EEG 保存目录，连接前需重新授权。",
    "en": "The EEG save folder is remembered; permission will be requested when you connect."
  },
  "瀏覽器 EEG 保存目錄暫不可用": {
    "zh-Hans": "浏览器 EEG 保存目录暂不可用",
    "en": "Browser EEG save folder is temporarily unavailable"
  },
  "瀏覽器 EEG 保存目錄權限已失效，請重新選擇目錄。": {
    "zh-Hans": "浏览器 EEG 保存目录权限已失效，请重新选择目录。",
    "en": "Permission for the EEG save folder has expired. Please select the folder again."
  },
  "等待 EEG 数据后自动创建会话记录": {
    "zh-Hant": "等待 EEG 資料後自動建立會話記錄",
    "zh-Hans": "等待 EEG 数据后自动创建会话记录",
    "en": "A session file will be created automatically when EEG data arrives"
  },
  "上游仅提供解析数据，无法保存原始字节流": {
    "zh-Hant": "上游僅提供解析資料，無法保存原始位元組流",
    "zh-Hans": "上游仅提供解析数据，无法保存原始字节流",
    "en": "The upstream connection provides decoded data only; raw bytes cannot be archived"
  },
  "自動保存中": {
    "zh-Hans": "自动保存中",
    "en": "Saving automatically"
  },
  "自動保存失敗": {
    "zh-Hans": "自动保存失败",
    "en": "Automatic save failed"
  },
  "EEG 自動保存失敗": {
    "zh-Hans": "EEG 自动保存失败",
    "en": "EEG automatic save failed"
  },
  "桌面采集器自动保存至": {
    "zh-Hant": "桌面採集器自動保存至",
    "zh-Hans": "桌面采集器自动保存至",
    "en": "Desktop collector auto-saving to"
  },
  "導入歷史數據": {
    "zh-Hans": "导入历史数据",
    "en": "Import Historical Data"
  },
  "导入历史数据": {
    "zh-Hant": "導入歷史資料",
    "zh-Hans": "导入历史数据",
    "en": "Import Historical Data"
  },
  "需填入设备文件提供的服务与通知特征 UUID；只解析相容 ThinkGear 通知流。": {
    "zh-Hant": "需填入設備文件提供的服務與通知特徵 UUID；僅解析相容 ThinkGear 通知流。",
    "zh-Hans": "需填入设备文件提供的服务与通知特征 UUID；只解析相容 ThinkGear 通知流。",
    "en": "Enter the service and notification characteristic UUIDs from the device documentation. Only compatible ThinkGear notification streams are parsed."
  },
  "选择此前保存的 JSON、JSONL 或自描述 TGAM 原始记录文件。": {
    "zh-Hant": "選擇先前保存的 JSON、JSONL 或自描述 TGAM 原始記錄檔案。",
    "zh-Hans": "选择此前保存的 JSON、JSONL 或自描述 TGAM 原始记录文件。",
    "en": "Import a saved JSON, JSONL, or self-describing raw TGAM recording."
  },
  "选择历史记录": {
    "zh-Hant": "選擇歷史記錄",
    "zh-Hans": "选择历史记录",
    "en": "Choose Historical Record"
  },
  "尚未导入历史数据": {
    "zh-Hant": "尚未導入歷史資料",
    "zh-Hans": "尚未导入历史数据",
    "en": "No historical data imported"
  },
  "回放控制在 01 的「導入歷史數據」：選擇記錄後可播放、暫停或拖動進度。": {
    "zh-Hans": "回放控制在 01 的「导入历史数据」：选择记录后可播放、暂停或拖动进度。",
    "en": "Playback lives in 01, Import Historical Data: choose a recording to play, pause, or scrub."
  },
  "前往導入記錄": {
    "zh-Hans": "前往导入记录",
    "en": "Go to Import"
  },
  "回放進度": {
    "zh-Hans": "回放进度",
    "en": "Playback position"
  },
  "已載入記錄": {
    "zh-Hans": "已载入记录",
    "en": "Loaded recording"
  },
  "回放完成": {
    "zh-Hans": "回放完成",
    "en": "Replay finished"
  },
  "回放已暫停": {
    "zh-Hans": "回放已暂停",
    "en": "Replay paused"
  },
  "回放已停止": {
    "zh-Hans": "回放已停止",
    "en": "Replay stopped"
  },
  "等待記錄": {
    "zh-Hans": "等待记录",
    "en": "Waiting for a recording"
  },
  "本地采集器负责自动保存原始采集事实；历史文件导入不覆盖当前 EEG Data 档案。": {
    "zh-Hant": "本地採集器負責自動保存原始採集事實；歷史檔案導入不覆蓋目前 EEG Data 檔案。",
    "zh-Hans": "本地采集器负责自动保存原始采集事实；历史文件导入不覆盖当前 EEG Data 档案。",
    "en": "The local collector automatically saves acquisition facts; importing history never overwrites current EEG Data files."
  },
  "TGAM 約每秒輸出 512 個原始 EEG 樣本，並在較慢的彙總封包中提供指數、接觸品質與頻段功率。單個 .tgam 文件包含會話資訊與完整原始字節流。": {
    "zh-Hant": "TGAM 約每秒輸出 512 個原始 EEG 樣本，並在較慢的彙總封包中提供指數、接觸品質與頻段功率。單個 .tgam 文件包含會話資訊與完整原始字節流。",
    "zh-Hans": "TGAM 约每秒输出 512 个原始 EEG 样本，并在较慢的汇总数据包中提供指数、接触质量与频段功率。单个 .tgam 文件包含会话信息与完整原始字节流。",
    "en": "TGAM sends about 512 raw EEG samples per second, with indices, contact quality, and band powers in slower summary packets. A single .tgam file contains session metadata and the complete raw byte stream."
  },
  "畫面聚合與平滑只影響監看；原始存檔保留收到的位元組，資料映射在導入時依協議規則執行。": {
    "zh-Hant": "畫面聚合與平滑只影響監看；原始存檔保留收到的位元組，資料映射在導入時依協議規則執行。",
    "zh-Hans": "画面聚合与平滑只影响监看；原始存档保留收到的字节，数据映射在导入时按协议规则执行。",
    "en": "Display aggregation and smoothing only affect monitoring; the raw archive preserves received bytes, and protocol mapping is applied during import."
  },
  "TGAM 原始流不含逐封包時間戳；導入回放時間按約 513 個封包／秒估算，不代表設備精確時間。": {
    "zh-Hant": "TGAM 原始流不含逐封包時間戳；導入回放時間按約 513 個封包／秒估算，不代表設備精確時間。",
    "zh-Hans": "TGAM 原始流不含逐数据包时间戳；导入回放时间按约 513 个数据包／秒估算，不代表设备精确时间。",
    "en": "TGAM raw streams have no per-packet timestamps; replay timing is estimated at about 513 packets per second and is not device-exact."
  },
  "转换 TGAM 原始文件": {
    "zh-Hant": "轉換 TGAM 原始檔案",
    "zh-Hans": "转换 TGAM 原始文件",
    "en": "Convert Raw TGAM File"
  },
  "选择一个 .tgam 文件，然后下载可阅读的 JSON 或表格 CSV；原始文件不会改动。": {
    "zh-Hant": "選擇一個 .tgam 文件，然後下載可閱讀的 JSON 或表格 CSV；原始文件不會改動。",
    "zh-Hans": "选择一个 .tgam 文件，然后下载可阅读的 JSON 或表格 CSV；原始文件不会改动。",
    "en": "Select a .tgam file to download readable JSON or spreadsheet CSV; the raw file is unchanged."
  },
  "选择 TGAM 文件": {
    "zh-Hant": "選擇 TGAM 檔案",
    "zh-Hans": "选择 TGAM 文件",
    "en": "Choose TGAM File"
  },
  "下载 JSON": {
    "zh-Hant": "下載 JSON",
    "zh-Hans": "下载 JSON",
    "en": "Download JSON"
  },
  "下载 CSV": {
    "zh-Hant": "下載 CSV",
    "zh-Hans": "下载 CSV",
    "en": "Download CSV"
  },
  "尚未选择 TGAM 文件": {
    "zh-Hant": "尚未選擇 TGAM 檔案",
    "zh-Hans": "尚未选择 TGAM 文件",
    "en": "No TGAM file selected"
  },
  "准备转换": {
    "zh-Hant": "準備轉換",
    "zh-Hans": "准备转换",
    "en": "Ready to convert"
  },
  "正在转换 TGAM 文件": {
    "zh-Hant": "正在轉換 TGAM 檔案",
    "zh-Hans": "正在转换 TGAM 文件",
    "en": "Converting TGAM file"
  },
  "转换完成": {
    "zh-Hant": "轉換完成",
    "zh-Hans": "转换完成",
    "en": "Conversion complete"
  },
  "转换失败": {
    "zh-Hant": "轉換失敗",
    "zh-Hans": "转换失败",
    "en": "Conversion failed"
  },
  "EEG 記錄檔關閉失敗": {
    "zh-Hans": "EEG 记录文件关闭失败",
    "en": "Could not close the EEG recording file"
  },
  "讀取歷史記錄": {
    "zh-Hans": "读取历史记录",
    "en": "Loading historical record"
  },
  "歷史記錄不可用": {
    "zh-Hans": "历史记录不可用",
    "en": "Historical record unavailable"
  },
  "顯示最近收到的 EEG 資料": {
    "zh-Hans": "显示最近收到的 EEG 数据",
    "en": "Recently Received EEG Data"
  },
  "專注 / 放鬆 · 平滑顯示": {
    "zh-Hans": "专注 / 放松 · 平滑显示",
    "en": "Attention / Meditation · Smoothed"
  },
  "選擇 EEG 設備": {
    "zh-Hans": "选择 EEG 设备",
    "en": "Select EEG Device"
  },
  "停止設備連接": {
    "zh-Hans": "停止设备连接",
    "en": "Stop Connection"
  },
  "未連接": {
    "zh-Hans": "未连接",
    "en": "Disconnected"
  },
  "正在選擇設備": {
    "zh-Hans": "正在选择设备",
    "en": "Selecting Device"
  },
  "正在連接": {
    "zh-Hans": "正在连接",
    "en": "Connecting"
  },
  "已連接，等待資料": {
    "zh-Hans": "已连接，等待数据",
    "en": "Connected; waiting for data"
  },
  "正在接收資料": {
    "zh-Hans": "正在接收数据",
    "en": "Receiving Data"
  },
  "連線中斷，正在重連": {
    "zh-Hans": "连接中断，正在重连",
    "en": "Connection interrupted; reconnecting"
  },
  "連接錯誤": {
    "zh-Hans": "连接错误",
    "en": "Connection Error"
  },
  "等待設備資料": {
    "zh-Hans": "等待设备数据",
    "en": "Waiting for Device Data"
  },
  "資料流已中斷": {
    "zh-Hans": "数据流已中断",
    "en": "Data Stream Interrupted"
  },
  "等待 EEG 封包": {
    "zh-Hans": "等待 EEG 数据包",
    "en": "Waiting for EEG Packets"
  },
  "接收封包": {
    "zh-Hans": "接收数据包",
    "en": "Packets Received"
  },
  "專注 / 放鬆": {
    "zh-Hans": "专注 / 放松",
    "en": "Attention / Meditation"
  },
  "接觸品質": {
    "zh-Hans": "接触质量",
    "en": "Contact Quality"
  },
  "最新原始樣本": {
    "zh-Hans": "最新原始样本",
    "en": "Latest Raw Samples"
  },
  "資料接收中": {
    "zh-Hans": "数据接收中",
    "en": "Receiving Data"
  },
  "良好": {
    "zh-Hans": "良好",
    "en": "Good"
  },
  "接觸不良": {
    "zh-Hans": "接触不良",
    "en": "Poor Contact"
  },
  "未知": {
    "zh-Hans": "未知",
    "en": "Unknown"
  },
  "接觸": {
    "zh-Hans": "接触",
    "en": "Contact"
  },
  "原始樣本": {
    "zh-Hans": "原始样本",
    "en": "Raw"
  },
  "開始本地記錄": {
    "zh-Hans": "开始本地记录",
    "en": "Start Local Recording"
  },
  "停止本地記錄": {
    "zh-Hans": "停止本地记录",
    "en": "Stop Local Recording"
  },
  "記錄中": {
    "zh-Hans": "记录中",
    "en": "Recording"
  },
  "記錄已暫停": {
    "zh-Hans": "记录已暂停",
    "en": "Recording Paused"
  },
  "記錄中，等待 EEG 資料": {
    "zh-Hans": "记录中，等待 EEG 数据",
    "en": "Recording; waiting for EEG data"
  },
  "尚無本地記錄": {
    "zh-Hans": "尚无本地记录",
    "en": "No Local Recording Yet"
  },
  "保存參數": {
    "zh-Hans": "保存参数",
    "en": "Save Settings"
  },
  "匯入設定 JSON": {
    "zh-Hans": "导入设置 JSON",
    "en": "Import Settings JSON"
  },
  "尚未收到 EEG 封包": {
    "zh-Hans": "尚未收到 EEG 数据包",
    "en": "No EEG packets received yet"
  },
  "本機設備連接": {
    "zh-Hans": "本机设备连接",
    "en": "Connect a Local Device"
  },
  "本機採集器": {
    "zh-Hans": "本机采集器",
    "en": "Local Acquisition Service"
  },
  "ThinkGear 相容腦電 USB": {
    "zh-Hans": "ThinkGear 兼容脑电 USB",
    "en": "ThinkGear-Compatible EEG USB"
  },
  "腦電藍牙身份": {
    "zh-Hans": "脑电蓝牙身份",
    "en": "EEG Bluetooth Identity"
  },
  "尚未發現串口設備；插入後會自動識別。": {
    "zh-Hans": "尚未发现串口设备；插入后会自动识别。",
    "en": "No serial devices found; compatible devices will be detected when connected."
  },
  "按 USB 身份識別；設備路徑或 COM 號改變後自動重連。": {
    "zh-Hans": "按 USB 身份识别；设备路径或 COM 号改变后自动重连。",
    "en": "Devices are matched by USB identity and reconnect automatically if the device path or COM number changes."
  },
  "目前復用既有音療核心，其設備身份由核心配置管理；獨立模式可在此保存。": {
    "zh-Hans": "目前复用既有音疗核心，其设备身份由核心配置管理；独立模式可在此保存。",
    "en": "The existing audio-therapy core manages device identity; save it here when using standalone mode."
  },
  "既有核心": {
    "zh-Hans": "既有核心",
    "en": "Existing Core"
  },
  "獨立採集器": {
    "zh-Hans": "独立采集器",
    "en": "Standalone Acquisition Service"
  },
  "運行中": {
    "zh-Hans": "运行中",
    "en": "Running"
  },
  "尚未收到有效腦波": {
    "zh-Hans": "尚未收到有效脑波",
    "en": "No valid EEG received yet"
  },
  "來源": {
    "zh-Hans": "来源",
    "en": "Source"
  },
  "EEG USB": {
    "zh-Hans": "EEG USB",
    "en": "EEG USB"
  },
  "腦電藍牙": {
    "zh-Hans": "脑电蓝牙",
    "en": "EEG Bluetooth"
  },
  "未識別": {
    "zh-Hans": "未识别",
    "en": "Not detected"
  },
  "核心未運行；接口保持重連。": {
    "zh-Hans": "核心未运行；接口保持重连。",
    "en": "Core is not running; the interface will keep reconnecting."
  },
  "本機橋接器暫不可用；等待接口恢復。": {
    "zh-Hans": "本机桥接器暂不可用；等待接口恢复。",
    "en": "Local bridge unavailable; waiting for the connection to recover."
  },
  "本機採集器隨桌面應用啟動；純網頁預覽不會啟動 EEG 硬體。有效資料到達後，設備狀態會顯示在左側。": {
    "zh-Hans": "本机采集器随桌面应用启动；纯网页预览不会启动 EEG 硬件。有效数据到达后，设备状态会显示在左侧。",
    "en": "The local acquisition service starts with the desktop app; a browser preview cannot start EEG hardware. Device status appears in the sidebar when valid data arrives."
  },
  "等待 EEG 設備資料": {
    "zh-Hans": "等待 EEG 设备数据",
    "en": "Waiting for EEG device data"
  },
  "採集器設備管理": {
    "zh-Hans": "采集器设备管理",
    "en": "Acquisition Service Device Management"
  },
  "已發現的設備": {
    "zh-Hans": "已发现的设备",
    "en": "Detected Devices"
  },
  "瀏覽器直接連接 EEG": {
    "zh-Hans": "浏览器直接连接 EEG",
    "en": "Direct Browser Connection"
  },
  "不使用本機採集器時，可在此直接連接支援的 USB 或 BLE EEG 設備。這兩種方式都會讀取真實設備資料，不是模擬輸入。": {
    "zh-Hans": "不使用本机采集器时，可在此直接连接支持的 USB 或 BLE EEG 设备。这两种方式都会读取真实设备数据，不是模拟输入。",
    "en": "If you are not using the local acquisition service, connect a supported USB or BLE EEG device here. Both methods read real device data, not simulated input."
  },
  "採集器下載與安裝說明": {
    "zh-Hans": "采集器下载与安装说明",
    "en": "Download & Install the Acquisition Service"
  },
  "純網頁無法自行啟動本機採集服務。請先下載並啟動桌面應用；完整應用包自帶運行環境，首次藍牙授權及缺失的廠商 USB 驅動依系統提示完成。": {
    "zh-Hans": "纯网页无法自行启动本机采集服务。请先下载并启动桌面应用；完整应用包自带运行环境，首次蓝牙授权及缺失的厂商 USB 驱动按系统提示完成。",
    "en": "A browser page cannot start the local acquisition service. Download and launch the desktop app first; it includes its runtime. Grant Bluetooth access and install any required vendor USB driver when prompted."
  },
  "Safari 可經桌面應用內的本機採集服務接入，不要求瀏覽器直接支援 USB 或 BLE。自動識別僅適用於採集器支援的相容型號。": {
    "zh-Hans": "Safari 可经桌面应用内的本机采集服务接入，不要求浏览器直接支持 USB 或 BLE。自动识别仅适用于采集器支持的兼容型号。",
    "en": "Safari connects through the desktop app's local service without direct browser USB or BLE support. Automatic detection applies only to supported device models."
  },
  "保存或匯入設備連接參數": {
    "zh-Hans": "保存或导入设备连接参数",
    "en": "Save or Import Device Connection Settings"
  },
  "REAL DEVICE CONNECTION": {
    "zh-Hans": "真实设备连接",
    "en": "REAL DEVICE CONNECTION"
  },
  "EEG DEVICE CONNECTION": {
    "zh-Hans": "EEG 设备连接",
    "en": "EEG DEVICE CONNECTION"
  },
  "REAL DEVICE ONLY": {
    "zh-Hans": "仅限真实设备",
    "en": "REAL DEVICE ONLY"
  },
  "選擇並連接 USB 設備": {
    "zh-Hans": "选择并连接 USB 设备",
    "en": "Select and Connect USB Device"
  },
  "選擇並連接 BLE 設備": {
    "zh-Hans": "选择并连接 BLE 设备",
    "en": "Select and Connect BLE Device"
  },
  "支援標準 ThinkGear 封包；專有協議請使用對應桌面採集器。": {
    "zh-Hans": "支持标准 ThinkGear 数据包；专有协议请使用对应桌面采集器。",
    "en": "Supports standard ThinkGear packets; use the matching desktop acquisition service for proprietary protocols."
  },
  "需填入設備文件提供的服務與通知特徵 UUID；只解析相容 ThinkGear 通知流。": {
    "zh-Hans": "需填入设备文档提供的服务与通知特征 UUID；仅解析兼容 ThinkGear 通知流。",
    "en": "Enter the service and notification characteristic UUIDs from the device documentation. Only compatible ThinkGear notification streams are parsed."
  },
  "設備連線已停止": {
    "zh-Hans": "设备连接已停止",
    "en": "Device Connection Stopped"
  },
  "由本機採集器連接相容 EEG 設備；收到有效資料後會顯示在左側。本頁不使用示範或回放資料。": {
    "zh-Hans": "由本机采集器连接兼容 EEG 设备；收到有效数据后会显示在左侧。本页不使用示范或回放数据。",
    "en": "Connect a compatible EEG device through the local acquisition service. Valid data appears in the sidebar. Demo and replay data are not used here."
  },
  "打開本機採集器": {
    "zh-Hans": "打开本机采集器",
    "en": "Open Local Acquisition Service"
  },
  "此入口只在本機採集器已安裝並運行時可用。": {
    "zh-Hans": "此入口仅在本机采集器已安装并运行时可用。",
    "en": "This link works only when the local acquisition service is installed and running."
  },
  "下載採集器與相容說明": {
    "zh-Hans": "下载采集器与兼容说明",
    "en": "Download & Compatibility"
  },
  "請依你的電腦系統選擇版本。完整應用包自帶運行環境；首次藍牙授權及缺失的廠商 USB 驅動，依系統提示完成。": {
    "zh-Hans": "请按你的电脑系统选择版本。完整应用包自带运行环境；首次蓝牙授权及缺失的厂商 USB 驱动，按系统提示完成。",
    "en": "Choose the build for your computer. The standalone package includes its runtime; grant Bluetooth permission and install missing vendor USB drivers when prompted."
  },
  "Windows x64 版本": {
    "zh-Hans": "Windows x64 版本",
    "en": "Windows x64 Build"
  },
  "Mac M 系列版本": {
    "zh-Hans": "Mac M 系列版本",
    "en": "Mac Apple Silicon Build"
  },
  "Mac Intel 版本": {
    "zh-Hans": "Mac Intel 版本",
    "en": "Mac Intel Build"
  },
  "公開版本以發佈頁為準。本機新包及源碼見交付目錄。Safari 通過本機採集器接入，不要求瀏覽器直接支援 USB 或 BLE。設備自動識別僅適用於採集器支援的相容型號。": {
    "zh-Hans": "公开版本以发布页为准。本机新包及源码见交付目录。Safari 通过本机采集器接入，不要求浏览器直接支持 USB 或 BLE。设备自动识别仅适用于采集器支持的兼容型号。",
    "en": "See the release page for published builds; local builds and source are in the delivery directory. Safari connects through the local service without browser USB/BLE support. Automatic detection applies only to supported device models."
  },
  "啟動本機採集器後，自動連接相容的 EEG 設備並將有效資料送入本頁。此頁不使用模擬或回放資料。": {
    "zh-Hans": "启动本机采集器后，自动连接兼容的 EEG 设备并将有效数据送入本页。此页不使用模拟或回放数据。",
    "en": "Start the local acquisition service to connect a compatible EEG device and stream valid data here. This view does not use simulated or replay data."
  },
  "開啟本機採集器 ↗": {
    "zh-Hans": "开启本机采集器 ↗",
    "en": "Open Local Acquisition Service ↗"
  },
  "完整應用包自帶運行環境。首次藍牙授權及缺失的廠商 USB 驅動，按系統提示完成；唯一相容設備插入後自動識別。": {
    "zh-Hans": "完整应用包自带运行环境。首次蓝牙授权及缺失的厂商 USB 驱动，按系统提示完成；唯一兼容设备插入后自动识别。",
    "en": "The standalone application includes its runtime. Grant Bluetooth permission and install any missing vendor USB driver when prompted; a single compatible device is identified automatically."
  },
  "公開版本以發佈頁為準。本機新包及源碼見交付目錄。Safari 通過本機採集器接入，不要求瀏覽器直接支援 USB 或 BLE。": {
    "zh-Hans": "公开版本以发布页为准。本机新包及源码见交付目录。Safari 通过本机采集器接入，不要求浏览器直接支持 USB 或 BLE。",
    "en": "Check the release page for published builds; local builds and source are in the delivery directory. Safari connects through the local acquisition service and does not require browser USB or BLE support."
  },
  "其他連接方式與診斷": {
    "zh-Hans": "其他连接方式与诊断",
    "en": "Alternative Connections & Diagnostics"
  },
  "重新檢查瀏覽器接口": {
    "zh-Hans": "重新检查浏览器接口",
    "en": "Recheck Browser APIs"
  },
  "外部 WebSocket 接收、診斷與上傳設定保留為進階整合功能，不屬於一般設備連接流程。": {
    "zh-Hans": "外部 WebSocket 接收、诊断与上传设置保留为高级集成功能，不属于一般设备连接流程。",
    "en": "External WebSocket input, diagnostics, and upload settings remain available as advanced integrations, not part of the standard device-connection flow."
  },
  "01 僅顯示真實設備資料。示範與回放入口不在此頁提供；目前記錄仍需手動匯出，尚未建立可檢索的本地檔案庫。": {
    "zh-Hans": "01 仅显示真实设备数据。示范与回放入口不在此页提供；目前记录仍需手动导出，尚未建立可检索的本地档案库。",
    "en": "01 displays real-device data only. Demo and replay controls are not available here; recordings still require manual export, and a searchable local archive has not been implemented."
  },
  "重新檢查": {
    "zh-Hans": "重新检查",
    "en": "Recheck"
  },
  "本機自動採集": {
    "zh-Hans": "本机自动采集",
    "en": "Local Auto-Acquisition"
  },
  "啟動獨立採集器後，自動連接同源資料。預設獨立運行，復用既有核心需明確選擇。": {
    "zh-Hans": "启动独立采集器后，自动连接同源数据。默认独立运行，复用已有核心需明确选择。",
    "en": "Automatically connects to local source when standalone acquisition runs. Standalone by default; reusing an existing core requires explicit selection."
  },
  "開啟本機採集入口 ↗": {
    "zh-Hans": "开启本机采集入口 ↗",
    "en": "Open Local Gateway ↗"
  },
  "完整應用包自帶運行環境。首次藍牙授權及缺失的廠商USB驅動，按系統提示完成；唯一相容設備插入後自動識別。": {
    "zh-Hans": "完整应用包自带运行环境。首次蓝牙授权及缺失的厂商USB驱动，按系统提示完成；唯一兼容设备插入后自动识别。",
    "en": "Self-contained application package. Grant Bluetooth permissions or install missing vendor USB drivers per OS prompts; compatible devices auto-identify upon insertion."
  },
  "公開 Windows x64 版本": {
    "zh-Hans": "公开 Windows x64 版本",
    "en": "Release Windows x64"
  },
  "公開 Mac M系列版本": {
    "zh-Hans": "公开 Mac M系列版本",
    "en": "Release Mac Apple Silicon"
  },
  "公開 Mac M 系列版本": {
    "zh-Hans": "公开 Mac M 系列版本",
    "en": "Release Mac Apple Silicon"
  },
  "公開 Mac Intel版本": {
    "zh-Hans": "公开 Mac Intel版本",
    "en": "Release Mac Intel"
  },
  "公開 Mac Intel 版本": {
    "zh-Hans": "公开 Mac Intel 版本",
    "en": "Release Mac Intel"
  },
  "公開版本以發佈頁為準。本機新包及源碼見交付目錄。Safari通過本機採集器接入，不要求瀏覽器直接支援USB或BLE。": {
    "zh-Hans": "公开版本以发布页为准。本机新包及源码见交付目录。Safari通过本机采集器接入，不要求浏览器直接支持USB或BLE。",
    "en": "Public releases are hosted on GitHub. Local builds reside in output directories. Safari connects via the local gateway without requiring native browser Web Serial/Bluetooth."
  },
  "本機設備": {
    "zh-Hans": "本机设备",
    "en": "Local Devices"
  },
  "已發現的設備": {
    "zh-Hans": "已发现的设备",
    "en": "Discovered Devices"
  },
  "ThinkGear相容腦電USB": {
    "zh-Hans": "ThinkGear兼容脑电USB",
    "en": "ThinkGear-Compatible EEG USB"
  },
  "AFE4490文本血氧USB": {
    "zh-Hans": "AFE4490文本血氧USB",
    "en": "AFE4490 Text SpO₂ USB"
  },
  "腦電藍牙身份": {
    "zh-Hans": "脑电蓝牙身份",
    "en": "EEG Bluetooth Identity"
  },
  "保存设备身份": {
    "zh-Hans": "保存设备身份",
    "en": "Save Device Identity"
  },
  "保存設備身份": {
    "zh-Hans": "保存设备身份",
    "en": "Save Device Identity"
  },
  "其他傳感器狀態": {
    "zh-Hans": "其他传感器状态",
    "en": "Other Sensor States"
  },
  "血氧 SpO₂": {
    "zh-Hans": "血氧 SpO₂",
    "en": "Blood Oxygen SpO₂"
  },
  "脈率": {
    "zh-Hans": "脉率",
    "en": "Pulse Rate"
  },
  "HRV": {
    "zh-Hans": "HRV",
    "en": "HRV"
  },
  "來源原始值": {
    "zh-Hans": "来源原始值",
    "en": "Raw Value"
  },
  "皮膚電 GSR": {
    "zh-Hans": "皮肤电 GSR",
    "en": "GSR Galvanic Skin"
  },
  "USB / 串口": {
    "zh-Hans": "USB / 串口",
    "en": "USB / Serial"
  },
  "標準 ThinkGear 封包。專有協議設備可改接原廠驅動的 WebSocket。": {
    "zh-Hans": "标准 ThinkGear 数据包。专有协议设备可改接原厂驱动的 WebSocket。",
    "en": "Standard ThinkGear stream. Proprietary devices can connect via vendor WebSocket driver."
  },
  "波特率": {
    "zh-Hans": "波特率",
    "en": "Baud Rate"
  },
  "選擇 USB 串口": {
    "zh-Hans": "选择 USB 串口",
    "en": "Select USB Port"
  },
  "藍牙 / BLE": {
    "zh-Hans": "蓝牙 / BLE",
    "en": "Bluetooth / BLE"
  },
  "設備名稱前綴": {
    "zh-Hans": "设备名称前缀",
    "en": "Device Name Prefix"
  },
  "選填": {
    "zh-Hans": "选填",
    "zh-Hant": "選填",
    "en": "Optional"
  },
  "服務 UUID": {
    "zh-Hans": "服务 UUID",
    "en": "Service UUID"
  },
  "由設備文件提供": {
    "zh-Hans": "由设备文件提供",
    "zh-Hant": "由設備文件提供",
    "en": "From device manual"
  },
  "通知特徵 UUID": {
    "zh-Hans": "通知特征 UUID",
    "en": "Notify Characteristic UUID"
  },
  "選擇藍牙設備": {
    "zh-Hans": "选择蓝牙设备",
    "en": "Select Bluetooth Device"
  },
  "接收相容 ThinkGear 通知流；其他協議保持原始 bytes 狀態，不冒充已解析腦波。": {
    "zh-Hans": "接收兼容 ThinkGear 通知流；其他协议保持原始 bytes 状态，不冒充已解析脑波。",
    "en": "Receives compatible ThinkGear notifications; other protocols stay as raw bytes without fabricating parsed EEG."
  },
  "連線與驅動檢查": {
    "zh-Hans": "连接与驱动检查",
    "en": "Connection & Driver Check"
  },
  "Web API 可用不等於硬體已連接。系統驅動由作業系統管理，網頁不會自行安裝驅動。": {
    "zh-Hans": "Web API 可用不等于硬件已连接。系统驱动由操作系统管理，网页不会自行安装驱动。",
    "en": "Available Web APIs do not guarantee hardware connection. System drivers are managed by OS, not installed by web page."
  },
  "橋接器健康檢查地址": {
    "zh-Hans": "桥接器健康检查地址",
    "en": "Gateway Health Check URL"
  },
  "檢查接口": {
    "zh-Hans": "检查接口",
    "en": "Check Endpoint"
  },
  "停止設備連線": {
    "zh-Hans": "停止设备连接",
    "en": "Stop Connection"
  },
  "尚未選擇設備": {
    "zh-Hans": "尚未选择设备",
    "en": "No device selected"
  },
  "尚未檢查": {
    "zh-Hans": "尚未检查",
    "en": "Not checked yet"
  },
  "設定與上傳 / 下載": {
    "zh-Hans": "设定与上传 / 下载",
    "en": "Settings & Transfer"
  },
  "保存設定": {
    "zh-Hans": "保存设定",
    "en": "Save Settings"
  },
  "下載設定 JSON ↗": {
    "zh-Hans": "下载设定 JSON ↗",
    "en": "Download Settings JSON ↗"
  },
  "匯入設定": {
    "zh-Hans": "导入设定",
    "en": "Import Settings"
  },
  "上傳接口": {
    "zh-Hans": "上传接口",
    "en": "Upload URL"
  },
  "上傳已記錄資料": {
    "zh-Hans": "上传已记录数据",
    "en": "Upload Recorded Data"
  },
  "只有點擊上傳才發送；接口需支援 JSON POST 和 CORS。": {
    "zh-Hans": "只有点击上传才发送；接口需支持 JSON POST 和 CORS。",
    "en": "Only sends when clicked; endpoint must support JSON POST and CORS."
  },
  "實時資料源共用左側接口。切換這三個介面不會停止接收。設定僅保存在此瀏覽器，不含作者電腦路徑。": {
    "zh-Hans": "实时数据源共用左侧接口。切换这三个界面不会停止接收。设定仅保存在此浏览器，不含作者电脑路径。",
    "en": "Live stream shares left panel source. Switching views does not interrupt reception. Settings stored locally in browser without author host paths."
  },
  "軌跡保留來源與時間。斷流時停止更新，保留最後觀察。": {
    "zh-Hans": "轨迹保留来源与时间。断流时停止更新，保留最后观察。",
    "en": "Traces retain source and time. Freezes updates and retains last observation on disconnect."
  },
  "方法與來源": {
    "zh-Hans": "方法与来源",
    "en": "Methods & Sources"
  },
  "執行環境": {
    "zh-Hans": "执行环境",
    "en": "Execution Context"
  },
  "安全來源": {
    "zh-Hans": "安全来源",
    "en": "Secure Origin (HTTPS/Localhost)"
  },
  "非安全來源：硬體 API 可能不可用": {
    "zh-Hans": "非安全来源：硬件 API 可能不可用",
    "en": "Insecure Origin: Hardware APIs may be blocked"
  },
  "瀏覽器接口可用": {
    "zh-Hans": "浏览器接口可用",
    "en": "Browser API Available"
  },
  "此瀏覽器未提供接口": {
    "zh-Hans": "此浏览器未提供接口",
    "en": "API Not Supported by Browser"
  },
  "設備驅動": {
    "zh-Hans": "设备驱动",
    "en": "Device Driver"
  },
  "由作業系統管理": {
    "zh-Hans": "由操作系统管理",
    "en": "Managed by Operating System"
  },
  "尚未發現串口設備；插入後會自動識別。": {
    "zh-Hans": "尚未发现串口设备；插入后会自动识别。",
    "en": "No serial devices detected; will auto-identify upon insertion."
  },
  "尚未發現 USB 串口設備；插入後會自動識別。": {
    "zh-Hans": "尚未发现 USB 串口设备；插入后会自动识别。",
    "en": "No USB serial devices detected; will auto-identify upon connection."
  },
  "自動 · 唯一型號匹配": {
    "zh-Hans": "自动 · 唯一型号匹配",
    "en": "Auto · Unique Model Match"
  },
  "採集器設備識別": {
    "zh-Hans": "采集器设备识别",
    "en": "Collector Device Identity"
  },
  "使用已保存身份": {
    "zh-Hans": "使用已保存身份",
    "en": "Saved Identity"
  },
  "自動識別唯一相容設備": {
    "zh-Hans": "自动识别唯一兼容设备",
    "en": "Auto-identify unique compatible device"
  },
  "目前復用既有音療核心，其设备身份由核心配置管理；獨立模式可在此保存。": {
    "zh-Hans": "当前复用已有音疗核心，其设备身份由核心配置管理；独立模式可在此保存。",
    "en": "Reusing existing core; device identities managed by core config. Standalone mode can save identities here."
  },
  "按USB身份識別；設備路徑或COM號改變後自動重連。": {
    "zh-Hans": "按USB身份识别；设备路径或COM号改变后自动重连。",
    "en": "Identifies by USB hardware identity; auto-reconnects if the device path or COM port changes."
  },
  "設備清單暫不可用": {
    "zh-Hans": "设备清单暂不可用",
    "en": "Device inventory temporarily unavailable"
  },
  "身份已保存，采集器已重新識別設備。": {
    "zh-Hans": "身份已保存，采集器已重新识别设备。",
    "en": "Identity saved; acquisition gateway has re-identified devices."
  },
  "保存未完成": {
    "zh-Hans": "保存未完成",
    "en": "Save incomplete"
  },
  "本機橋接器暫不可用；等待接口恢復。": {
    "zh-Hans": "本机桥接器暂不可用；等待接口恢复。",
    "en": "Local gateway temporarily unavailable; awaiting recovery."
  },
  "核心未運行；接口保持重連。": {
    "zh-Hans": "核心未运行；接口保持重连。",
    "en": "Core not running; reconnecting continuously."
  },
  "設備連線已停止": {
    "zh-Hans": "设备连接已停止",
    "en": "Device connection stopped"
  },
  "設定已保存在此瀏覽器。": {
    "zh-Hans": "设定已保存在此浏览器。",
    "en": "Settings saved in this browser."
  },
  "已匯入設定；連線需手動開啟。": {
    "zh-Hans": "已导入设定；连接需手动开启。",
    "en": "Settings imported; start connection manually."
  },
  "非USB": {
    "zh-Hans": "非USB",
    "en": "Non-USB"
  },
  "無序列號": {
    "zh-Hans": "无序列号",
    "en": "No Serial Number"
  },
  "已保存": {
    "zh-Hans": "已保存",
    "en": "Saved"
  },
  "既有核心": {
    "zh-Hans": "已有核心",
    "en": "Existing Core"
  },
  "獨立采集器": {
    "zh-Hans": "独立采集器",
    "en": "Standalone Gateway"
  },
  "運行中": {
    "zh-Hans": "运行中",
    "en": "Running"
  },
  "尚未收到有效腦波": {
    "zh-Hans": "尚未收到有效脑波",
    "en": "No valid EEG received yet"
  },
  "未識別": {
    "zh-Hans": "未识别",
    "en": "Unidentified"
  },
  "已識別": {
    "zh-Hans": "已识别",
    "en": "Identified"
  },
  "序列號": {
    "zh-Hans": "序列号",
    "en": "Serial"
  },
  "USB 型號": {
    "zh-Hans": "USB 型号",
    "en": "USB model"
  },
  "USB 設備": {
    "zh-Hans": "USB 设备",
    "en": "USB device"
  },
  "來源": {
    "zh-Hans": "来源",
    "en": "Source"
  },
  "血氧": {
    "zh-Hans": "血氧",
    "en": "SpO₂"
  },
  "合成示範": {
    "zh-Hans": "合成示范",
    "en": "Synthetic Demo"
  },
  "設備資料": {
    "zh-Hans": "设备数据",
    "en": "Live Device"
  },
  "橋接資料": {
    "zh-Hans": "桥接数据",
    "en": "Gateway Bridge"
  },
  "記錄回放": {
    "zh-Hans": "记录回放",
    "en": "Recording Replay"
  },
  "外部接口": {
    "zh-Hans": "外部接口",
    "en": "External Endpoint"
  },
  "原始為": {
    "zh-Hans": "原始为",
    "en": "originally "
  },
  "腦電 USB": {
    "zh-Hans": "脑电 USB",
    "en": "EEG USB"
  },
  "血氧 USB": {
    "zh-Hans": "血氧 USB",
    "en": "SpO₂ USB"
  },
  "腦電 BLE": {
    "zh-Hans": "脑电 BLE",
    "en": "EEG BLE"
  },
  "尚未配置設備型號": {
    "zh-Hans": "尚未配置设备型号",
    "en": "Device profile unconfigured"
  },
  "尚未識別相容設備；檢查電源、資料線及廠商驅動": {
    "zh-Hans": "尚未识别兼容设备；检查电源、数据线及厂商驱动",
    "en": "No compatible device detected; check power, cable and vendor drivers"
  },
  "已保存設備未出現；可重新選擇身份": {
    "zh-Hans": "已保存设备未出现；可重新选择身份",
    "en": "Saved device not present; re-select identity"
  },
  "多台設備匹配，請選擇身份": {
    "zh-Hans": "多台设备匹配，请选择身份",
    "en": "Multiple devices match; select identity"
  },
  "尚無有效設備資料": {
    "zh-Hans": "尚无有效设备数据",
    "en": "No valid device data yet"
  },
  "有字節但無有效協議包；核對設備協議及波特率": {
    "zh-Hans": "有字节但无有效协议包；核对设备协议及波特率",
    "en": "Bytes received but no valid protocol packets; check protocol and baud rate"
  },
  "端口被占用或權限不足；關閉其他采集程式並檢查權限": {
    "zh-Hans": "端口被占用或权限不足；关闭其他采集程序并检查权限",
    "en": "Port busy or access denied; close other programs and check permissions"
  },
  "已斷線，采集器會重新識別": {
    "zh-Hans": "已断线，采集器会重新识别",
    "en": "Disconnected; gateway will re-identify"
  },
  "藍牙不可用、權限或連接異常；檢查系統藍牙設定": {
    "zh-Hans": "蓝牙不可用、权限或连接异常；检查系统蓝牙设置",
    "en": "Bluetooth unavailable or permission denied; check system Bluetooth settings"
  },
  "有效資料": {
    "zh-Hans": "有效数据",
    "en": "Valid Data"
  },
  "封包": {
    "zh-Hans": "数据包",
    "en": "packets"
  },
  "連接采集服務中": {
    "zh-Hans": "连接采集服务中",
    "en": "Connecting to acquisition service..."
  },
  "采集服務重連中": {
    "zh-Hans": "采集服务重连中",
    "en": "Reconnecting to acquisition service..."
  },
  "采集服務未連接": {
    "zh-Hans": "采集服务未连接",
    "en": "Acquisition service disconnected"
  },
  "采集已停止": {
    "zh-Hans": "采集已停止",
    "en": "Acquisition stopped"
  },
  "資料格式無效": {
    "zh-Hans": "数据格式无效",
    "en": "Invalid data format"
  },
  "等待資料源": {
    "zh-Hans": "等待数据源",
    "en": "Waiting for data source"
  },
  "等待腦電設備": {
    "zh-Hans": "等待脑电设备",
    "en": "Waiting for EEG device"
  },
  "資料並非即時設備來源": {
    "zh-Hans": "数据并非实时设备来源",
    "en": "Data is not from live device"
  },
  "腦電資料中斷": {
    "zh-Hans": "脑电数据中断",
    "en": "EEG data stream interrupted"
  },
  "接觸品質待確認": {
    "zh-Hans": "接触质量待确认",
    "en": "Contact quality pending confirmation"
  },
  "正在采集 · 指數有效": {
    "zh-Hans": "正在采集 · 指数有效",
    "en": "Acquiring · Indices Valid"
  },
  "正在采集 · 等待指數": {
    "zh-Hans": "正在采集 · 等待指数",
    "en": "Acquiring · Awaiting Indices"
  },
  "觀測研究": {
    "zh-Hans": "观测研究",
    "en": "Observational Study"
  },
  "1 音樂參考": {
    "zh-Hans": "1 音乐参考",
    "en": "1 Music Reference"
  },
  "2 神經響應": {
    "zh-Hans": "2 神经响应",
    "en": "2 Neural Response"
  },
  "3 版本實驗": {
    "zh-Hans": "3 版本实验",
    "en": "3 Version Experiments"
  },
  "等待資料": {
    "zh-Hans": "等待数据",
    "en": "Waiting for Data"
  },
  "等待有效資料": {
    "zh-Hans": "等待有效数据",
    "en": "Waiting for Valid Data"
  },
  "保存圖形": {
    "zh-Hans": "保存图形",
    "en": "Save Graphic"
  },
  "專注顯示": {
    "zh-Hans": "专注显示",
    "en": "Focus View"
  },
  "研究音樂播放": {
    "zh-Hans": "研究音乐播放",
    "en": "Research Audio Player"
  },
  "作品": {
    "zh-Hans": "作品",
    "en": "Composition"
  },
  "演奏版本／片段": {
    "zh-Hans": "演奏版本／片段",
    "en": "Performance / Clip"
  },
  "神經蠕蟲": {
    "zh-Hans": "神经蠕虫",
    "en": "Neural Worm"
  },
  "關注指數": {
    "zh-Hans": "关注指数",
    "en": "Attention"
  },
  "放鬆指數": {
    "zh-Hans": "放松指数",
    "en": "Meditation"
  },
  "振幅 RMS": {
    "zh-Hans": "振幅 RMS",
    "en": "Amplitude RMS"
  },
  "視圖": {
    "zh-Hans": "视图",
    "en": "View"
  },
  "二維投影": {
    "zh-Hans": "二维投影",
    "en": "2D Projection"
  },
  "三維時間方盒": {
    "zh-Hans": "三维时间方盒",
    "en": "3D Time Box"
  },
  "三維時間蠕蟲": {
    "zh-Hans": "三维时间蠕虫",
    "en": "3D Time Worm"
  },
  "三維小節結構": {
    "zh-Hans": "三维小节结构",
    "en": "3D Measure Structure"
  },
  "三維音樂空間": {
    "zh-Hans": "三维音乐空间",
    "en": "3D Music Space"
  },
  "二維蠕蟲": {
    "zh-Hans": "二维蠕虫",
    "en": "2D Worm"
  },
  "拖動旋轉 · 方向鍵微調 · Home 重置": {
    "zh-Hans": "拖动旋转 · 方向键微调 · Home 重置",
    "en": "Drag to rotate · Arrow keys nudge · Home resets"
  },
  "觀察尺度": {
    "zh-Hans": "观察尺度",
    "en": "Observation Scale"
  },
  "全域 · 0–100": {
    "zh-Hans": "全域 · 0–100",
    "en": "Global · 0–100"
  },
  "精細 · 50點": {
    "zh-Hans": "精细 · 50点",
    "en": "Fine · 50 pts"
  },
  "細微 · 25點": {
    "zh-Hans": "细微 · 25点",
    "en": "Micro · 25 pts"
  },
  "坐標窗口，未改變原生指數": {
    "zh-Hans": "坐标窗口，未改变原生指数",
    "en": "Viewing zoom window; native indices unaltered"
  },
  "音高與旋律": {
    "zh-Hans": "音高与旋律",
    "en": "Pitch & Melody"
  },
  "Op.27 No.2 · 第 1–8 小節 · 上譜表": {
    "zh-Hans": "Op.27 No.2 · 第 1–8 小节 · 上谱表",
    "en": "Op. 27 No. 2 · Measures 1–8 · Upper Staff"
  },
  "實線連接相鄰旋律起音；休止處斷開。圓點為降D大調音階內音，菱形為音階外拼寫。裝飾音另列。": {
    "zh-Hans": "实线连接相邻旋律起音；休止处断开。圆点为降D大调音阶内音，菱形为音阶外拼写。装饰音另列。",
    "en": "Solid lines connect adjacent melodic onsets and break at rests. Dots mark notes in the D-flat major scale; diamonds mark notes spelled outside it. Grace notes are shown separately."
  },
  "音高、記譜時值與整數小節層；點選音符定位，左右鍵選音，拖動轉向，Home重置": {
    "zh-Hans": "音高、记谱时值与整数小节层；点击音符定位，左右键选音，拖动转向，Home重置",
    "en": "Pitch, notated duration, and integer-measure layers; click a note to locate it, use arrow keys to select notes, drag to rotate, and press Home to reset"
  },
  "譜面來源與定位方法": {
    "zh-Hans": "谱面来源与定位方法",
    "en": "Score Source & Alignment Method"
  },
  "拍點插值定位": {
    "zh-Hans": "拍点插值定位",
    "en": "Beat-interpolated alignment"
  },
  "非實測逐音起音": {
    "zh-Hans": "非实测逐音起音",
    "en": "Note onsets are not individually measured"
  },
  "譜面休止": {
    "zh-Hans": "谱面休止",
    "en": "Notated rest"
  },
  "半音": {
    "zh-Hans": "半音",
    "en": "semitones"
  },
  "同音重複": {
    "zh-Hans": "同音重复",
    "en": "Repeated note"
  },
  "同字母半音變化": {
    "zh-Hans": "同字母半音变化",
    "en": "Chromatic alteration"
  },
  "二度級進": {
    "zh-Hans": "二度级进",
    "en": "Step of a second"
  },
  "三度及以上跳進": {
    "zh-Hans": "三度及以上跳进",
    "en": "Leap of a third or more"
  },
  "—（起點／休止後）": {
    "zh-Hans": "—（起点／休止后）",
    "en": "— (initial note / after rest)"
  },
  "讀取譜面證據…": {
    "zh-Hans": "读取谱面证据…",
    "en": "Loading score evidence…"
  },
  "此作品尚未提供逐音譜面；可切換 Op.27 No.2 查看已核查譜例。": {
    "zh-Hans": "此作品尚未提供逐音谱面；可切换 Op.27 No.2 查看已核查谱例。",
    "en": "Note-level score evidence is not available for this work. Switch to Op. 27 No. 2 to view the verified example."
  },
  "目前版本缺少匹配的完整拍點，僅呈現譜面；未配對播放時間。": {
    "zh-Hans": "当前版本缺少匹配的完整拍点，仅呈现谱面；未配对播放时间。",
    "en": "This version has no matching complete beat annotation. The score is shown without playback-time alignment."
  },
  "目前播放位置超出第1–8小節譜例；逐音讀數留空。": {
    "zh-Hans": "当前播放位置超出第1–8小节谱例；逐音读数留空。",
    "en": "Playback is outside the measures 1–8 excerpt; note-level readings are omitted."
  },
  "分量獨立呈現。線性聚焦度／非線性離散度尚未定義運算窗口與權重，未合成指數。": {
    "zh-Hans": "分量独立呈现。线性聚焦度／非线性离散度尚未定义运算窗口与权重，未合成指数。",
    "en": "Components are shown separately. Linear focus and nonlinear dispersion have no defined windows or weights and are not combined into an index."
  },
  "小節內起點與時值以四分音符為1；時值合併延音。秒數是拍點插值估計，不是實測逐音起音。選取一列可定位。": {
    "zh-Hans": "小节内起点与时值以四分音符为1；时值合并延音。秒数是拍点插值估计，不是实测逐音起音。选取一列可定位。",
    "en": "Onsets and durations within a measure use the quarter note as 1; tied durations are combined. Times are estimated by beat interpolation, not measured note onsets. Select a row to locate it."
  },
  "肖邦研究院初版數字譜：M. Schlesinger, Paris，PL-Wbfc 3744/n。上譜表第1–8小節為單旋律；不按最高音提取聲部。延音續音不重計起音，裝飾音無實測時長，另列並排除常規密度與時值統計。": {
    "zh-Hans": "肖邦研究院初版数字谱：M. Schlesinger, Paris，PL-Wbfc 3744/n。上谱表第1–8小节为单旋律；不按最高音提取声部。延音续音不重计起音，装饰音无实测时长，另列并排除常规密度与时值统计。",
    "en": "Source: the Chopin Institute's first-edition digital score, M. Schlesinger, Paris, PL-Wbfc 3744/n. Measures 1–8 of the upper staff are monophonic; the voice is not extracted by selecting the highest note. Tied continuations do not count as new onsets. Grace notes, whose durations are not measured, are listed separately and excluded from the standard density and duration statistics."
  },
  "調內／調外是相對於來源明示降D大調音階的音名拼寫比對；不等於局部調性、和聲不協和或音樂品質。級進依音名字母相鄰判二度，保留實際半音差；重複及同字母半音變化分開計數。": {
    "zh-Hans": "调内／调外是相对于来源明示降D大调音阶的音名拼写比对；不等于局部调性、和声不协和或音乐质量。级进依音名字母相邻判二度，保留实际半音差；重复及同字母半音变化分开计数。",
    "en": "In-scale/out-of-scale classification compares note spelling against the source's stated D-flat major scale; it does not imply local tonality, harmonic dissonance, or musical quality. Steps are identified by adjacent note letters as seconds, retaining their actual semitone distance; repetitions and chromatic alterations of the same letter are counted separately."
  },
  "小節內起點和時值保留有理數。兩軸為音高與記譜時值；深度為整數小節。空間坐標是顯示編碼。來源人工八分音符拍點之間作分段線性定位；演奏版本與初版差異未逐音核實，裝飾音不配時，未測量延音踏板或實際音長。": {
    "zh-Hans": "小节内起点和时值保留有理数。两轴为音高与记谱时值；深度为整数小节。空间坐标是显示编码。来源人工八分音符拍点之间作分段线性定位；演奏版本与初版差异未逐音核实，装饰音不配时，未测量延音踏板或实际音长。",
    "en": "Within-measure onsets and durations retain rational values. The two axes are pitch and notated duration; depth represents integer measures. Spatial coordinates are display encodings. Time is piecewise-linearly interpolated between manually annotated eighth-note beats. Differences between the performance edition and first edition have not been verified note by note; grace notes are not aligned, and pedal use or actual note lengths are not measured."
  },
  "振幅沿用來源 0–100 標度；未提供譜面力度與響度校準。線性與變幅為探索性代理。": {
    "zh-Hans": "振幅沿用来源 0–100 标度；未提供谱面力度与响度校准。线性与变幅为探索性代理。",
    "en": "Amplitude retains the source's 0–100 scale; no score-dynamics or loudness calibration is available. Linearity and variability are exploratory proxies."
  },
  "二分音符/分": {
    "zh-Hans": "二分音符/分",
    "en": "half notes/min"
  },
  "八分音符/分": {
    "zh-Hans": "八分音符/分",
    "en": "eighth notes/min"
  },
  "附點四分音符/分": {
    "zh-Hans": "附点四分音符/分",
    "en": "dotted quarter notes/min"
  },
  "來源拍/分": {
    "zh-Hans": "来源拍/分",
    "en": "source beats/min"
  },
  "來源 0–100": {
    "zh-Hans": "来源 0–100",
    "en": "source scale 0–100"
  },
  "恆定段": {
    "zh-Hans": "恒定段",
    "en": "constant segment"
  },
  "代理": {
    "zh-Hans": "代理",
    "en": "proxy"
  },
  "至少3拍": {
    "zh-Hans": "至少3拍",
    "en": "at least 3 beats"
  },
  "個來源拍點": {
    "zh-Hans": "个来源拍点",
    "en": "source beat"
  },
  "顯示速度": {
    "zh-Hans": "显示速度",
    "en": "display tempo"
  },
  "來源發音間隔 · 未換算速度／振幅": {
    "zh-Hans": "来源发音间隔 · 未换算速度／振幅",
    "en": "Source inter-onset intervals · tempo/amplitude not converted"
  },
  "此位置沒有逐時標注": {
    "zh-Hans": "此位置没有逐时标注",
    "en": "No time annotation at this position"
  },
  "標注": {
    "zh-Hans": "标注",
    "en": "Annotation"
  },
  "平均速度": {
    "zh-Hans": "平均速度",
    "en": "Mean tempo"
  },
  "未平滑": {
    "zh-Hans": "未平滑",
    "en": "unsmoothed"
  },
  "按起音所在小節計數；跨小節音程歸入後音，休止斷鏈。密度單位：次／四分音符。": {
    "zh-Hans": "按起音所在小节计数；跨小节音程归入后音，休止断链。密度单位：次／四分音符。",
    "en": "Counted by onset measure; cross-bar intervals are assigned to the later note, and rests break chains. Density is events per quarter note."
  },
  "小節": {
    "zh-Hans": "小节",
    "en": "Measure"
  },
  "起音": {
    "zh-Hans": "起音",
    "en": "Onsets"
  },
  "密度": {
    "zh-Hans": "密度",
    "en": "Density"
  },
  "調外／起音": {
    "zh-Hans": "调外／起音",
    "en": "Out-of-scale / notes"
  },
  "級進／音程": {
    "zh-Hans": "级进／音程",
    "en": "Steps / intervals"
  },
  "跳進／音程": {
    "zh-Hans": "跳进／音程",
    "en": "Leaps / intervals"
  },
  "休止佔比": {
    "zh-Hans": "休止占比",
    "en": "Rest fraction"
  },
  "時值分布": {
    "zh-Hans": "时值分布",
    "en": "Duration distribution"
  },
  "速度曲線": {
    "zh-Hans": "速度曲线",
    "en": "Tempo Curve"
  },
  "逐拍速度": {
    "zh-Hans": "逐拍速度",
    "en": "Beat Tempo"
  },
  "相對振幅": {
    "zh-Hans": "相对振幅",
    "en": "Relative Amplitude"
  },
  "拍點間隔": {
    "zh-Hans": "拍点间隔",
    "en": "Beat Interval"
  },
  "演奏蠕蟲": {
    "zh-Hans": "演奏蠕虫",
    "en": "Performance Worm"
  },
  "速度結構": {
    "zh-Hans": "速度结构",
    "en": "Tempo Structure"
  },
  "觀察範圍": {
    "zh-Hans": "观察范围",
    "en": "Scope"
  },
  "8 小節": {
    "zh-Hans": "8 小节",
    "en": "8 Bars"
  },
  "16 小節": {
    "zh-Hans": "16 小节",
    "en": "16 Bars"
  },
  "全曲": {
    "zh-Hans": "全曲",
    "en": "Full Work"
  },
  "同作品版本對照": {
    "zh-Hans": "同作品版本对照",
    "en": "Cross-Version Comparison"
  },
  "跟隨": {
    "zh-Hans": "跟随",
    "en": "Follow"
  },
  "讀取作品…": {
    "zh-Hans": "读取作品…",
    "en": "Loading works..."
  },
  "讀取版本…": {
    "zh-Hans": "读取版本…",
    "en": "Loading recordings..."
  },
  "待播放 · 已核查研究錄音": {
    "zh-Hans": "待播放 · 已核查研究录音",
    "en": "Ready · Verified research audio"
  },
  "播放中 · 原站研究片段": {
    "zh-Hans": "播放中 · 原站研究片段",
    "en": "Playing · Research excerpt"
  },
  "播放暫停": {
    "zh-Hans": "播放暂停",
    "en": "Playback paused"
  },
  "播放完成": {
    "zh-Hans": "播放完成",
    "en": "Playback complete"
  },
  "音訊未能載入 · 檢查原站連接": {
    "zh-Hans": "音频未能加载 · 检查原站连接",
    "en": "Audio failed to load · Check connection"
  },
  "案例暫不可用 · 重新選擇音樂可重試": {
    "zh-Hans": "案例暂不可用 · 重新选择音乐可重试",
    "en": "Case unavailable · Re-select to retry"
  },
  "案例讀取失敗": {
    "zh-Hans": "案例读取失败",
    "en": "Failed to load case"
  },
  "原始逐拍速度": {
    "zh-Hans": "原始逐拍速度",
    "en": "Raw Beat Tempo"
  },
  "線性代理 R²": {
    "zh-Hans": "线性代理 R²",
    "en": "Linearity Proxy R²"
  },
  "變幅代理 |log₂比|": {
    "zh-Hans": "变幅代理 |log₂比|",
    "en": "Step Proxy |log₂ ratio|"
  },
  "速度高斯窗": {
    "zh-Hans": "速度高斯窗",
    "en": "Tempo Gaussian Window"
  },
  "標注聲部": {
    "zh-Hans": "标注声部",
    "en": "Annotated Part"
  },
  "案例來源": {
    "zh-Hans": "案例来源",
    "en": "Case Provenance"
  },
  "觀察暫停": {
    "zh-Hans": "观察暂停",
    "en": "Observation Paused"
  },
  "歷史樣本": {
    "zh-Hans": "历史样本",
    "en": "Historical Sample"
  },
  "資料中斷 · 保留軌跡": {
    "zh-Hans": "数据中断 · 保留轨迹",
    "en": "Stream Interrupted · Trace Retained"
  },
  "暫停回放": {
    "zh-Hans": "暂停回放",
    "en": "Pause Replay"
  },
  "腦電 · 上軸關注／右軸放鬆": {
    "zh-Hans": "脑电 · 上轴关注／右轴放松",
    "en": "EEG · Top Attention / Right Meditation"
  },
  "腦電 · 關注（實線）／放鬆（虛線）": {
    "zh-Hans": "脑电 · 关注（实线）／放松（虚线）",
    "en": "EEG · Attention (solid) / Meditation (dashed)"
  },
  "速度 · 線性代理 × 變幅代理 × 小節": {
    "zh-Hans": "速度 · 线性代理 × 变幅代理 × 小节",
    "en": "Tempo · Linearity × Step × Bars"
  },
  "音樂 · 速度 × 相對振幅 × 播放時間": {
    "zh-Hans": "音乐 · 速度 × 相对振幅 × 播放时间",
    "en": "Music · Tempo × Relative Level × Time"
  },
  "音樂 · 速度 × 相對振幅 · 小節標記": {
    "zh-Hans": "音乐 · 速度 × 相对振幅 · 小节标记",
    "en": "Music · Tempo × Relative Level · Bar Markers"
  },
  "音樂 · 原始拍點／高斯顯示／相對振幅灰帶": {
    "zh-Hans": "音乐 · 原始拍点／高斯显示／相对振幅灰带",
    "en": "Music · Raw Beats / Gaussian / Relative Level"
  },
  "音樂 · 拍點間隔": {
    "zh-Hans": "音乐 · 拍点间隔",
    "en": "Music · Beat Interval"
  },
  "音樂 · 相對振幅 · 來源 0–100": {
    "zh-Hans": "音乐 · 相对振幅 · 来源 0–100",
    "en": "Music · Relative Amplitude · Source 0–100"
  },
  "音樂 · 速度": {
    "zh-Hans": "音乐 · 速度",
    "en": "Music · Tempo"
  },
  "探索": {
    "zh-Hans": "探索",
    "en": "Explore"
  },
  "演奏": {
    "zh-Hans": "演奏",
    "en": "Performance"
  },
  "腦電": {
    "zh-Hans": "脑电",
    "en": "EEG"
  },
  "音級探索": {
    "zh-Hans": "音级探索",
    "en": "Pitch Class Exploration"
  },
  "重設視角": {
    "zh-Hans": "重设视角",
    "en": "Reset View"
  },
  "試聽": {
    "zh-Hans": "试听",
    "en": "Audition"
  },
  "音級": {
    "zh-Hans": "音级",
    "en": "Pitch Class"
  },
  "根音": {
    "zh-Hans": "根音",
    "en": "Root"
  },
  "和弦": {
    "zh-Hans": "和弦",
    "en": "Chord"
  },
  "和弦類型": {
    "zh-Hans": "和弦类型",
    "en": "Chord Quality"
  },
  "大三和弦": {
    "zh-Hans": "大三和弦",
    "en": "Major Triad"
  },
  "小三和弦": {
    "zh-Hans": "小三和弦",
    "en": "Minor Triad"
  },
  "小節分量": {
    "zh-Hans": "小节分量",
    "en": "Measure Components"
  },
  "逐音證據": {
    "zh-Hans": "逐音证据",
    "en": "Note-by-Note Evidence"
  },
  "譜面音高": {
    "zh-Hans": "谱面音高",
    "en": "Score Pitch"
  },
  "旋律音程": {
    "zh-Hans": "旋律音程",
    "en": "Melodic Interval"
  },
  "記譜時值／四分音符": {
    "zh-Hans": "记谱时值／四分音符",
    "en": "Notated Duration / Quarter"
  },
  "匯出證據 JSON": {
    "zh-Hans": "导出证据 JSON",
    "en": "Export Evidence JSON"
  },
  "版本實驗": {
    "zh-Hans": "版本实验",
    "en": "Version Experiment"
  },
  "選擇同一作品的三個版本": {
    "zh-Hans": "选择同一作品的三个版本",
    "en": "Select 3 versions of the same work"
  },
  "觀察時長": {
    "zh-Hans": "观察时长",
    "en": "Duration"
  },
  "開始版本 1": {
    "zh-Hans": "开始版本 1",
    "en": "Start Version 1"
  },
  "結束本次": {
    "zh-Hans": "结束本次",
    "en": "Stop Current"
  },
  "保存實驗": {
    "zh-Hans": "保存实验",
    "en": "Save Experiment"
  },
  "新一組": {
    "zh-Hans": "新一组",
    "en": "New Group"
  },
  "有效點": {
    "zh-Hans": "有效点",
    "en": "Valid Points"
  },
  "速度—關注": {
    "zh-Hans": "速度—关注",
    "en": "Tempo-Attention"
  },
  "速度—放鬆": {
    "zh-Hans": "速度—放松",
    "en": "Tempo-Meditation"
  },
  "現場設備資料 · 逐版本描述統計": {
    "zh-Hans": "现场设备数据 · 逐版本描述统计",
    "en": "Live Device Data · Descriptive Statistics by Version"
  },
  "計算與時間配對": {
    "zh-Hans": "计算与时间配对",
    "en": "Computation & Time Pairing"
  },
  "來源 → 觀測 → 人工核對": {
    "zh-Hans": "来源 → 观测 → 人工核对",
    "en": "Source → Observation → Manual Verification"
  },
  "演奏蠕蟲原研究呈現音樂速度與響度的時間軌跡。本頁移植雙參數時間顯示方法，使用設備回報的專注與冥想／放鬆指數；並非音樂速度—響度量測，也不是腦區連通圖。": {
    "zh-Hans": "演奏蠕虫原研究呈现音乐速度与响度的时间轨迹。本页移植双参数时间显示方法，使用设备回报的专注与冥想／放松指数；并非音乐速度—响度量测，也不是脑区连通图。",
    "en": "The original Performance Worm visualized time trajectories of tempo and loudness. This page adapts the dual-parameter method to plot attention and meditation indices from hardware; it does not measure tempo/loudness or claim brain connectivity."
  },
  "每個軌跡點對應一筆有效記錄。斷流、接觸不良與來源切換時斷線。預設顯示原始位置；可選平滑僅影響顯示。0–127是可核對的坐標換算，不是MIDI訊息。": {
    "zh-Hans": "每个轨迹点对应一笔有效记录。断流、接触不良与来源切换时断线。预设显示原始位置；可选平滑仅影响显示。0–127是可核对的坐标换算，不是MIDI消息。",
    "en": "Each node corresponds to a valid sample. Data breaks on dropout, poor contact or source switch. Raw coordinates plotted by default; smoothing affects display only. 0–127 is a verified coordinate mapping, not a MIDI command."
  },
  "標準距離：以有效連續段的實際時間加權，計算距離質心的均方根半徑，單位保持原生指數。未設定「健康／複雜」閾值。移除了無來源支持的十種預置幾何、密集度閾值及EEG至音樂數值公式。": {
    "zh-Hans": "标准距离：以有效连续段的实际时间加权，计算距离质心的均方根半径，单位保持原生指数。未设定「健康／复杂」阈值。移除了无来源支持的十种预置几何、密集度阈值及EEG至音乐数值公式。",
    "en": "Standard distance: root-mean-square radius from centroid weighted by duration of valid continuous segments, retaining native index units. No normative 'health/complexity' thresholds. Unsupported geometric presets, density thresholds and EEG-to-music formulas are removed."
  },
  "手錶心率": {
    "zh-Hans": "手表心率",
    "en": "Watch heart rate"
  },
  "樣本": {
    "zh-Hans": "样本",
    "en": "sample"
  },
  "未找到ADB入口；請選擇本機ADB程式": {
    "zh-Hans": "未找到ADB入口；请选择本机ADB程序",
    "en": "No ADB entry found; choose the local ADB program"
  },
  "等待已配對手錶及前台採集端": {
    "zh-Hans": "等待已配对手表及前台采集端",
    "en": "Waiting for a paired watch and its foreground collector"
  },
  "請在手錶確認身體傳感器權限": {
    "zh-Hans": "请在手表确认身体传感器权限",
    "en": "Confirm the body sensor permission on the watch"
  },
  "手錶尚未授予身體傳感器權限": {
    "zh-Hans": "手表尚未授予身体传感器权限",
    "en": "The watch has not granted the body sensor permission"
  },
  "請佩戴手錶，等待新的心率測量": {
    "zh-Hans": "请佩戴手表，等待新的心率测量",
    "en": "Wear the watch and wait for a new heart-rate measurement"
  },
  "手錶接觸品質待確認": {
    "zh-Hans": "手表接触品质待确认",
    "en": "Watch contact quality needs confirmation"
  },
  "手錶採集已停止": {
    "zh-Hans": "手表采集已停止",
    "en": "Watch collection stopped"
  },
  "手錶前台採集已暫停": {
    "zh-Hans": "手表前台采集已暂停",
    "en": "Watch foreground collection is paused"
  },
  "手錶心率傳感器不可用": {
    "zh-Hans": "手表心率传感器不可用",
    "en": "The watch heart-rate sensor is unavailable"
  },
};

let currentLanguage = 'zh-Hans';
const listeners = new Set();
let dynamicContentObserver;

export function getLanguage() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'zh-Hant';
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && ['zh-Hans', 'zh-Hant', 'en'].includes(stored)) {
    return stored;
  }
  const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (nav.startsWith('en')) return 'en';
  if (nav.includes('tw') || nav.includes('hk') || nav.includes('hant')) return 'zh-Hant';
  return 'zh-Hans';
}

export function t(key, lang = currentLanguage) {
  if (!key || typeof key !== 'string') return key;
  const trimmed = key.trim();
  if (lang === 'zh-Hant') {
    return TRANSLATIONS[trimmed]?.['zh-Hant'] || key;
  }
  const entry = TRANSLATIONS[trimmed];
  if (entry && entry[lang]) {
    const leading = key.match(/^\s*/)[0];
    const trailing = key.match(/\s*$/)[0];
    return leading + entry[lang] + trailing;
  }
  if (lang === 'zh-Hans') {
    return toSimplified(key);
  }
  // English fallback: try translating parts or return simplified
  return key;
}

export function setLanguage(lang) {
  if (!['zh-Hans', 'zh-Hant', 'en'].includes(lang)) return;
  currentLanguage = lang;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    translateDocument(document, lang);
    updateLanguageButtons(lang);
    window.dispatchEvent(new CustomEvent('app:language-change', { detail: { lang } }));
  }
  for (const fn of listeners) {
    try { fn(lang); } catch {}
  }
}

export function onLanguageChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function updateLanguageButtons(lang) {
  const buttons = document.querySelectorAll('.lang-btn');
  buttons.forEach(btn => {
    const target = btn.dataset.lang;
    btn.classList.toggle('active', target === lang);
    btn.setAttribute('aria-pressed', String(target === lang));
  });
}

export function translateDocument(root = document, lang = currentLanguage) {
  if (!root) return;

  if (root === document && document.title) {
    if (!document.documentElement.dataset.origTitle) {
      document.documentElement.dataset.origTitle = document.title;
    }
    const orig = document.documentElement.dataset.origTitle;
    document.title = t(orig, lang);
  }

  // TreeWalker over all elements and text nodes (do NOT filter out pre)
  const walker = document.createTreeWalker(
    root.body || root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();
          if (['script', 'style', 'svg', 'audio'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.classList?.contains('lang-switch') || node.classList?.contains('lang-btn')) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const elementsToTranslate = [];
  const textNodesToTranslate = [];

  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      elementsToTranslate.push(current);
    } else if (current.nodeType === Node.TEXT_NODE) {
      if (current.nodeValue && current.nodeValue.trim().length > 0) {
        textNodesToTranslate.push(current);
      }
    }
    current = walker.nextNode();
  }

  // Attributes
  for (const el of elementsToTranslate) {
    for (const attr of ['placeholder', 'aria-label', 'title']) {
      if (el.hasAttribute(attr)) {
        const origAttr = `data-orig-${attr}`;
        if (!el.hasAttribute(origAttr)) {
          el.setAttribute(origAttr, el.getAttribute(attr));
        }
        const origVal = el.getAttribute(origAttr);
        const trans = t(origVal, lang);
        // Always write the resolved value: for zh-Hant the translation often IS
        // the original text, and comparing against the original instead of the
        // attribute's current value left the previous language's string in place
        // (a Chinese page showing an English placeholder).
        if (trans) {
          el.setAttribute(attr, trans);
        }
      }
    }
  }

  // Text Nodes
  for (const textNode of textNodesToTranslate) {
    const parent = textNode.parentElement;
    if (!parent) continue;
    if (!textNode._i18nOriginal) {
      textNode._i18nOriginal = textNode.nodeValue;
    }
    const original = textNode._i18nOriginal;
    const translated = t(original, lang);
    if (translated !== textNode.nodeValue) {
      textNode.nodeValue = translated;
    }
  }
}

export function initI18n() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  currentLanguage = getLanguage();
  document.documentElement.lang = currentLanguage;
  document.documentElement.dataset.lang = currentLanguage;

  const switcher = document.getElementById('lang-switcher');
  if (switcher && !switcher.dataset.bound) {
    switcher.dataset.bound = 'true';
    switcher.innerHTML = `
      <button type="button" data-lang="zh-Hans" class="lang-btn ${currentLanguage === 'zh-Hans' ? 'active' : ''}" aria-label="简体中文">简</button>
      <button type="button" data-lang="zh-Hant" class="lang-btn ${currentLanguage === 'zh-Hant' ? 'active' : ''}" aria-label="繁體中文">繁</button>
      <button type="button" data-lang="en" class="lang-btn ${currentLanguage === 'en' ? 'active' : ''}" aria-label="English">EN</button>
    `;
    switcher.onclick = event => {
      const btn = event.target.closest('.lang-btn');
      if (!btn) return;
      const targetLang = btn.dataset.lang;
      if (targetLang) setLanguage(targetLang);
    };
  }

  updateLanguageButtons(currentLanguage);
  translateDocument(document, currentLanguage);
  if (!dynamicContentObserver) {
    dynamicContentObserver = new MutationObserver(records => {
      const roots = new Set();
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            const root = node.parentElement;
            if (root) roots.add(root);
          }
        }
      }
      for (const root of roots) {
        translateDocument(root, currentLanguage);
      }
    });
    dynamicContentObserver.observe(document.body, {childList: true, subtree: true});
  }
}
