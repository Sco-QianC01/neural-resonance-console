# 采集时序与双指数配对

适用版本：0.11.6，构建 `clarity-stream-20261021-v1`。

网关仍输出 `neural-resonance-live-v1`。以下字段为兼容增量：

| 字段 | 含义 |
| --- | --- |
| `ts`、`fieldTimestamps`、`sensorTimestamps` | 原始宿主墙钟秒，用于追溯 |
| `clock.schema` | `neural-stream-clock-v1` |
| `clock.monotonicMs` | 网关宿主单调时间毫秒，不能当作UTC |
| `packetSequence` | 同一`sessionId`中每次快照递增；状态查询也会取快照，跳号不代表丢包 |
| `fieldAgesMs` | 各EEG字段最后有效更新的单调年龄 |
| `sensorAgesMs` | 各独立传感器最后有效事件年龄，缺失为null |
| `indexPair` | 同次ThinkGear报告包含有效Attention、Meditation时的数值、原始`at`、`ageMs`及报告`sequence`；没有时为null |

同报告指数对仅在3秒内保留；raw或单项更新不会刷新这个点。指数0/无效、换源和断开会清空配对。它表示同次协议报告，不证明设备内部两个算法在同一ADC采样时刻计算。单项可独立显示，缺少指数对时不建立新XY点。

浏览器把一个会话映射到`performance.timeOrigin + performance.now()`的连续显示时间，使用网关单调增量和年龄判断失效。EEG为3秒，独立传感器为15秒。导出中`ts`及字段时间使用显示时间，同时以`originalTimestamp`、`originalFieldTimestamps`、`originalSensorTimestamps`、`originalIndexPair`保留原始证据；JSON和CSV保留序号、年龄、时钟与配对方式。回放平移显示时间，原始时间不变。

旧合同和旧记录保留原字段。旧记录可能使用不同更新时间的最近双指数；`pairMethod=legacy-latest-fields`及`pairDeltaMs`明确该限制，不写成同次观测。缺少新时钟的外部旧网关不能获得网关时钟回拨保护。

`rawSequence`、`rawDropped`、`rawBreaks`与协议错误分别保留。rawDropped只反映网关环形缓冲覆盖量，不能证明硬件零丢包；100ms快照调度也不是设备到屏幕延迟。没有逐ADC硬件时钟及声卡同步标定，音乐与神经图只按本机显示时间配对。

回归覆盖墙钟前跳/回拨、乱序、重复、损坏时钟、指数异步更新、失效、原始时间保留、录制回放及非有限传感器隔离。受控协议测试不代替真实设备、Mac权限、睡眠唤醒和长时采集验收。
