# 分隔板模型与单文件复现

`source/` 是实际交付 HTML 的制作源码；使用作品只需下载 `public/works/05-drawer/index.html`，不需要构建环境。

维护者可执行：

```sh
npm install --prefix qa/evaluations/divider/source
node qa/evaluations/divider/source/build.cjs --check
node qa/evaluations/divider/tests/model.test.mjs
```

第一项安装固定版本的 Three.js、fflate 和 esbuild，第二项要求重新打包结果与交付文件逐字节一致，第三项独立核对尺寸、槽口、排版和换抽屉等 14 项判据。浏览器实际导出和恢复检查在 `qa/drawer_workflow.py`。

没有做实体加工或装配测试。导出是成品名义轮廓，需按真实设备切缝设置补偿并先切试插小样。
