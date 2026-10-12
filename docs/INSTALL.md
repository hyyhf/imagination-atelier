# Skill v4 安装与调用

普通聊天不需要安装：复制 `prompts/full-meta-prompt.txt` 全文，追加你的意图。

支持 Agent Skills 的助手：使用其安装入口导入整个 `skills/imagination-developer` 文件夹，包含 SKILL.md、references、assets 和 scripts。按该助手当前官方文档放置到其技能搜索路径。

本包保留本机安装助手。先运行 `python3 scripts/install_skill.py --help` 查看可用目标与预览参数；它属于开发／安装工具，不是作品运行前提。不要覆盖自己已改过的旧技能目录，先备份。

调用示例：`使用 imagination-developer，根据我的场景先给出完整制作提示词。` 或 `使用 imagination-developer，直接交付完整本地 HTML，重点验证连续编辑、保存恢复和最终文件。`

本轮改写 Skill 并不保证任意助手都一次达到参考作品质量。以实际内容、交互和最终文件为依据。
