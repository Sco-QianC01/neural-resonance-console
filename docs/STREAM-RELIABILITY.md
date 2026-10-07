# 实时采集与连接恢复

## 三种入口

- 公共静态网页默认展示示范数据，不会自动占用硬件。
- 本机采集入口可以通过 `/public/config.json` 指定 `startupMode: "live"`、`endpoint: "/ws/live"` 和 `autoConnect: true`。使用同源接口，浏览器不需要知道电脑在局域网里的 IP。
- Web Serial／Web Bluetooth 直接接入需要用户首次选取并授权。已经授权的连接在中断后重试；停止连接和关闭页面取消重试。与系统核心采集择一使用，避免串口占用。

## 数据合同

在原有 `frontal-live-v1` 或 `neural-resonance-live-v1` 的基础上，可提供：

| 字段 | 含义 |
| --- | --- |
| `transport` | 实际 USB、BLE 或其他采集来源；无有效输入时为 `none` |
| `connectionEpoch` | 设备重连或来源变化时递增，前端清空当前绘制缓存 |
| `fieldTimestamps` | 每个指标的真实更新时间，以 Unix 秒表示 |
| `sampleSequence` | 硬件数据和分析结果的递增序号，不靠 API 心跳假装有新数据 |
| `rawEegSamples` | 本次发送的原始样本；前端保留来源单位 |
| `rawSequence` / `rawDropped` | 原始样本游标，以及传输窗口超时后明确缺失的数量 |
| `sampleRate` | 采集器的配置采样率，不能用于声称所有型号相同 |
| `bandRanges` | 当前解析器实际使用的频段边界 |
| `metricOrigin` | 如 `thinkgear-esense`；原生指数与频段比值分开 |

字段超过 3 秒没有更新即失效。ThinkGear 不可用的 eSense 零值不驱动音乐映射。接触不良时原始采集数值仍可用于检查，但专注度／放松度交互和提示词停用。

## 波形

上方绘制有效的设备原生专注度／放松度，下方为 Delta、Theta、Alpha、Beta 四条纵向时间曲线和原始脑波。缺值、时间间隔、来源变化及单位变化都断开曲线，不做插值补齐。

## 恢复

WebSocket 对关闭连接及静默连接重试，退避为 1、2、4、8、15 秒。只有成功收到数据才重置退避。旧连接回调不能修改当前流。手动停止后不再自动连接。

浏览器接口可用、操作系统已识别设备、串口已打开、有真实数据、接触良好是不同状态。功能验收必须分别检查，不能用 HTTP 成功替代真实硬件检测。
