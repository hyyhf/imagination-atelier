# GitHub Pages

本项目已经包含 `.github/workflows/pages.yml`，不是待拼接的工作流模板。

请先阅读 [首次发布与权限](PUBLISH.md)。发布脚本在正确授权后配置 Pages 的 `build_type=workflow`，推送完整项目并等待实际部署检查。

Vite 使用相对 `base: './'`，站点页面采用 hash 深链接，例如 `#work=21-fit`，无需 GitHub Pages 提供服务器路由回退。图片、文档、作品和下载入口均通过基础路径解析。

主分支自动构建并部署；PR只检查，不部署。不会将PAT提交到仓库或放入静态页面。
