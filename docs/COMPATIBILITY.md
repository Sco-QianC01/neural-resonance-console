# 环境与验收范围

## 运行方式

| 环境 | 方式 |
| --- | --- |
| Windows x64 | 完整原生应用包；源码启动需PowerShell 7 |
| Mac Apple Silicon | 对应ARM64应用包或源码启动器 |
| Mac Intel | 对应x64应用包或源码启动器 |
| 现代桌面浏览器 | 同源本机采集器提供网页和WebSocket；浏览器无需直接支持USB/BLE |
| 手机／平板浏览器 | 可查看静态示范或连接自己配置的可达网关；不包含原生手机USB/BLE采集器 |
| Linux | 源码采集网关；目前没有本项目的Linux原生应用包 |

支持的Python范围为3.11–3.13，前端开发／静态服务需要Node 20或更新版本。独立应用包自带运行时。

自动化兼容回归覆盖Windows、Mac ARM、Mac Intel、Linux的Python 3.11、3.12、3.13；Node 20、22、24；Chromium、Firefox、WebKit。浏览器检查包含标准接口连接、冻结与重连、记录／CSV／回放、320–1920像素布局和展示模式。

这些是明确的测试矩阵，不涵盖所有历史系统版本、浏览器版本、芯片、厂商私有协议或无限时长运行。

## 设备与权限

设备协议及身份匹配见[设备矩阵](DEVICE-MATRIX.md)。未知协议需增加适配器，不能通过通用蓝牙名称推断其数据格式。

第一次蓝牙授权、系统隐私权限及缺失的厂商驱动由操作系统处理。macOS发行包目前没有Apple Developer签名或公证，首次打开按系统提示完成。

源代码所在目录应可写。`.runtime/`属于该目录的隔离环境，不应跨平台复制；原生应用用户配置保存到本用户的数据目录。

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

## 依据

接口、权限与会话生命周期参考[Web Serial](https://developer.chrome.com/docs/capabilities/serial)、[Bleak](https://bleak.readthedocs.io/en/latest/)、[aiohttp](https://docs.aiohttp.org/en/stable/web_advanced.html)官方文档。音乐与图形依据继续采用[证据说明](EVIDENCE.md)。
