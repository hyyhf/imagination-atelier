"""Build a portable prompt + Skill kit; no runtime dependencies in its HTML."""
from pathlib import Path
import html
import shutil
import zipfile


def make(root: Path) -> None:
    prompt = (root / 'prompts/full-meta-prompt.txt').read_text(encoding='utf-8')
    downloads = root / 'public/downloads'
    shutil.copy2(downloads / 'imagination-developer-v4.0.zip', downloads / 'imagination-developer.zip')
    start = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>想象显影机 · 开始创作</title>
<style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:45px auto;padding:0 24px;max-width:820px;font:15px/1.9 system-ui,"Microsoft YaHei",sans-serif;color:#302b25;background:#fbf8f2}h1{font:42px/1.3 "Songti SC","SimSun",Georgia,serif;margin-bottom:15px}p{color:#7d756a}section{padding:25px;background:#fffdf9;border:1px solid #e5ddd0;border-radius:16px;margin-top:25px}label{display:block;font-size:13px;margin:15px 0 7px}textarea,select{font:14px/1.8 inherit;width:100%;padding:13px;border:1px solid #dfd1bf;border-radius:8px;background:#fffcf7;color:#302b25}textarea{height:140px;resize:vertical}button{border:0;border-radius:23px;padding:12px 21px;background:#925a3e;color:white;font:14px system-ui;cursor:pointer;margin-top:18px}button:disabled{opacity:.5;cursor:default}a{color:#925a3e}details{margin:20px 0}summary{cursor:pointer;color:#8c7054}#complete{height:330px;font:12px/1.8 monospace}#status{min-height:27px;font-size:13px}footer{font-size:12px;margin:30px 0 50px;color:#8a7c6b}@media(max-width:540px){body{margin-top:28px;padding:0 18px}h1{font-size:33px}section{padding:19px}}</style>
<h1>把想象，做成作品。</h1><p>写下一句愿望，选择这次交付，然后把完整指令发给你使用的 AI。</p>
<section><label for="mode">这次希望得到什么？</label><select id="mode"><option value="直接制作并交付完整本地 HTML 作品和必要资源。">直接做作品</option><option value="给我可交给另一位 AI 独立执行的完整制作提示词。">生成制作提示词</option><option value="先给我少量体验不同的作品方向，说明动作、反馈和成果。">先找方向</option></select><label for="idea">你想做什么？</label><textarea id="idea" placeholder="一个概念、一张图、一个工作中的麻烦，都可以成为起点。">我想为朋友做一份有照片、文字和声音的纪念作品，可以在本地慢慢翻看。</textarea><button id="copy">复制完整创作指令 ↗</button><p id="status" role="status">内容在本地生成；复制后粘贴到 AI 对话中。</p><details id="preview"><summary>查看完整指令</summary><textarea id="complete" readonly aria-label="完整创作指令"></textarea></details></section>
<details><summary>怎样安装 Skill？</summary><p>支持 Skills 的助手可安装随包的 imagination-developer 完整目录。也可在终端运行：</p><pre>npx skills add hyyhf/imagination-atelier --skill imagination-developer</pre></details>
<footer><a href="meta-prompt.txt">打开元提示词原文</a> · <a href="README.md">使用说明</a> · <a href="imagination-developer/SKILL.md">阅读 Skill</a></footer>
<textarea id="base" hidden>''' + html.escape(prompt) + '''</textarea>
<script>const $=id=>document.getElementById(id);function update(){$('complete').value=$('base').value.trim()+'\\n\\n本次交付：'+$('mode').value+'\\n\\n我的想法：\\n'+$('idea').value.trim();$('copy').disabled=!$('idea').value.trim();$('status').textContent='内容在本地生成；复制后粘贴到 AI 对话中。';}$('mode').addEventListener('change',update);$('idea').addEventListener('input',update);$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('complete').value);$('status').textContent='已复制完整指令，粘贴到 AI 对话中即可开始。';}catch{$('preview').open=true;$('complete').focus();$('complete').select();$('status').textContent='完整指令已选中，请按 Ctrl/Cmd+C 复制。';}};update();</script></html>'''
    # Python source uses escaped backslashes to avoid interpreting JS newlines.
    start = start.replace('\\\\n', '\\n')
    instructions = '''# 想象显影机 · 创作工具包

1. 解压整个工具包，双击 START.html。
2. 写下想法，选择方向、制作提示词或直接交付作品。
3. 复制完整指令，发给你使用的 AI。参考图片与资料可一并提供。

meta-prompt.txt 可以直接复制到普通聊天。
imagination-developer 是完整 Skill 目录，可安装到支持 Skills 的助手。
这个工具包在本地整理创作指令；作品由你选择的 AI 制作。
'''
    entries = {'START.html': start.encode('utf-8'), 'README.md': instructions.encode('utf-8'),
               'meta-prompt.txt': prompt.encode('utf-8'), 'LICENSE': (root / 'LICENSE').read_bytes()}
    for file in (root / 'skills/imagination-developer').rglob('*'):
        if file.is_file() and '__pycache__' not in file.parts:
            entries['imagination-developer/' + file.relative_to(root / 'skills/imagination-developer').as_posix()] = file.read_bytes()
    output = downloads / 'imagination-atelier-creative-kit.zip'
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, (2026, 10, 12, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None


if __name__ == '__main__':
    make(Path(__file__).resolve().parent.parent)
