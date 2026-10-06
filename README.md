# 神經共振控制台

独立的 EEG 脑机接口前端：脑波输入 → 专注/放松二维轨迹与贪吃蛇 → 十项实验音乐参数。
与夜莺四模型网站分开开发，首版仅接 EEG。

## 本机运行

需要 Node.js 20+。无第三方依赖，无需 `npm install`。

```powershell
npm start
# 或者使用 PowerShell 7
./tools/Start-Console.ps1
```

打开 `http://127.0.0.1:8767/`。预设无数据；点击“示范”后“开始示范”体验。
真实接口默认 `ws://127.0.0.1:8002/ws/live`；须由现有音疗感测器主服务先启动。
本控制台不启动 Max/MuMu、改变设备连接或开始原系统实验记录。

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
- `src/music.mjs`：音乐参数映射和声预览，后续替换蒸馏模型。
- `src/style.css`：MUST 紫白/SHCM 蓝白和响应式布局。
- `docs/MAPPING.md`：字段、单位与映射契约。
- `tests/`：数据与状态验证。

尚未完成真实设备验收、正式 PRO 要素定义、完整音乐合成、
大模型蒸馏或受试数据临床验证。当前版本将这些边界保留在接入文档中。
