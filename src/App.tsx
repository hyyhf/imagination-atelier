import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Chip, Modal, Tabs } from '@heroui/react';
import { asset, collections, repo, steps, works, type Work } from './data';

const selectedFromHash = () => {
  const raw = location.hash.startsWith('#work=') ? location.hash.slice(6) : '';
  try { return works.find(w => w.id === decodeURIComponent(raw)) || null; } catch { return null; }
};
const initialCollection = () => 'all';

function TextFile({ path, title }: { path: string; title: string }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('正在读取…');
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setText(''); setStatus('正在读取…');
    fetch(asset(path), { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(s => { setText(s); setStatus(''); })
      .catch(e => { if (e.name !== 'AbortError') setStatus('文件读取失败。可使用下方独立下载链接。'); });
    return () => controller.abort();
  }, [path]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setStatus('已复制完整内容。'); }
    catch { area.current?.focus(); area.current?.select(); setStatus('内容已选中，请按 Ctrl/Cmd+C 复制。'); }
  };
  return <section className="file-reader"><div className="file-actions"><h3>{title}</h3><Button variant="secondary" onPress={copy} isDisabled={!text}>复制全文</Button><a href={asset(path)} download>下载 .txt ↗</a></div><p className="reader-status" role="status">{status}</p>{text && <textarea ref={area} value={text} readOnly aria-label={title} spellCheck={false} />}</section>;
}

function CaseViewer({ work, close }: { work: Work | null; close: () => void }) {
  const [tab, setTab] = useState('overview');
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setTab('overview'); setEntered(false); setReady(false); }, [work?.id]);
  return <Modal.Backdrop isOpen={!!work} onOpenChange={open => { if (!open) close(); }} variant="blur">
    <Modal.Container size="cover" scroll="inside"><Modal.Dialog className="case-dialog">
      {work && <><Modal.CloseTrigger aria-label="关闭案例" /><Modal.Header><div className="eyebrow">CASE {String(work.number).padStart(2, '0')} / {work.domain}</div><Modal.Heading className="case-title">{work.title}</Modal.Heading><p>{work.description}</p></Modal.Header>
      <Modal.Body><Tabs selectedKey={tab} onSelectionChange={k => setTab(String(k))}>
        <Tabs.ListContainer><Tabs.List aria-label="案例内容"><Tabs.Tab id="overview">体验作品<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="prompt">制作提示词<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="guide">使用与边界<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="record">原始记录<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="upgrade">v4 改动与缺口<Tabs.Indicator /></Tabs.Tab></Tabs.List></Tabs.ListContainer>
        <Tabs.Panel id="overview"><div className="case-tools"><a className="action-link primary" href={asset(work.entry)} target="_blank" rel="noopener noreferrer">独立窗口打开 ↗</a><a className="action-link" href={asset(work.entry)} download={`${work.id}.html`}>下载单文件 HTML ↓</a><Chip>{work.dimension}</Chip></div>
          {!entered ? <div className="case-poster"><img src={asset(work.preview)} alt={`${work.title}实际绘制画面`} /><Button className="enter-work" onPress={() => setEntered(true)}>在展厅中启动作品 ↗</Button></div> : <div className="frame-shell">{!ready && <p role="status">正在载入作品。没有显示时，请使用独立窗口打开。</p>}<iframe title={work.title} src={asset(work.entry)} onLoad={() => setReady(true)} allow="fullscreen; autoplay; clipboard-write" allowFullScreen /></div>}
          <p className="subtle">作品在你的浏览器中运行，不上传输入数据。复杂编辑建议在桌面端独立窗口打开。下载的 HTML 可直接打开，重要成果请另存为作品支持的方案文件。</p></Tabs.Panel>
        <Tabs.Panel id="prompt">{tab === 'prompt' && <TextFile path={work.prompt} title="独立制作提示词" />}</Tabs.Panel>
        <Tabs.Panel id="guide">{tab === 'guide' && <TextFile path={work.guide} title="使用说明与模型边界" />}</Tabs.Panel>
        <Tabs.Panel id="upgrade">{tab === 'upgrade' && <TextFile path={`works/${work.id}/upgrade-v4.txt`} title="本轮实际改动与待验证项" />}</Tabs.Panel><Tabs.Panel id="record">{tab === 'record' && <TextFile path={work.record} title="设计与迭代记录" />}</Tabs.Panel>
      </Tabs></Modal.Body><Modal.Footer><span className="subtle">IMAGINATION ATELIER · LOCAL FIRST</span><Button slot="close" variant="secondary">回到展览</Button></Modal.Footer></>}
    </Modal.Dialog></Modal.Container>
  </Modal.Backdrop>;
}

