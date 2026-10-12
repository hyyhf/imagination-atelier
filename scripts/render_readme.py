#!/usr/bin/env python3
"""Render the repository's TRUSTED Markdown subset, without third-party packages.
Raw HTML is intentionally preserved for the authored case gallery. Not a sanitizer.
"""
from __future__ import annotations
import html,re,hashlib

def inline(source: str) -> str:
    saved=[]
    def store(value):
        key=f'\x00{len(saved)}\x00';saved.append(value);return key
    source=re.sub(r'`([^`]+)`',lambda m:store('<code>'+html.escape(m[1])+'</code>'),source)
    source=re.sub(r'!\[([^\]]*)\]\(([^)\s]+)\)',lambda m:store('<img src="'+html.escape(m[2],quote=True)+'" alt="'+html.escape(m[1],quote=True)+'" loading="lazy">'),source)
    source=re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)',lambda m:store('<a href="'+html.escape(m[2],quote=True)+'">'+html.escape(m[1])+'</a>'),source)
    source=html.escape(source)
    source=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',source)
    for _ in range(len(saved)+1):
        updated=re.sub(r'\x00(\d+)\x00',lambda m:saved[int(m[1])],source)
        if updated==source:break
        source=updated
    return source

def render(source: str) -> str:
    lines=source.splitlines();out=[];i=0
    while i<len(lines):
        line=lines[i]
        if not line.strip():i+=1;continue
        if line.startswith('```'):
            code=[];i+=1
            while i<len(lines) and not lines[i].startswith('```'):code.append(lines[i]);i+=1
            out.append('<pre><code>'+html.escape('\n'.join(code))+'</code></pre>');i+=1;continue
        match=re.match(r'^(#{1,6})\s+(.+)',line)
        if match:
            n=len(match[1]);slug=re.sub(r'[^\w\- ]','',match[2]).strip().lower().replace(' ','-')
            out.append(f'<h{n} id="{html.escape(slug,quote=True)}">{inline(match[2])}</h{n}>');i+=1;continue
        if line.startswith('>'):
            q=[]
            while i<len(lines) and lines[i].startswith('>'):q.append(re.sub(r'^> ?', '', lines[i]));i+=1
            out.append('<blockquote>'+render('\n'.join(q))+'</blockquote>');continue
        if line.startswith('|') and i+1<len(lines) and re.fullmatch(r'[\s|:\-]+',lines[i+1]):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):rows.append(lines[i]);i+=1
            head=rows[0].strip().strip('|').split('|')
            table='<div class="table-scroll"><table><thead><tr>'+''.join('<th>'+inline(x.strip())+'</th>' for x in head)+'</tr></thead><tbody>'
            for row in rows[2:]:table+='<tr>'+''.join('<td>'+inline(x.strip())+'</td>' for x in row.strip().strip('|').split('|'))+'</tr>'
            out.append(table+'</tbody></table></div>');continue
        if re.match(r'^[-*] ',line) or re.match(r'^\d+\. ',line):
            ordered=bool(re.match(r'^\d+\. ',line));tag='ol' if ordered else 'ul';rows=[]
            pattern=r'^\d+\. ' if ordered else r'^[-*] '
            while i<len(lines) and re.match(pattern,lines[i]):rows.append(re.sub(pattern,'',lines[i]));i+=1
            out.append(f'<{tag}>'+''.join('<li>'+inline(x)+'</li>' for x in rows)+f'</{tag}>');continue
        if line.lstrip().startswith('<'):
            out.append(line);i+=1;continue
        paragraph=[line];i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(?:#|>|```|<|\||[-*] |\d+\. )',lines[i]):paragraph.append(lines[i]);i+=1
        out.append('<p>'+('<br>'.join(inline(s.strip()) for s in paragraph))+'</p>')
    return '\n'.join(out)

CSS='''body{max-width:1080px;margin:40px auto;padding:0 28px 70px;font:16px/1.85 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#203d32;background:#f7f8ef}h1{font-size:58px;line-height:1.15}h2{font-size:30px;margin-top:54px;border-bottom:1px solid #d1dace;padding-bottom:12px}h3{margin-top:30px}a{color:#1d6749;text-underline-offset:4px}img{max-width:100%;height:auto;border-radius:8px}table{width:100%;border-collapse:collapse;margin:24px 0;table-layout:fixed}td,th{border:1px solid #d0d8c8;padding:14px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#e5eddb}td img{display:block;margin-bottom:12px}blockquote{border-left:4px solid #9bbd29;margin:24px 0;padding:10px 22px;background:#edf2e1}pre{overflow:auto;padding:22px;background:#173d31;color:#eaf6d7;border-radius:10px;font-size:14px;line-height:1.65}code{font-family:ui-monospace,monospace}summary{cursor:pointer}details{padding:18px;background:#edf2e1;border-radius:10px}.top{display:flex;flex-wrap:wrap;gap:22px;margin-bottom:40px}.table-scroll{overflow:auto}@media(max-width:640px){body{padding:0 16px}h1{font-size:40px}td,th{padding:7px;font-size:13px}h2{font-size:25px}}'''

def document(markdown: str) -> str:
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>想象显影机 · 安装与使用</title><style>'+CSS+'</style></head><body><nav class="top"><a href="START.html">← 全部30件作品</a><a href="downloads/meta-prompt.txt" download>元提示词 ↓</a><a href="downloads/imagination-developer-v4.0.zip" download>Skill ↓</a></nav>'+render(markdown)+'</body></html>'
