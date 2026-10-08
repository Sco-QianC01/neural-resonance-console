---
version: 0.8
name: Neural Resonance Instrument
description: Restrained EEG acquisition and music interaction console
colors:
  background: "#0b1015"
  panel: "#101820"
  text: "#dce6eb"
  muted: "#9aabb5"
  accent: "#a4e1d8"
typography:
  body: system-ui, PingFang TC, Microsoft YaHei
  numbers: Consolas, ui-monospace, monospace
rounded: 5-8px
spacing: 8px base, 20-26px padding, 24-34px section gap
components: navigation, acquisition rail, waveforms, particle networks, inventory
---

## Overview

深色科研乐器风格，优先读懂信号、来源和设备状态。波形捕获、神经蠕虫、设备设置三个页面固定；切换不销毁同一数据连接。

本轮视觉来源为既有四频段结构与本规范。image2.5设计稿等待可用的已登录生成入口，未将HTML截图标为模型生成。

## Colors

背景#0b1015，面板#101820，青白文字#dce6eb，辅助文字#9aabb5，操作强调#a4e1d8。
Delta粉红#f098a2、Theta浅橄榄#d4df8c、Alpha浅紫#d6a5eb、Beta青绿#89d6bd只区分通道，不表示健康等级。

## Typography

页面标题28–33px，模块标题17–22px，正文与控制12–14px，辅助信息不低于10px。数值等宽，原生指数32–38px；中英文两层层级。

## Layout

桌面左侧260px采集栏，右侧宽仪器画面，间距34px。窄桌面230px及24px。主图为原生指数曲线加四条纵向通道，不改为四个方形卡片。
设备页显示枚举、身份选择和四个传感器状态。蠕虫页主图为时间顺序二维轨迹，十网在下方。

## Components

导航以低对比表面区分选中状态。控件至少40px高度，等待、断流、接触不良、无权限和错误都有文字。设备清单来自API实际枚举。
缺失数据显示破折号；过期停止轨迹和音乐映射。原生0–100与交互0–127不混用。

## Depth & Elevation

细边线与少量明度分层；不使用全屏光晕、模糊玻璃、紫蓝渐变或大阴影。粒子光效只用于数据轨迹。

## Do's and Don'ts

- 保留真实时间轴、单位、来源、序号和缺失断线。
- 控件和下载操作保持可访问性；不做主题/品牌切换。
- 不把示范曲线或粒子当实测脑区连接。
- 不用装饰图遮住数据，不把接口可用说成设备已连接。

## Responsive Behavior

1100px以下压缩两栏、设置区单列；700px以下采集栏置顶，主仪器单列。设备身份允许换行，长USB路径不导致横向溢出。十网两列，导航保持40px点选区域。

## Agent Prompt Guide

使用现有HTML/CSS/Canvas，不迁移框架。检查桌面/手机三页与等待状态，再更新公开截图。模型设计稿必须真实生成并保存后才能引用。
