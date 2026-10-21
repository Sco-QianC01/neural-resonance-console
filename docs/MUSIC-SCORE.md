# 独立八小节谱面样例

入口：`http://127.0.0.1:8771/music-score/`。与标签工作台共用独立8771服务；设备采集、蠕虫及8767不参与此样例。主控制台安装包不会因此自动包含新入口。

## 本轮范围

这是可核对的专业制作分支原型：事件JSON → MusicXML谱面 / 标准MIDI → 采样音源WAV。固定D小调、4/4拍、8小节、16个二分音符。默认80 BPM，谱面时间24秒；音源释放尾音另计。每小节可修改持续/拨奏和p/mp/mf，修改后旧音频与下载链接失效，必须重新渲染。

「固定样例」是人工编写的校验片段。「本地模型规划音高」真实调用独立Ollama的`qwen3:4b`，仅规划允许音域中的16个音高；节奏、拍号、演奏方案由应用约束给定。模型失败或截断时明确失败，不用固定样例冒充AI。没有训练新模型，也没有把生理指数当成确定的音乐规律。

## 独立运行与可选音源

使用当前环境已有的aiohttp：

```sh
python tools/start-music-prompt.py
```

不安装音源也能编译、显示谱面和下载MIDI。真实音频需要本机已有FluidSynth与合法SF2；只设置启动进程的环境，不能把Linux二进制复制到Mac/Windows：

```sh
export NEURAL_SCORE_FLUIDSYNTH="/absolute/path/to/fluidsynth"
export NEURAL_SCORE_SOUNDFONT="/absolute/path/to/licensed-gm.sf2"
python tools/start-music-prompt.py --score-output "/private/path/score-output"
```

```powershell
$env:NEURAL_SCORE_FLUIDSYNTH = 'C:\path\to\fluidsynth.exe'
$env:NEURAL_SCORE_SOUNDFONT = 'C:\path\to\licensed-gm.sf2'
python tools/start-music-prompt.py --score-output 'C:\private\score-output'
```

macOS使用本机架构的已安装FluidSynth和自己的Python环境，无需关闭SIP或Gatekeeper。此设计不代表真实Mac音频渲染已验收。Ollama仍使用原独立实例`127.0.0.1:11435`，启动方式见[MUSIC-PROMPT-RUNTIME.md](MUSIC-PROMPT-RUNTIME.md)；音源渲染不依赖模型是否在线。

预览检查SF2的bank 0预置：从0起算的48（持续弦乐）和45（拨奏弦乐）。两者是两个GM预置，**不能当作同一独奏小提琴采样库的arco/pizzicato技巧**。缺失预置时失败，不静默换音色。记谱`p/mp/mf`在本预览分别映射MIDI velocity 50/64/80；这是可重复控制值，不是通用的记谱力度—实测响度标定。

本机复用FluidSynth 2.3.4和TimGM6mb（GPL-2）；音源SHA256为`c5378b62028c920cb11e4803327983fee2f2cdff5dc89c708e39da417e51c854`。音源、运行环境和权重不进入源码包或演奏导出包。使用其他音源须自行确认其许可及实际音色能力。渲染器版本、程序/音源哈希、固定gain、关闭混响/合唱、力度映射写入每次报告。

谱面组件使用本地OSMD 2.2.0。未修改的上游bundle SHA256为`86e439e5ec1c0cbf8b7051e0cf32291d377fb97cf6b8976b9ef87c714e0ca032`，BSD及依赖声明放在`music-score/vendor/`。上游npm包缺少bundle引用的webpack LICENSE文件，随附文件明确标注为本地保守收集的依赖许可，不冒称上游生成文件。

## 数据与接口

事件合同`music-score-sample-v1`完整包含`schemaVersion/title/source/tempoBpm/bars`。小节号必须是连续整数1–8；每小节两个音符ID为`m1n1`…`m8n2`，拍位0/2、时值2拍。音高为MIDI整数60–84中D自然/和声小调允许音（含C/C♯、B♭），明确按C♯及B♭记谱。其他拍号、节奏、复音和连续控制器编辑不属于此样例。

- `GET /api/music-score/example`：人工固定样例。
- `GET /api/music-score/status`：工具/预置可用性；实际渲染另验。
- `POST /api/music-score/compile`，`{"score":...}`：统一事件、MusicXML、base64 MIDI、秒数时间轴、事件hash。
- `POST /api/music-score/compose`，`{"tempoBpm":80}`：实际本地模型音高结果和digest；与标签编排共享单推理锁。
- `POST /api/music-score/render`，`{"score":...}`：有界单音源子进程、WAV验证、原子发布及产物链接。
- `GET /api/music-score/artifacts/{64位renderId}/{固定文件名}`：只允许本次输出根内的演奏产物。

仅接受同机Host/Origin及64 KiB以内JSON；未知字段、非整数小节、错误音高/拍位/时值/标记在启动音源前拒绝。渲染超时30秒，超时或取消会结束该子进程、清理暂存，不发布成功报告。其他端口与全局配置不变。

每次输出包括`events.json`、`score.musicxml`、`performance.mid`、`audio.wav`、`report.json`、`package.zip`。`sourceClaim`保留输入来源声明；只有本进程真实模型结果且事件hash完全一致时才有`modelReceipt`。客户端传入`source.kind=ollama`本身不构成推理证据。源码及静态站点包不包含生成音频、设备记录、SF2或模型。

## 验收边界

编译器校验音高/时值/小节；用独立mido/music21读回导出，核对MIDI note on/off和第5小节program切换。WAV验证44.1kHz、双声道16bit、覆盖完整谱面时间、非静音、无满幅削波。相同16音、相同速度下仅改第5小节演奏法，可用于比较持续与拨奏预置。

这些检查能证明数据一致与实际采样渲染，不能单凭波形统计证明音色逼真、作品质量或临床效果。专业独奏演奏法、音源真实度及音乐质量仍需人工听辨；没有进行真实设备、真实Mac或一天稳定运行验收。
