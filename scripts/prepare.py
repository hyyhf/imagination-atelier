#!/usr/bin/env python3
"""Deterministic static resources. Works without npm or network access."""
from pathlib import Path
from datetime import datetime, timezone
import html,json,os,re,shutil,zipfile
ROOT=Path(__file__).resolve().parent.parent
PUB=ROOT/'public'

def zip_paths(destination, pairs):
    with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for source, arcname in sorted(pairs,key=lambda x:x[1]):
            info=zipfile.ZipInfo(arcname,(2026,10,12,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=(0o100644<<16);z.writestr(info,source.read_bytes())
    with zipfile.ZipFile(destination) as z:
        if z.testzip() is not None:raise RuntimeError('ZIP integrity failure')

def main():
    PUB.mkdir(exist_ok=True)
    shutil.copy2(ROOT/'prompts/full-meta-prompt.txt',PUB/'downloads/meta-prompt.txt')
    data=json.loads((PUB/'catalog.json').read_text())
    cards=[]
    for w in data:
        e=lambda s:html.escape(str(s),quote=True)
        cards.append(f'''<article class="work-card" data-series="{e(w['series'])}" data-medium="{'3D' if '3D' in w['dimension'] else '2D'}"><a class="work-image" href="{e(w['entry'])}"><img src="{e(w['preview'])}" alt="{e(w['title'])}实际绘制画面" loading="lazy" width="960" height="640"><span class="work-number">{w['number']:02}</span><span class="image-arrow">↗</span></a><div class="work-meta"><span>{e(w['domain'])}</span><span>{e(w['dimension'])}</span></div><h3><a href="{e(w['entry'])}">{e(w['title'])}</a></h3><p>{e(w['description'])}</p><div class="work-links"><a href="{e(w['guide'])}">说明 ↗</a><a href="{e(w['record'])}">创作记录 ↗</a><a href="{e(w['prompt'])}">提示词 ↗</a><a href="{e(w['entry'])}" download="{e(w['id'])}.html">HTML ↓</a></div></article>''')
    css=(ROOT/'src/site.css').read_text()
    doc='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>想象显影机 · 30件独立作品</title><style>'''+css+'''</style></head><body>
    <header class="site-header"><a class="brand" href="#"><span class="brand-symbol">ia.</span><span>想象显影机<small>IMAGINATION ATELIER</small></span></a><nav><a href="#works">30 件作品</a><a href="downloads/meta-prompt.txt" download>元提示词 ↓</a><a href="README.html">安装与说明 ↗</a></nav></header>
    <main><section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="dot"></span>THIRTY IDEAS. ONE CREATIVE SKILL.</p><h1>把想象，<br><span>做成作品。</span></h1><p class="hero-description">从「大概是这样」，到「原来真的可以」。<br>数学、物理、生活与创作。把三十件作品放在手边。</p><div class="hero-buttons"><a class="action-link primary" href="#works">进入作品展览 ↓</a><a class="text-link" href="downloads/meta-prompt.txt" download>从我的想法开始 ↗</a></div><p class="hero-foot">LOCAL FIRST · 30 COMPLETE HTML WORKS · MIT</p></div><div class="hero-art"><div class="art-topline"><span>SPATIAL WORKBENCH / 011</span><span>空间布置 · 同源模型</span></div><a class="hero-art-button" href="works/11-popup/index.html"><img src="images/11-popup.jpg" alt="开店之前三维场景"><span class="orbit-mark">↗</span></a><div class="art-caption"><div><small>同一套尺寸，不同的判断</small><strong>开店之前。</strong></div><a class="action-link" href="works/11-popup/index.html">布置与对照 ↗</a></div></div></section>
    <div class="manifesto"><span>下载后打开作品，即可使用自己的内容继续创作。</span><strong>30 件独立 HTML</strong></div>
    <section id="works" class="collection-section"><div class="section-heading"><div><p class="eyebrow">THE COMPLETE COLLECTION</p><h2>不同的想法，<br>有不同的形状。</h2></div><p>所有图片来自作品实际绘制。<br>所有作品都可以独立打开。<br>每件都附有制作提示词、说明与边界。</p></div>
    <div class="collection-filters"><div class="collection-buttons" role="group" aria-label="作品辑别"><button data-filter="all" aria-pressed="true">全部作品 <small>30</small></button><button data-filter="science" aria-pressed="false">科学实验室 <small>10</small></button><button data-filter="practical" aria-pressed="false">工作与生活 <small>10</small></button><button data-filter="explore" aria-pressed="false">设计与工程 <small>10</small></button></div><label class="search-box"><span>⌕</span><input type="search" id="search" aria-label="搜索作品" placeholder="搜题目、用途、学科…"></label></div><div class="collection-caption"><p>打开一个作品，从默认方案开始，也可以换成自己的内容。</p><span id="count" role="status">30 件作品</span></div><div class="work-grid">'''+''.join(cards)+'''</div><p id="empty" hidden class="empty-state">没有匹配的作品，请调整搜索。</p></section></main>
    <footer class="site-footer"><a class="brand" href="#"><span class="brand-symbol">ia.</span>想象显影机</a><p>原创内容 MIT · 第三方资源保留各自许可<br>每件作品有自己的科学模型与使用边界。</p><div><a href="downloads/atelier-all-30.zip" download>下载全部作品 ↓</a><a href="downloads/imagination-developer.zip" download>Skill ↓</a></div></footer>
    <script>(()=>{let filter='all';const search=document.getElementById('search'),cards=[...document.querySelectorAll('.work-card')];function update(){let n=0;const q=search.value.toLowerCase().trim();for(const c of cards){const visible=(filter==='all'||c.dataset.series===filter)&&c.textContent.toLowerCase().includes(q);c.hidden=!visible;if(visible)n++;}document.getElementById('count').textContent=n+' 件作品';document.getElementById('empty').hidden=!!n;}for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));update();});search.addEventListener('input',update);})();</script></body></html>'''
    featured=[]
    for number in [1,10,2]:
        w=next(item for item in data if item['number']==number)
        e=lambda s:html.escape(str(s),quote=True)
        featured.append(f'<article class="featured-work"><a class="featured-image" href="{e(w["entry"])}"><img src="{e(w["preview"])}" alt="{e(w["title"])}实际画面"></a><div class="featured-caption"><div><span class="feature-label">{e(w["domain"])}</span><h2><a href="{e(w["entry"])}">{e(w["title"])}</a></h2><p>{e(w["description"])}</p></div></div></article>')
    hero='<section class="hero"><div class="hero-copy"><h1>把想象，<span>做成作品。</span></h1><p>直接看用途，带入自己的材料，完成任务，再快速开始下一件。</p><div class="hero-buttons"><a class="action-link primary" href="#works">选择作品 ↓</a><a class="action-link secondary" href="downloads/meta-prompt.txt">带走元提示词 ↗</a></div></div><div class="featured-grid">'+''.join(featured)+'</div></section>'
    doc=re.sub(r'<section class="hero">.*?</section>',lambda _:hero,doc,count=1,flags=re.S)
    (PUB/'START.html').write_text(doc,encoding='utf-8')
    (ROOT/'START.html').write_text('''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=public/START.html"><title>进入想象显影机</title></head><body><a href="public/START.html">打开全部30件作品</a></body></html>''',encoding='utf-8')
    for folder in ['docs','skills','prompts']:
        target=PUB/folder
        if target.exists():shutil.rmtree(target)
        shutil.copytree(ROOT/folder,target,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    for page in (PUB/'docs').glob('*.md'):
        page.write_text(page.read_text().replace('../public/', '../'),encoding='utf-8')
    shutil.copy2(ROOT/'CONTRIBUTING.md',PUB/'CONTRIBUTING.md')
    shutil.copy2(ROOT/'LICENSE',PUB/'LICENSE');shutil.copy2(ROOT/'THIRD_PARTY_NOTICES.md',PUB/'THIRD_PARTY_NOTICES.md')
    # Dependency-free readable README. Markdown source stays available as README.md.
    readme=(ROOT/'README.md').read_text() if (ROOT/'README.md').exists() else '想象显影机 — README 正在整理'
    web_readme=readme.replace('public/','').replace('qa/v4/','docs/v4/evidence/').replace('](.github/workflows/pages.yml)', '](https://github.com/hyyhf/imagination-atelier/blob/main/.github/workflows/pages.yml)').replace('](skills/imagination-developer/)', '](skills/imagination-developer/SKILL.md)')
    (PUB/'README.md').write_text(web_readme,encoding='utf-8')
    from render_readme import document
    (PUB/'README.html').write_text(document(web_readme),encoding='utf-8')
    if os.environ.get('GITHUB_SHA'):
        (PUB/'build-info.json').write_text(json.dumps({'sha':os.environ['GITHUB_SHA'],'version':'4.0.0','builtAt':datetime.now(timezone.utc).isoformat(),'workCount':len(data)}),encoding='utf-8')
    else:
        (PUB/'build-info.json').write_text(json.dumps({'sha':'local-unpublished','version':'4.0.0','workCount':len(data)}))
    (PUB/'.nojekyll').touch()
    zip_paths(PUB/'downloads/imagination-developer-v4.0.zip',[(p,'imagination-developer/'+p.relative_to(ROOT/'skills/imagination-developer').as_posix()) for p in (ROOT/'skills/imagination-developer').rglob('*') if p.is_file() and '__pycache__' not in p.parts])
    from package_creative_kit import make as make_creative_kit
    make_creative_kit(ROOT)
    # Each collection can be opened on its own after extracting.
    for series in ['explore','practical','science']:
        pairs=[]
        for item in data:
            if item['series']==series:
                p=PUB/'works'/item['id'];pairs += [(f,f.relative_to(PUB).as_posix()) for f in p.rglob('*') if f.is_file()]
        pairs += [(ROOT/'LICENSE','LICENSE'),(ROOT/'THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md')]
        # A simple document index avoids references to works from the other collections.
        index=ROOT/'.artifacts'/f'{series}-START.html';index.parent.mkdir(exist_ok=True)
        links=''.join(f'<li><a href="{html.escape(w["entry"])}">{w["number"]}. {html.escape(w["title"])}</a></li>' for w in data if w['series']==series)
        index.write_text('<!doctype html><meta charset="utf-8"><title>想象显影机</title><h1>想象显影机</h1><p>选择作品即可使用。每件目录附使用说明。</p><ul>'+links+'</ul>')
        pairs.append((index,'START.html'));zip_paths(PUB/f'downloads/atelier-{series}.zip',pairs)
    pairs=[(p,p.relative_to(PUB).as_posix()) for folder in ['works','images','skills','prompts','docs'] for p in (PUB/folder).rglob('*') if p.is_file()]
    pairs += [(PUB/'START.html','START.html'),(PUB/'catalog.json','catalog.json'),(PUB/'README.html','README.html'),(PUB/'LICENSE','LICENSE'),(PUB/'THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md'),(PUB/'CONTRIBUTING.md','CONTRIBUTING.md'),(PUB/'QA.html','QA.html'),(PUB/'REVIEW.html','REVIEW.html')]
    pairs += [(PUB/'downloads/meta-prompt.txt','downloads/meta-prompt.txt'),(PUB/'downloads/imagination-developer.zip','downloads/imagination-developer.zip'),(PUB/'downloads/imagination-atelier-creative-kit.zip','downloads/imagination-atelier-creative-kit.zip')]
    # Remove recursive full-archive download link from the index inside the full-archive.
    localindex=ROOT/'.artifacts'/'all-START.html';localindex.write_text(doc.replace('<a href="downloads/atelier-all-30.zip" download>下载全部作品 ↓</a>',''))
    pairs=[pair for pair in pairs if pair[1]!='START.html']+[(localindex,'START.html')]
    zip_paths(PUB/'downloads/atelier-all-30.zip',pairs)
    print('Prepared 30-work offline catalog, docs, assets and five validated downloads.')

if __name__=='__main__':main()
