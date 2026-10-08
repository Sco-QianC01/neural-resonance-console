---
version: 0.11
name: Neural Resonance Instrument
description: A restrained signal acquisition and musical intent workstation
colors:
  background: "#121315"
  panel: "#1d1f22"
  text: "#e9e8e2"
  muted: "#a4a5a6"
  accent: "#c5d8d3"
typography:
  body: Segoe UI, PingFang TC, Microsoft YaHei, system-ui
  numbers: ui-monospace, Consolas, monospace
rounded: 2-3px
spacing: 8px base, 22-32px instrument padding
components: left navigation, acquisition rail, waveforms, trace canvas, music plans, inventory
---

## Overview

深石墨科研仪器；固定左侧三页入口，中央以数据和操作为主。去除卡片墙、环形仪表、装饰英文标签和重复过程性文案。切换页面保留同一数据流。

视觉依据：老师A10录音10:00–11:22的左侧三页要求、已有设计稿，以及IBM Carbon的左侧导航和2x网格。小红书已检索，正文没有取得，不能列作已学习的设计依据。

## Colors

背景#121315，侧栏#18191c，仪器#1d1f22，文字#e9e8e2，辅助文字#a4a5a6，操作强调#c5d8d3。频段颜色只识别通道，不代表健康等级。主轨迹青灰白，不用情绪色块。

## Typography

标题25px，模块标题17–18px，正文13–14px，操作12px，元资料11px。数值等宽，原始双指数30px。画布刻度保持实际数据单位。

## Layout

左侧224px导航与采集栏；主内容32px内边距。波形页顶部双指数，下方四条纵向频段和原始脑波。蠕虫页使用等比例二维画布、头尾、时间滑杆、窗口统计及展示模式。

十要素是紧凑可选层，共用历史时间点；默认显示课件来源的创作方案，切换音乐观测只显示有来源数据。标签节点是文字语义，不冒充脑区连接或几何测量。

## Components

控件40px以上，导航48px。设备设置提供可保存USB身份和BLE地址／macOS UUID。只显示有效传感器值；连接失败、接触不良和权限问题保留实际反馈。创作意图与测量数据分开输出。

## Depth & Elevation

细分隔线与有限明度层次；没有光晕背景、玻璃、营销渐变或大阴影。粒子仅标记样本；动画不得更改数据坐标。

## Do's and Don'ts

- 三页固定在左侧；窄屏用可展开左侧抽屉。
- 保留真实时间、单位、缺失断段及来源，不把原生指数改成情绪百分比。
- 不添加无依据的网形、BPM、复杂度或随机推断。
- 图形必须来自样本或明确的创作标签。操作焦点、键盘与减少动态效果可用。

## Responsive Behavior

760px以下收起左侧，手机两列数值及两列要素入口。390、768、1440、1920px三页均检查。绘图区两轴等物理比例，手机不拉伸轨迹；展示模式隐藏操作侧栏。

## Agent Prompt Guide

沿用HTML/CSS/Canvas，避免新增框架。先回归真实数据、身份重连和时序，再核对桌面／手机／展示截图。生成设计图只作视觉资料，不作测量。
