# 接入你自己的数据

控制台接收 WebSocket JSON 数据。设备驱动和解析程序由数据提供方负责，
前端只需要一个可访问的 `ws://` 或 `wss://` 地址。

## 最小示例

你的网关每取得一个新样本，就发送：

```js
socket.send(JSON.stringify({
  schemaVersion: 'neural-resonance-live-v1',
  source: 'device',
  ts: Date.now() / 1000,
  quality: { eegPackets: ++sampleCounter },
  eeg: {
    attention: 62,
    meditation: 74,
    delta: 22,
    theta: 28,
    alpha: 39,
    beta: 34
  }
}));
```

`attention`、`meditation` 是输入方提供的 0–100 指数。
上面的数字只是格式示例，实际接入时应换成你的测量值。

| 字段 | 含义 |
| --- | --- |
| `ts` | 样本时间，Unix 秒 |
| `quality.eegPackets` | 有效样本累计计数，每个新样本递增 |
| `eeg.attention` | 专注度，0–100 |
| `eeg.meditation` | 放松度，0–100 |
| `eeg.delta/theta/alpha/beta` | 来源的四个频段值 |
| `eeg.poor_signal` | 可选，0 表示接触良好；大于 0 时不参与互动 |

## 在界面连接

1. 选择左侧「接入数据」。
2. 填入你的网关地址。
3. 点击「连接数据源」。

没有预设的个人服务器、设备名称、文件目录或设备端口。
HTTPS 网站使用 `wss://`；本机 HTTP 页面也可以使用 `ws://`。
网关需要允许当前网页的来源（Origin），并提供相应的网络访问权限。

## 固定部署配置

编辑 `public/config.json`，让自己的部署自动接入自己的网关：

```json
{
  "startupMode": "live",
  "endpoint": "wss://your-gateway.example/eeg",
  "autoConnect": true
}
```

数据源断线后会自动重连，按「停止」可取消。无数据不会自动换成示范。

## 有效性与兼容

- 无数据、无效数值、接触不良或 3 秒没有新样本时，停止轨迹与声音。
- 不能用连续发送心跳代替新增的有效样本计数。
- 只提供频段时仍可观察曲线，缺少两个有效指数时不驱动二维互动。
- `focus_index`、`relaxation_index` 保留为比值，不当成 0–100 分数。
- `_mean` 字段保留 RMS 相对量尺，不能与装置功率值混为同一单位。
- 兼容既有 `frontal-live-v1` 数据包，便于适配已有网关。

可选的 `spo2`、`pr`、`hrv`、`gsr` 显示在折叠区域；
分别使用 `spo2Samples`、`prSamples`、`hrvSamples`、`gsrSamples` 计数。
脉率不代替 HRV，缺少的通道保持空值。

## 设备支持范围

浏览器界面适用于桌面、平板和手机。真实硬件需提供符合上述格式的网关；
本项目没有内置全部厂商的 USB/BLE 驱动，也不自动扫描或占用设备。
你可以在任意操作系统上运行自己的设备解析器，然后把结果发给这个前端。
