# 神經共振控制台

独立的 EEG 脑机接口前端：脑波输入 → 专注/放松二维轨迹与贪吃蛇 → 十项实验音乐参数。
与夜莺四模型网站分开开发。v0.2 接入本地音疗启动链，
EEG 负责互动；血氧、脉率、HRV、GSR 独立显示和记录。

## 本机运行

需要 Node.js 20+。无第三方依赖，无需 `npm install`。

```powershell
npm start
# 或者使用 PowerShell 7
./tools/Start-Console.ps1
```

打开 `http://127.0.0.1:8767/` 后自动连接。没有设备数据时显示等待，
可主动选择“示范 → 开始示范”体验。不会自动切换到模拟数据。

### 与本地音疗系统一起启动

PowerShell 7 执行现有入口：

```powershell
& 'Q:\音疗系统\澳门科技大学\01_核心系统\music-therapy-pod-sensors\运行澳门版.ps1'
```

统一启动器启动主服务、控制台、Max、Resolume、MuMu 和既有视觉程序，
并打开控制台网页。主服务和控制台默认背景运行；
需要原来的传感器终端时为上述入口添加 `-Visible`。
已有控制台服务会复用；端口被其他程序占用时拒绝重复启动。

本机网页通过自身 `/ws/live` 只读代理到 `127.0.0.1:8002/ws/live`，
避免依赖局域网 IP。连接断开后退避重连；手动停止会取消重连。
静态云端网页保留可编辑的直接接口，须另行配置安全设备网关。

后台面板每 5 秒读取状态，程序清单最多每 10 秒检查一次，
通过隐藏的 PowerShell 7 子进程核对程序与所属端口，不反复弹终端。
程序运行、接口可用、设备出数据分别显示；不把进程存在当作设备成功。

停止原系统时控制台也会停止：

```powershell
& 'Q:\音疗系统\澳门科技大学\01_核心系统\music-therapy-pod-sensors\停止澳门版.ps1'
```

原有停止器仍保护未确认独占的 Max、Resolume、MuMu 和共用上音图表进程。
页面只读取数据，不自动开始疗程或创建正式受试记录。

```powershell
npm test
npm run build
```

`dist/` 是独立静态网站，可部署 GitHub Pages、Cloudflare Pages 或其他静态主机。
GitHub 工作流在创建仓库后需在 Settings → Pages 选择 GitHub Actions。
`.dev` 域名绑定到所选静态主机；域名与供应商尚未配置。

源码已同步至独立私有仓库：

```text
https://github.com/Sco-QianC01/neural-resonance-console
https://github.dev/Sco-QianC01/neural-resonance-console
```

第二个地址是在线代码编辑器，不是运行网站。
2026-10-06 实测仓库推送/重新克隆/自动构建通过；
GitHub Pages 建站返回 HTTP 422，提示当前账户方案不支持此私有仓库。
尚未公开源码或购买方案；可为完成的静态站配置其他部署平台。

## 云端页面与本机设备

HTTPS 页面访问本机 WS 可能被浏览器安全策略拦截；不能将云端部署成功等同于设备接入成功。
现场接设备请先使用本机 HTTP 页面，或给设备网关配置可信 `wss://` 后填写地址。
设备仅在内网时，云端服务器不能直接访问它。

## 协作

建议使用独立 GitHub 仓库，初始推送后双方按 branch → pull request 合并。
`.gitignore` 排除实验记录、构建产物与凭证。不要把真实受试者记录提交 GitHub。
主要编辑入口：

- `src/app.mjs`：界面、录制/回放与交互。
- `src/eeg.mjs`：主服务协议、新鲜度、重连与数据校验。
- `src/sensors.mjs`：血氧、脉率、HRV、GSR 的独立缺值/新鲜度处理。
- `tools/serve.mjs`、`tools/runtime.mjs`：本机只读 WebSocket 和后台状态。
- `src/music.mjs`：音乐参数映射和声预览，后续替换蒸馏模型。
- `src/style.css`：MUST 紫白/SHCM 蓝白和响应式布局。
- `docs/MAPPING.md`：字段、单位与映射契约。
- `tests/`：数据与状态验证。

2026-10-06 已实际启动本机主服务和九个登记程序，确认所需端口归属，
并在 Edge 核验自动连接、全部接收字段显示、重连与手机布局；
详见 `docs/ACCEPTANCE.md`。尚未完成真实设备验收、正式 PRO 要素定义、完整音乐合成、
大模型蒸馏或受试数据临床验证。当前版本将这些边界保留在接入文档中。
