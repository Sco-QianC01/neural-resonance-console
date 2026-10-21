# 独立音乐提示词工作台运行说明

工作台与设备网关分开运行。默认页面端口 `8771`；本地 Ollama 固定为 `127.0.0.1:11435`，不占用控制台的 `8767`，也不修改已有模型服务。

## 跨平台源码启动

使用项目已有 Python 环境中的 `aiohttp`，或在单独虚拟环境安装项目锁定依赖。运行：

```text
python tools/start-music-prompt.py
```

若只运行独立工作台，不需要安装设备网关全部依赖。本轮独立环境实际使用Python3.12和`aiohttp==3.13.4`。可在仓库忽略的私有目录准备环境：

```sh
# macOS / Linux
python3 -m venv .runtime/music-prompt/python
.runtime/music-prompt/python/bin/python -m pip install aiohttp==3.13.4
.runtime/music-prompt/python/bin/python tools/start-music-prompt.py
```

```powershell
# Windows：使用已安装的Python 3
py -3 -m venv .runtime/music-prompt/python
.runtime/music-prompt/python/Scripts/python.exe -m pip install aiohttp==3.13.4
.runtime/music-prompt/python/Scripts/python.exe tools/start-music-prompt.py
```

macOS使用自己的虚拟环境及签名的官方Ollama应用/二进制；无需关闭系统保护。Windows虚拟环境或本机Linux运行资产不能直接复制为Mac环境。设备权限与驱动不属于这个纯文本工作台的安装步骤。

打开 `http://127.0.0.1:8771/music-prompt/`。Windows 与 macOS 均使用各自虚拟环境的 Python，不依赖 Linux 的绝对路径。此源代码入口的跨平台可运行设计不等于已在真实 Mac 验收。

本地 Ollama 另起进程，设置进程级环境变量（不是系统全局设置）：

```text
OLLAMA_HOST=127.0.0.1:11435
OLLAMA_MODELS=<独立运行目录>/models
OLLAMA_NO_CLOUD=1
OLLAMA_NOHISTORY=1
```

使用官方独立发行版的 `ollama serve`，再向同一地址执行 `ollama pull qwen3:4b`。模型下载需要网络；模型到位后的标签编排使用本地推理。Ollama 会在用户目录生成自己的实例身份文件；如需完全隔离，应只给子进程单独的工作主目录，不覆盖用户现有目录或读取已有身份文件。

## 本机已准备的隔离目录

WSL Codex：`/home/codex/projects/neural-music-ollama-runtime`。独立 Python `.venv`、Ollama `bin/ollama`、模型 `models/` 与实例数据 `process-home/` 均位于该目录。没有安装系统服务，没有改全局 PATH。目录中的实例身份、模型权重和运行缓存不属于 GitHub 发布内容。

Ollama 官方 Linux amd64 发行版 `v0.40.6`：归档 SHA-256 为 `c164ab8b1b28e2a247c29719b8e404c423c5b83ae64c3ab4e59d50c7ff7fc5e0`，与官方发布校验表及 GitHub asset digest 一致。

## 输入与信任边界

`GET /api/music-prompt/health` 返回独立服务及本地模型的就绪情况。服务进程存在不等于模型推理成功。

`POST /api/music-prompt/arrange` 仅接受：

```json
{"tagIds":["目录中的标签 ID"],"inputHash":"64 位小写 SHA-256"}
```

标签来自固定 `music-prompt/tags.json`。神经原始数据、姓名、设备标识和客户端自填的标签短语不会传给模型。输入哈希用于核对请求归属，不构成匿名化保证。

模型只能返回选中标签 ID 的排列；新增、删除、重复或未知标签均拒绝。同一类别的冲突档位在推理前返回400；编制须在首位，录音要求须在末位。模型名称、digest、assistant角色、完整结束与 `done_reason=stop` 均须通过校验，截断或身份变化返回502。服务端不会把失败伪装成 AI 输出。模型负责语言组织的顺序，测量事实、分级规则和生成参数由明确的数据契约与人工确认负责。

