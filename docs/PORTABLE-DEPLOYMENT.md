# 在另一台电脑使用

## Windows：独立应用包

解压完整目录，双击`NeuralResonance/NeuralResonance.exe`。不要单独移动exe，`_internal`目录包含隔离的Python运行时与依赖。应用自动打开本机网页，识别唯一相容设备并等待数据；不需要安装Node、Python或连接作者服务器。

应用只运行本项目的采集和前端。Max、Resolume、MuMu及云端音乐模型不包含在包内。

## macOS：源码安装启动

下载完整源码，在Terminal中执行一次：

```sh
chmod +x Start-macOS.command
./Start-macOS.command
```

后续可双击`Start-macOS.command`。首次联网安装固定版本的uv、托管Python及依赖，保存在本用户`~/Library/Application Support/NeuralResonance/runtime/darwin-<架构>/`。Apple Silicon和Intel分别安装，不能搬移Windows虚拟环境到Mac。启动会核对锁文件摘要、系统架构、依赖版本和实际导入；核对通过后直接启动，不联网同步依赖。

macOS原生`.app`需在Mac构建；仓库的“Portable desktop packages”工作流提供Apple Silicon和Intel构建任务。构建通过与真实USB/BLE采集是两个验证阶段。

首次使用BLE需在系统设置中允许启动应用/Terminal使用蓝牙。USB设备需能被macOS枚举为串口；厂商驱动缺失时按厂商的macOS安装说明处理。系统权限与厂商驱动不能由网页无提示绕过。

未签名的应用可能需要在“隐私与安全性”中允许打开。构建目前不包含Apple Developer签名或公证。

## Windows：源码安装启动

安装PowerShell 7后运行：

```powershell
.\Start-Windows.ps1
```

启动器从固定的官方发行下载uv并验证SHA256，然后在`%LOCALAPPDATA%/NeuralResonance/runtime/win32-<架构>/`创建独立Python环境，不改系统Python或全局环境。已核对的环境支持离线再次启动；旧环境因路径迁移损坏时，启动器重新创建目标环境。安装包内的`Start-Windows.cmd`直接启动exe，不需要PowerShell。

每次源碼版啟動會驗證鎖文件、依賴版本，以及HTTP／USB／BLE啟動用的實際類別能否導入。包的安裝資訊仍在、實際程式檔案遺失時，也會判為缺件並重新安裝鎖定依賴。已經有私有下載緩存時可離線恢復；沒有緩存的首次安裝或缺件恢復需要網絡。損坏的私有uv安裝工具先保留，再下載經SHA256核對的新副本；下載有明確超時。

完整原生包自帶依賴，不能拆開`_internal`。原生包的檔案被刪除時，重新解壓完整安裝包；不把源碼啟動器的自動修復能力誤解為任意刪除原生DLL也能離線補回。

## 已有音疗核心

默认独立采集，不探测作者核心或私人服务器。需要复用自己的本机核心时，exe或Mac入口添加`--reuse-local-core`；Windows源码使用`-ReuseLocalCore`。只有返回正确LIVE状态的核心才被复用，失败明确报告，避免静默切换来源。其他软件已打开设备时，独立采集器报告端口占用，不强制关闭它。

本地服务优先使用8767，若被其他程序占用会尝试相邻端口，并打开实际地址。每用户数据目录使用操作系统锁；重复点击复用经身份和构建版本核验的实例，避免再次争用设备。其他程序或其他数据目录的实例不会被误认为本程序。

## 数据与配置

| 平台 | 用户数据位置 |
| --- | --- |
| Windows | `%LOCALAPPDATA%/NeuralResonance` |
| macOS | `~/Library/Application Support/NeuralResonance` |
| Linux | `$XDG_DATA_HOME/neural-resonance`或`~/.local/share/neural-resonance` |

可用`NEURAL_RESONANCE_DATA`指定新目录，`NEURAL_RESONANCE_RUNTIME`指定源码版隔离环境根目录。配置会按当前用户生成，不随应用包携带作者设备序列号。记录在网页中通过JSON/CSV下载，不自动上传。启动失败查看本用户目录内`startup-error.txt`，精简运行日志为`service.log`，最多保留三段，不包含脑电原始值、请求凭证或全局配置。

迁移应用时复制完整应用目录；迁移用户设备选择时另外复制自己的`config.json`。虚拟环境不要跨操作系统复制；源码启动器在目标系统重建环境。

JSON配置、記錄和規則接受UTF-8有／無BOM。CSV下載使用帶BOM的UTF-8，Python讀取時使用`encoding="utf-8-sig"`。CSV和JSON保留原始單位、中文來源及來源時間戳。

完整包可離線啟動采集及顯示已收到的本地資料。Vmus的音樂仍是原站串流，需要原站網絡可達；目錄或音訊失敗時會提示並允許重試，不把網絡問題補成虛構音樂或設備資料。

## 设备支持

见[设备矩阵](DEVICE-MATRIX.md)。默认型号匹配适用于相容设备，并不代表所有USB/BLE产品都使用相同协议。新型号必须提供协议、VID/PID或BLE特征。