export default function App() {
  const [collection, setCollection] = useState(initialCollection);
  const [medium, setMedium] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Work | null>(selectedFromHash);
  const [compare, setCompare] = useState(50);
  const [copied, setCopied] = useState('');
  const [starter, setStarter] = useState('我想做一个能直接用的小工具，现在只有一个模糊的想法。请先帮我找到值得做的方向。');
  const starterArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const fn = () => setSelected(selectedFromHash()); addEventListener('hashchange', fn); return () => removeEventListener('hashchange', fn); }, []);
  useEffect(() => { document.title = selected ? `${selected.title} · 想象显影机` : '想象显影机 · Imagination Atelier'; }, [selected]);
  const active = collections.find(c => c.id === collection)!;
  const filtered = useMemo(() => works.filter(w => (collection === 'all' || w.series === collection) && (medium === 'all' || (medium === '3D' ? w.dimension.includes('3D') : !w.dimension.includes('3D'))) && `${w.title} ${w.domain} ${w.description} ${w.subject}`.toLowerCase().includes(query.trim().toLowerCase())), [collection, medium, query]);
  const open = (work: Work) => { setSelected(work); history.replaceState(null, '', `#work=${encodeURIComponent(work.id)}`); };
  const close = () => { setSelected(null); history.replaceState(null, '', '#works'); };
  const copyStarter = async () => {
    try { await navigator.clipboard.writeText(starter); setCopied('已复制。将完整元提示词和这句话一起交给 AI。'); }
    catch { starterArea.current?.focus(); starterArea.current?.select(); setCopied('内容已选中，请按 Ctrl/Cmd+C。'); }
  };
  return <>
    <a className="skip-link" href="#works">跳到作品目录</a>
    <header className="site-header"><a className="brand" href="#" aria-label="想象显影机首页"><span className="brand-symbol" aria-hidden="true">✳</span><span>想象显影机<small>IMAGINATION ATELIER</small></span></a><nav aria-label="主导航"><a href="#works">作品</a><a href="#method">方法</a><a href="#skill">Skill</a><a href={repo} target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav><a className="header-cta" href="#download">带走工具箱 ↗</a></header>
    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="dot" /> A WORKSHOP FOR THE NOT-YET-DEFINED</p><h1>让想象，<br /><span>有形。</span><i aria-hidden="true">↗</i></h1><p className="hero-description">从「大概是这样」，到「原来真的可以」。<br />一套创作 Skill，三十件可以亲手使用的作品。</p><div className="hero-buttons"><a className="action-link primary" href="#works">进入作品展览 <span>↓</span></a><a className="text-link" href="#skill">从我的想法开始 ↗</a></div><p className="hero-foot">LOCAL-FIRST · NO BUILD TO USE THE WORKS · OPEN SOURCE</p></div>
        <div className="hero-art"><div className="art-topline"><span>SPATIAL WORKBENCH / 011</span><span>可交互 · 真实模型</span></div><button className="hero-art-button" onClick={() => open(works[10])} aria-label="体验开店之前的三维布置与方案对照"><img src={asset('images/11-popup.png')} alt="开店之前：同源三维陈列场景" /><span className="orbit-mark" aria-hidden="true">↗</span></button><div className="art-caption"><div><small>同一套尺寸，不同的空间判断</small><strong>开店之前。</strong></div><Button variant="secondary" onPress={() => open(works[10])}>布置与对照 ↗</Button></div></div>
      </section>
      <p className="offline-banner">v4 工作版：30件有实际升级，17件空间显示更新。真实浏览器／触屏验收待完成。<a href={asset('REVIEW.html')}>看真实对照与缺口 ↗</a> · <a href={asset('QA.html')}>本地验收 ↗</a></p><div className="manifesto"><span>不是三十张漂亮的网页。</span><strong>是三十件改过的作品，一份诚实的完成清单。</strong><span className="manifesto-count">30 / 03</span></div>
      <section id="works" className="collection-section"><div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>不同的想法，<br />有不同的形状。</h2></div><p>有的适合在空间里转一圈，<br />有的适合在手边完成一件小事。<br />挑一件，开始玩，也开始用。</p></div>
        <div className="collection-filters"><div className="collection-buttons" role="group" aria-label="作品辑别">{collections.map(c => <Button key={c.id} variant={collection === c.id ? 'primary' : 'secondary'} aria-pressed={collection === c.id} onPress={() => { setCollection(c.id); setMedium('all'); }}>{c.label}<small>{c.id === 'all' ? '30' : '10'}</small></Button>)}</div><label className="search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="搜题目、用途、学科…" value={query} onChange={e => setQuery(e.target.value)} aria-label="搜索作品" /></label></div>
        <div className="collection-caption"><div><span className="eyebrow">{active.en}</span><p>{active.note}</p></div><div className="medium-filter"><label>媒介 <select value={medium} onChange={e => setMedium(e.target.value)}><option value="all">全部</option><option value="3D">包含真实 3D</option><option value="2D">二维 / 声音</option></select></label><span role="status">{filtered.length} 件作品</span></div></div>
        <div className="work-grid">{filtered.map(w => <article className="work-card" key={w.id}><button className="work-image" onClick={() => open(w)} aria-label={`查看${w.title}`}><img src={asset(w.preview)} alt={`${w.title}实际画面`} loading="lazy" width="960" height="640" /><span className="work-number">{String(w.number).padStart(2, '0')}</span><span className="image-arrow" aria-hidden="true">↗</span></button><div className="work-meta"><span>{w.domain}</span><Chip size="sm">{w.dimension}</Chip></div><h3><button onClick={() => open(w)}>{w.title}</button></h3><p>{w.description}</p><div className="work-links"><button onClick={() => open(w)}>体验与制作过程 ↗</button><a href={asset(w.entry)} download={`${w.id}.html`} aria-label={`下载${w.title} HTML`}>HTML ↓</a></div></article>)}</div>
        {!filtered.length && <div className="empty-state"><h3>这里还没有这个想法。</h3><p>清除筛选再看看，或者用 Skill 把它做出来。</p><Button onPress={() => {setQuery('');setMedium('all');setCollection('all');}}>重置筛选</Button></div>}
      </section>
      <section id="method" className="method-section"><div className="method-intro"><p className="eyebrow">LESS MAGIC. MORE MAKING.</p><h2>惊喜，<br />也可以有方法。</h2><p>不把一长串形容词当作设计。<br />先找到该做什么，再把它真正做完。</p><a href={asset('downloads/meta-prompt.txt')} download className="text-link">拿走完整创作方法 ↗</a></div><div className="steps">{steps.map(([number,title,desc])=><div className="step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{desc}</p></div></div>)}</div></section>
      <section className="iteration-section"><div><p className="eyebrow">A SECOND EXPOSURE</p><h2>再显影一次。</h2><p>迭代不只是「再高级一点」。<br />真实首轮与修订的对照，让变化看得见。</p><p className="subtle">来自本轮店面案例的同状态、同镜头重放。<br />不是浏览器截图；只比较主画面和显示细节。</p></div><div className="compare-box"><div className="compare-images"><img src={asset('images/11-popup.png')} alt="店面 v4 同源主画面" /><img className="before" style={{clipPath:`inset(0 ${100-compare}% 0 0)`}} src={asset('images/v4-popup-before.png')} alt="店面 v3.3 同源主画面" /><span className="compare-divider" style={{left:`${compare}%`}} /><span className="compare-label left">首轮</span><span className="compare-label right">修订</span></div><label>前后对照<input type="range" min="0" max="100" value={compare} onChange={e=>setCompare(Number(e.target.value))} aria-label="调整前后对比位置" /></label></div></section>
      <section id="skill" className="skill-section"><div><p className="eyebrow">THE SKILL / v4.0</p><h2>下一个作品，<br />从你开始。</h2><p>不必先想清楚所有细节。给 AI 一个目标，<br />再给它一套认真创作的工作方式。</p><a className="action-link primary" href={asset('downloads/meta-prompt.txt')} download>① 下载完整元提示词 ↓</a><a className="action-link" href={asset('downloads/imagination-developer-v4.0.zip')} download>安装 Skill 目录 ↗</a></div><div className="starter-panel"><label htmlFor="idea">② 再写下你的想法</label><textarea id="idea" ref={starterArea} value={starter} onChange={e=>setStarter(e.target.value)} /><Button onPress={copyStarter}>复制我的起点 ↗</Button><p className="subtle" role="status">{copied || '将完整元提示词和你的想法一起发给 AI。这里是本地编辑入口，不会偷偷调用 API。'}</p><details><summary>普通聊天 / Codex / Claude Code 怎样安装？</summary><p>普通聊天复制完整元提示词即可。支持 Skill 的工具，把目录中的 SKILL.md 连同 references 与 assets 一起安装。不要只复制文件标题。</p><a href={asset('README.html')} target="_blank" rel="noopener noreferrer">打开完整安装与使用说明 ↗</a></details></div></section>
      <section id="download" className="downloads-section"><div className="section-heading"><div><p className="eyebrow">TAKE IT WITH YOU</p><h2>属于你的工具箱。</h2></div><p>作品运行在你的浏览器里。<br />不注册，不上传输入；重要成果请保存备份。</p></div><div className="download-grid">{[
        ['全部 30 件独立作品','三辑作品、说明与完整 Skill。解压后打开 START.html。','atelier-all-30.zip','01'],
        ['科学实验室','数学、物理、地理、计算机与大模型，十个实验。','atelier-science.zip','02'],
        ['实用工坊','空间、包装、音频、研究与生活，十件工具。','atelier-practical.zip','03'],
        ['想象展览','光、几何、器物与叙事，十种探索。','atelier-explore.zip','04'],
        ['创作 Skill v4.0','完整 Skill 目录，含按需参考与可选脚本。','imagination-developer-v4.0.zip','05'],
        ['完整网站源码','Vite / React / HeroUI、30 件作品与 CI/CD。','portfolio-source.zip','06'],
      ].map(([name,desc,file,num])=><a key={file} className="download-card" href={asset(`downloads/${file}`)} download><span>{num} / ZIP</span><h3>{name}</h3><p>{desc}</p><strong>下载 ↙</strong></a>)}</div></section>
    </main><footer className="site-footer"><a className="brand" href="#"><span className="brand-symbol">✳</span><span>想象显影机<small>MAKE THE NOT-YET-POSSIBLE TANGIBLE.</small></span></a><p>原创内容 MIT · 第三方资源保留各自许可<br />不是工程承诺，不是云端 AI 服务。每件作品有自己的模型边界。</p><div><a href={repo} target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href={asset('README.html')}>文档 ↗</a><a href={asset('START.html')}>离线目录 ↗</a></div></footer>
    <CaseViewer work={selected} close={close}/>
  </>;
}
