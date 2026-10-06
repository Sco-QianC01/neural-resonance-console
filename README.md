# 神经共振控制台 · Neural Resonance

一个可以独立运行的脑波交互网页：把专注度、放松度变成二维轨迹、贪吃蛇和音乐控制参数。

**打开就能看到动态可视化。** 无设备时使用明确标注的示范数据；
有设备时可以接入自己的 WebSocket 数据源。

## 直接体验

[打开在线控制台](https://sco-qianc01.github.io/neural-resonance-console/)

页面默认运行示范。拖动「专注度」「放松度」滑杆，观察轨迹和音乐参数变化。
取消「自动变化」后，滑杆直接控制两个数值；也可切换到贪吃蛇。
声音需要主动点击开启，页面不会自动播放。

![控制台：左侧输入、中央互动轨迹、右侧音乐参数、下方频段曲线](public/console.png)

## 能做什么

- 显示专注度／放松度的二维轨迹与四个 EEG 频段曲线。
- 用同一份输入驱动贪吃蛇和十项可修改的音乐参数。
- 连接自己的实时数据源，并处理断线、过期和缺值。
- 记录当前输入，导出 JSON／CSV，导入 JSON 回放。
- 在桌面、平板和手机浏览器中使用。

## 在自己的电脑上运行

安装 Node.js 20 或更新版本，然后执行：

```bash
git clone https://github.com/Sco-QianC01/neural-resonance-console.git
cd neural-resonance-console
npm start
```

打开终端显示的地址，默认是 `http://127.0.0.1:5173/`。
运行没有第三方依赖，无需另外安装实验室软件或设备驱动。
Windows、macOS、Linux 使用相同的命令。

需要换端口：

```bash
npm start -- --port 6123
```

需要让同一局域网的手机打开：

```bash
npm start -- --host 0.0.0.0 --port 6123
```

手机访问这台电脑的局域网 IP 和所选端口。

## 接自己的数据

左侧选择「接入数据」，填写你的 `ws://` 或 `wss://` 地址，再点击连接。
不预设任何人的电脑路径、设备名称或服务器地址。

[数据格式与接入示例](docs/DATA-INPUT.md) · [音乐参数映射](docs/MAPPING.md)

真实 USB／BLE 设备需要自己的驱动或网关把数据转成约定的 JSON 格式。
控制台不会自动扫描设备，也不替代各厂商的驱动。

## 开发与部署

```bash
npm test
npm run build
```

`dist/` 可部署到任意静态网站主机。本仓库的 `main` 更新会自动测试并发布 GitHub Pages。
自己的部署可编辑 `public/config.json` 配置默认来源、资料地址和主题。

主要代码：

| 文件 | 负责什么 |
| --- | --- |
| `src/app.mjs` | 界面、轨迹、记录与回放 |
| `src/eeg.mjs` | 输入校验、新鲜度与连接 |
| `src/music.mjs` | 音乐映射、贪吃蛇与声音 |
| `src/config.mjs` | 可配置的启动方式和示范数据 |
| `src/style.css` | 主题和响应式布局 |

欢迎 Fork 后提交 Pull Request。[开发约定](docs/HANDOFF.md)

## 授权与范围

[MIT License](LICENSE)。这是数据交互与音乐参数研究工具，未实现医疗诊断或正式疗效评估。
记录只保留在当前页面；刷新或关闭前请先导出。
