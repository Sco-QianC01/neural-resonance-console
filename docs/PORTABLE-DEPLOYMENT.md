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

后续可双击`Start-macOS.command`。首次联网安装固定版本的uv、托管Python及依赖，全部保存在此目录的`.runtime/`。Apple Silicon和Intel分别下载对应架构。

macOS原生`.app`需在Mac构建；仓库的“Portable desktop packages”工作流提供Apple Silicon和Intel构建任务。构建通过与真实USB/BLE采集是两个验证阶段。

首次使用BLE需在系统设置中允许启动应用/Terminal使用蓝牙。USB设备需能被macOS枚举为串口；厂商驱动缺失时按厂商的macOS安装说明处理。系统权限与厂商驱动不能由网页无提示绕过。

未签名的应用可能需要在“隐私与安全性”中允许打开。构建目前不包含Apple Developer签名或公证。

## Windows：源码安装启动

安装PowerShell 7后运行：

```powershell
.\Start-Windows.ps1
```

启动器从固定的官方发行下载uv并验证SHA256，然后创建独立Python环境，不改系统Python或全局环境。

## 已有音疗核心

默认检测本机`127.0.0.1:8002`的既有核心。检测成功时仅代理其数据，不再次打开USB端口。另一台电脑没有核心时自动运行独立采集。

本地服务优先使用8767，若被其他程序占用会尝试相邻端口，并打开实际地址。端口由运行时决定，不写入个人局域网IP。

## 数据与配置

| 平台 | 用户数据位置 |
| --- | --- |
| Windows | `%LOCALAPPDATA%/NeuralResonance` |
| macOS | `~/Library/Application Support/NeuralResonance` |
| Linux | `$XDG_DATA_HOME/neural-resonance`或`~/.local/share/neural-resonance` |

可用`NEURAL_RESONANCE_DATA`指定新目录。配置会按当前用户生成，不随应用包携带作者设备序列号。记录在网页中通过JSON/CSV下载，不自动上传。

迁移应用时复制完整应用目录；迁移用户设备选择时另外复制自己的`config.json`。虚拟环境不要跨操作系统复制；源码启动器在目标系统重建环境。

## 设备支持

见[设备矩阵](DEVICE-MATRIX.md)。默认型号匹配适用于相容设备，并不代表所有USB/BLE产品都使用相同协议。新型号必须提供协议、VID/PID或BLE特征。
