# 环境与验收范围

## 运行方式

| 环境 | 方式 |
| --- | --- |
| Windows 10/11 x64 | 完整原生应用包；源码启动需PowerShell 7。Windows 10 实机仍待验证 |
| Mac Apple Silicon | 对应ARM64应用包或源码启动器 |
| Mac Intel | 对应x64应用包或源码启动器 |
| 现代桌面浏览器 | 同源本机采集器提供网页和WebSocket；浏览器无需直接支持USB/BLE |
| 手机／平板浏览器 | 可查看静态示范或连接自己配置的可达网关；不包含原生手机USB/BLE采集器 |
| Linux | 源码采集网关；目前没有本项目的Linux原生应用包 |

支持的Python范围为3.11–3.13，前端开发／静态服务需要Node 20或更新版本。独立应用包自带运行时。

仓库配置的自动化兼容矩阵为Windows、Mac ARM、Mac Intel、Linux的Python 3.11、3.12、3.13；Node 20、22、24；Chromium、Firefox、WebKit。这里描述测试任务配置，不等于本轮已经在所有环境运行通过。本轮现场证据分别列在`artifacts/portable-20261012/`，Mac原生构建和真实设备采集仍待实机验收。

这些是明确的测试矩阵，不涵盖所有历史系统版本、浏览器版本、芯片、厂商私有协议或无限时长运行。

2026-10-12復檢增加Windows Edge與Linux的Chromium／Firefox／WebKit實際交互流程：三頁切換、記錄與CSV匯出、回放、斷流、網絡恢復和響應式顯示。Linux WebKit在測試專用目錄補齊其系統庫後執行，沒有修改全域軟體配置；它不是macOS上的Safari驗收。Windows11完整包、中文空格路徑搬遷、離線重啟及缺依賴自動修復提供现场證據。Windows10、Windows ARM64和Mac ARM／Intel實機、冷開機與實體電極精度仍待目標環境核對。

## 设备与权限

设备协议及身份匹配见[设备矩阵](DEVICE-MATRIX.md)。未知协议需增加适配器，不能通过通用蓝牙名称推断其数据格式。

第一次蓝牙授权、系统隐私权限及缺失的厂商驱动由操作系统处理。macOS发行包目前没有Apple Developer签名或公证，首次打开按系统提示完成。

源代码目录不再写入运行环境。源码版在每用户、每系统架构的独立目录安装；原生包自带运行时、用户配置保存到本用户的数据目录。不复制作者的虚拟环境、系统Python、个人配置或采集记录。Windows运行依赖固定为Bleak 2.1.1，其他系统固定为3.0.2，避免3系列Windows后端的较高系统门槛；锁文件保留完整平台分支。

## 重现

```sh
npm test
npm run build
```

```sh
cd gateway
uv sync --frozen --no-dev
uv run --frozen --no-dev python -W error -m unittest discover -s tests -v
```

浏览器验收只在独立测试环境安装`audit`组，不进入正常采集依赖：

```sh
cd gateway
uv sync --frozen --group audit
uv run --frozen --group audit playwright install chromium firefox webkit
```

然后使用该环境的Python运行`tools/browser-audit.py --engine chromium`，`firefox`和`webkit`同理。该脚本创建独立采集器并禁用所有硬件通道。源码／原生启动检查使用`tools/runtime-smoke.py`，同样禁用设备。

`tools/portable-smoke.py`另验收：中文空格路径搬迁、离线再次启动、重复点击、端口冲突、退出后重启。Mac `.app`复制整个Bundle并保留符号链接，不只复制可执行文件。`gateway/tests/test_portable.py`覆盖Mac cu/tty别名、跨进程锁及端口权限错误，这些受控测试不能冒充Mac系统或USB/BLE实机通过。

`tools/system-audit-static.py`檢查可部署文字的UTF-8、JSON、本地頁面與模組引用及腳本解析。`tools/system-full-browser.py`驗收全部三個頁面的七種尺寸、中文設定／回放、音樂目錄缺件後重試與方法頁。`tools/verify-missing-dependency.py`只在專用QA目錄移走依賴以驗證恢復，不操作使用者采集環境。這些測試不讀取或恢復憑證。

## 依据

接口、权限与会话生命周期参考[Web Serial](https://developer.chrome.com/docs/capabilities/serial)、[Bleak](https://bleak.readthedocs.io/en/latest/)、[aiohttp](https://docs.aiohttp.org/en/stable/web_advanced.html)官方文档。音乐与图形依据继续采用[证据说明](EVIDENCE.md)。