服务只绑定回环地址，检查 Host 与同源 Origin；请求上限 64 KiB，单次推理最长 90 秒，只允许一个活跃推理，Ollama 请求禁止重定向、不继承 HTTP 代理。静态文件仅暴露工作台目录及明确允许的 JSON 读写模块及一份现有音乐标注 JSON，不暴露仓库根目录、配置、实验记录或凭证。

工作台使用 `handler_cancellation=True`：客户端断开会取消请求处理、关闭对Ollama的HTTP请求并释放编排锁；输入变化和手动取消共用该路径。已测试取消后新请求可正常推理，未测量GPU内部计算何时完全停止。忙碌返回409，超时返回504，错误附有稳定 `code` 与中文说明。

缓存为32条进程内LRU，只保存已校验的标签排列及原推理耗时，不保存原始观测。键包含标签库SHA-256、模型digest、`promptRevision` 和排序后的标签集合；失败及取消结果不入缓存。每次请求重新读取本机模型身份，真正推理后再核对一次，发现变更则拒绝结果。缓存命中也回显本次 `inputHash`；BPM和时长由客户端按当前输入重新编译。响应的 `cacheHit`、`durationMs`、`inferenceDurationMs` 分别说明复用情况、本次请求耗时及原推理耗时。

完整结果JSON的 `inputDocument` 只保存在浏览器导出的本地文件中，不加入编排POST。其支持字段包含原始速度样本、null断点、单位与来源，或原神经摘要的指数和时间。导入仅还原输入及验证后的人工目标，随后清空旧输出；旧模型标记和任意生成文字不会执行，也不能直接恢复为本次AI结果。输入hash现按规范化原始输入与目标生成，避免不同样本序列因统计相同而得到同一输入摘要。

文件与参考标注导入使用操作序号及输入版本核对。只有仍对应当前输入的最后一次导入能提交；用户已编辑内容、选择后一个文件或开始新生成后，旧异步结果及旧错误不会覆盖当前状态。

未实现自动发送线上生成任务；ACE 的提示词导出与线上实际生成验收应分开记录。

## 2026-10-21 本机验证

- 官方模型清单及五个 layer 均按 SHA-256 与大小校验；`qwen3:4b` 清单 digest 为 `359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7`，模型量化为 Q4_K_M。
- 真实调用独立工作台 API，8 个选中 ID 完整返回、无增删重复；首次调用含加载共约 33.5 秒。该结果只证明本地结构化编排，不是音乐质量或生理映射有效性验证。
- Ollama 进程查询显示本模型约 3.18 GB 驻留 GPU，context 为 4096；空闲 60 秒允许卸载。
- 当前网络 DNS 将官方模型存储域名解析为 fake-IP，Ollama 原生 pull 的防重定向检查拒绝下载。未调整 DNS、VPN、路由或下载安全开关；采用固定官方 registry 清单及 HTTPS blob 下载，并逐一验证内容摘要，才将模型登记到隔离目录。
- 证据位于忽略目录 `artifacts/music-prompt-20261021/real-ollama-inference.json`；单元测试使用 mock，只用于边界与错误行为，不替代真实模型证据。

本机已下载资产可通过隔离目录的 `start.py --project <仓库路径>` 重新启动。它只启动本项目回环服务；遇到其他端口占用会报错并保留对方进程。未配置开机自启，也未进行真实 Mac 或整机重启验收。

## 同日编排优化复验

`music-tag-order-20261021-v2` 在相同模型权重上优化类别信息、编排约束、响应验证、有限缓存与取消；没有训练或更换模型。优化前12标签首次请求约3.604秒、重复约0.538秒；优化后该次首次新排列约3.097秒、复用约0.002秒。首次耗时受加载和系统状态影响，不从单次差值推断普遍推理提速。

Windows Edge真实浏览器另一次新排列耗时2799毫秒；更改目标BPM与时长后复用耗时1毫秒，导出保留84 BPM、45秒及新的输入hash。取消与输入变化的浏览器回归使用受控迟到响应；后端另用真实Ollama HTTP请求验证取消后解锁和后续推理。两类证据分别保存，不将mock请求作为真实模型生成证据。1920×1080、1366×768、390×844的页面均无横向溢出或替换字符。

具体请求、下载JSON、截图与测试输出在 `artifacts/music-model-optimization-20261021/`；8767原控制台的版本、build及实例标识在本次浏览器操作前后相同。
