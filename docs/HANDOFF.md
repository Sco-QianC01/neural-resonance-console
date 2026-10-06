# 开发与协作

## 第一次运行

1. Fork仓库，clone到自己选择的文件夹。
2. 准备Node.js 20+。
3. 执行`npm start`，打开输出的地址。
4. 先用默认动态示范了解轨迹、频段、神經蠕蟲網和音乐参数。

本项目无需实验室后台、个人电脑目录或额外的运行依赖。

## 提交修改

```bash
git switch -c feature/your-change
npm test
npm run build
git add .
git commit -m "Describe your change"
git push -u origin feature/your-change
```

提交Pull Request并说明：

- 修改了什么、为什么修改。
- 如何测试。
- 界面变更附桌面和手机截图。

## 代码约定

- 保持浏览器端原生ES模块，不增加无必要的框架或依赖。
- 設備輸入走統一資料協議；瀏覽器可直接接收標準 ThinkGear。
  系統驅動與專有協議的解析器由外部軟體提供。
- 不写个人目录、预设私人服务器或固定设备标识。
- 缺值和断流要保留，示范数据要明确标记。
- 演示默认可用；真实来源需要用户明确配置，不偷偷回退到示范。
- 不提交用户记录、API凭证或本机操作笔记。

## 维护网站

主库`main`通过测试后自动发布GitHub Pages。
Fork默认运行构建测试；发布自己的站点时配置自己的Pages，并调整工作流的仓库条件。
其他主机直接部署`dist/`即可。
