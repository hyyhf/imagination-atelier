# 本轮验证记录

- controller-transactions.json：30件实际控制器的原始事务函数。模型真实运行；DOM、显示调度、提示与部分存储函数使用替身。不是浏览器测试，也不证明所有原撤销分支都测试过。
- geometry-invariants.json：射线／包围盒、矩阵往返、地面交点、显示与采购隔离、非法光线输入、倒角包围范围。
- change-manifest.json：每件旧／新SHA、真实变更、候选对照测试与验证层次。
- source-checks.json：最终HTML的静态与语法记录（由最终检查复制）。
- native-frame-manifest.json：17件主画面的实际模型重放证据（最终写入）。

本轮 Chromium 实际导航 file:// 与 127.0.0.1 均返回 ERR_BLOCKED_BY_ADMINISTRATOR，已停止，没有绕过。浏览器整页、指针、触屏、首次离线打开、下载对话框、实听／打印与性能仍待验证。

复验来源：所有发布HTML内的 AtelierLab / AtelierBridge / AtelierNotebook 均在最终文件中。public/QA.html 可由使用者运行初始化校验并亲自记录完整任务；不会默认勾选未执行的项目。

## 可选开发者复验

这些测试不是使用作品的前提。Node 需要 TypeScript 5.8.3 与 skia-canvas 3.0.8（本轮执行版本）；Python 原生画面重放还需要 numpy、Pillow、Mesa EGL/OpenGL。按你的环境安装这些测试依赖后，从仓库根目录执行：

```bash
python3 qa/v4/extract.py
node qa/v4/test_bridges.cjs 1 10
node qa/v4/test_bridges.cjs 11 19
node qa/v4/test_bridges.cjs 20 20
node qa/v4/test_bridges.cjs 21 30
node qa/v4/test_geometry.cjs
node qa/v4/render_final.cjs 11-popup qa/v4/frames 1400
python3 qa/v4/render_gl.py qa/v4/frames/11-popup.json qa/v4/frames/11-popup.png
```

音频完整数据测试耗时较长；不代表界面响应时间。测试里 DOM 和显示调度替身的清单保留在源代码中，不能将这些结果叫浏览器交互测试。
