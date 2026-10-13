# 课值 / Kezhi

面向大学生家教选单场景的工具：解析家教消息，结合课时、交通成本和通勤时间估算净时薪，并提供筛选、排行、群聊分组和收藏功能。

本源码包恢复自原开发目录，包含微信小程序及桌面版源码。小程序文档标记版本为 1.0.0，桌面版为 1.0.0-rc1。公开发布、真实用户量及微信审核状态尚未核实。

## 项目结构

- `work/miniapp/`：微信小程序、路线云函数及已有测试。
- `work/internal-release-source/`：桌面版页面、Python 本地服务与启动器。
- `work/pyinstaller-spec/`：桌面版打包配置。
- `work/test-*.js`、`work/test*.py`：原项目已有的测试。

## 微信小程序

使用微信开发者工具导入 `work/miniapp`。将 `project.config.json` 的 AppID 和 `app.js` 的云环境占位值替换为自己的配置。在云函数环境变量中设置 `AMAP_WEB_SERVICE_KEY`，部署 `route` 云函数。详见该目录的 README。

## 桌面版开发运行

安装 Python 3.12 后，在仓库根目录运行：

```powershell
python work/internal-release-source/server.py
```

默认在本机 `http://127.0.0.1:8765` 提供页面。真实路线计算需在应用设置中填写自己的地图 Web 服务 Key。桌面启动器和打包步骤见 `work/桌面版构建说明.md`。

## 本地验证

```powershell
node work/miniapp/tests/run-tests.js
node work/test-app-parser.js
python work/test_amap_server.py
python work/test-travel-modes.py
```

## 发布准备

此副本移除了共享地图密钥和开发者工具私有配置，并替换了原小程序 AppID 与专用云环境 ID。未包含安装包、运行缓存或账号配置。原始开发文件未被修改。测试中的专用云环境断言已改为检查公开配置占位值；密钥存在性断言已移除，以便不带密钥运行离线测试。

原项目未发现开源许可证，当前未代为选定许可证。公开源码前应由作者确定授权条款；公开可见本身不等于授予开源使用许可。
