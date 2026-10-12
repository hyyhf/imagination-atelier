# 把发布权限一次分清楚

## 当前诊断（本次打包时）

目标是 `hyyhf/imagination-atelier`。仓库已经公开，账户角色返回 `admin: true` 和 `push: true`，但现有 ChatGPT GitHub 集成实际创建 `LICENSE` 仍返回 **403 Resource not accessible by integration**。这说明角色与当前集成凭据可执行的操作不能混为一谈。当前工具也不提供可调用的 Pages 管理写入接口。

本次会话没有可用的 GitHub CLI 登录凭据；运行环境到 GitHub/npm 的直接网络连接也失败。因此不能在这里把“发布脚本写完”标成“已上线”。

不要通过“允许所有聊天工具操作”、关闭分支保护或提高工作流默认权限来尝试修复首次上传问题；它们不等于更换 GitHub 颁发的凭据。

## 三层权限，三件不同的事

| 阶段 | 实际操作 | 所需权限 |
|---|---|---|
| 上传源码与工作流 | 推送 `.github/workflows/pages.yml` 和网站文件 | 细粒度 token：Contents / Workflows 读写；OAuth/classic token 按其授权范围，CLI 通常需要 `repo` 和 `workflow` |
| 首次配置站点 | 创建/更新 Pages、读取/启用 Actions 设置 | Pages / Administration 读写；账户本身必须管理此仓库 |
| 日常 CI/CD | 读源码、构建、发布 Pages artifact | 构建 `contents: read`；仅部署 job 拥有 `pages: write` 与 `id-token: write` |

初次设置成功后，不需要将个人令牌添加进 Actions Secrets。持续发布用 GitHub 自动创建的短期 `GITHUB_TOKEN` 与 OIDC。

## 推荐：使用你电脑上已授权的 GitHub CLI

前提：Python 3.10+、Git；可选安装官方 GitHub CLI。

```bash
python3 scripts/publish.py --repo hyyhf/imagination-atelier --login
```

Windows：

```powershell
py -3 scripts/publish.py --repo hyyhf/imagination-atelier --login
```

macOS 可打开 `PUBLISH.command`，Windows 可打开 `PUBLISH.cmd`。只在 GitHub 官方授权页面输入账户凭据并确认 scope；脚本不读取密码或验证码。

脚本会使用已有 gh 登录。加上 `--login` 后，必要时调用官方 `gh auth login` 或 `gh auth refresh --scopes workflow`，由你在 GitHub 完成授权。CLI 的 OAuth 权限可能覆盖你有权限的其他仓库，务必阅读授权页面；需要严格仓库级限制时使用下面的细粒度 token 方式。

## 最小范围：只授权这个仓库

在 GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens，新建一个短有效期 token：

- Resource owner：`hyyhf`。
- Repository access：Only select repositories → `imagination-atelier`。
- Contents、Workflows、Pages、Administration：Read and write。
- Actions：Read-only；Metadata：默认读取。

运行发布脚本，在**本机隐藏输入提示**粘贴 token。它只存在于当前进程的内存／子进程环境；不会写进项目、配置、日志、Git remote 或提交。不要将 token 发送给聊天助手。

如果已经有授权、仅检查身份与文件、不做远程修改：

```bash
python3 scripts/publish.py --repo hyyhf/imagination-atelier --check-only --no-input
```

角色读取成功不构成写权限验证。首次 Pages 配置和实际 Git push 才能验证凭据被 GitHub 接受。

## 自动完成的步骤

1. 检查30件作品哈希、所有运行文件、下载ZIP和语法；扫描凭据样式。
2. 验证实际授权身份与指定公共仓库。
3. 创建或更新 Pages 为 GitHub Actions；Actions关闭时仅启用开关，保留现有 allowlist。
4. 在临时工作副本提交；只推送目标仓库的 main。不强推，不删除无关文件，不绕过保护。
5. 等待本次提交的 Pages 工作流。失败会给出实际 run 地址和失败 job。
6. 读取 GitHub 返回的 HTTPS Pages 地址，核验在线 build-info 的提交 SHA、编译资源、30个完整作品与封面。
7. 全部成功才输出网页地址，并将非敏感结果写到 `.publish-result.json`（已忽略，不提交）。

如果 npm 安装、TypeScript、浏览器检查、Pages环境审批或 allowlist 出现问题，工作流会失败或等待；脚本不会绕过审批。完成账户侧处理后可再次运行，它不会强制覆盖历史。

## 手动等价流程（排查时使用）

已经在本机拥有合适 gh 登录时：

```bash
gh auth refresh -h github.com -s workflow
gh api -X POST repos/hyyhf/imagination-atelier/pages -f build_type=workflow
# 已启用Pages时，改用 PUT 而不是再次 POST：
# gh api -X PUT repos/hyyhf/imagination-atelier/pages -f build_type=workflow
```

正常使用推荐发布脚本，它会检测已存在的站点，避免重复创建，并验证线上版本。

## 官方依据

- GitHub API 权限错误：https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#resource-not-accessible
- 文件与工作流写入权限：https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
- Pages 创建与更新权限：https://docs.github.com/en/rest/pages/pages
- Pages 自定义工作流：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub CLI 登录：https://cli.github.com/manual/gh_auth_login
- GitHub CLI scope 更新：https://cli.github.com/manual/gh_auth_refresh
- Vite 子路径：https://vite.dev/guide/static-deploy.html#github-pages

这些步骤不是让集成“给自己提权”，而是由仓库管理者授予恰当、可撤销的权限，再执行已授权的发布任务。
