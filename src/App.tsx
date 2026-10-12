import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Chip, Modal, Tabs } from '@heroui/react';
import { asset, collections, repo, steps, works, type Work } from './data';
import { Icon } from './Icons';
import { useAtelierMotion } from './useAtelierMotion';
import metaPrompt from '../prompts/full-meta-prompt.txt?raw';

const selectedFromHash = () => {
  const raw = location.hash.startsWith('#work=') ? location.hash.slice(6) : '';
  try { return works.find(w => w.id === decodeURIComponent(raw)) || null; } catch { return null; }
};
const featured = [works[0], works[9], works[1]];
const modes = [
  { id: 'make', label: '直接制作', request: '本次交付：直接制作并交付完整本地 HTML 作品和必要的资源。' },
  { id: 'prompt', label: '生成提示词', request: '本次交付：先给我可以交给另一位 AI 独立执行的完整制作提示词。' },
  { id: 'explore', label: '探索方向', request: '本次交付：先提出少量体验真正不同的作品方向，说明各自的动作、反馈和成果。' },
];
const ideas = [
  ['安排一个小展览', '我有一批不同尺寸的展品，想在小展厅里亲手摆放，看到遮挡与通道，最后带走布置图。'],
  ['理解一个概念', '我想让中学生亲手改变镜子的位置，看到光如何反射，自己找到把光送到目标的方法。'],
  ['把回忆做成礼物', '我想用几张照片、一段声音和一些文字，为朋友做一份可以本地打开、慢慢翻看的纪念作品。'],
];
const downloads = [
  ['全部 30 件作品', '三辑作品与使用说明，解压后打开 START.html。', 'atelier-all-30.zip'],
  ['科学实验室', '数学、物理与计算机，十个可以动手的实验。', 'atelier-science.zip'],
  ['工作与生活', '排程、表格、文字与声音，带入自己的内容。', 'atelier-practical.zip'],
  ['设计与工程', '装配、产品摄影、空间与器形，动手修改并输出。', 'atelier-explore.zip'],
  ['创作工具包', '完整 Skill、元提示词与创作入口。', 'imagination-atelier-creative-kit.zip'],
  ['完整源码', '网站、独立作品与创作资料。', 'portfolio-source.zip'],
];
const navItems = [['works', '作品展厅'], ['method', '创作方法'], ['skill', '开始创作'], ['download', '下载收藏']];

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
      .catch(e => { if (e.name !== 'AbortError') setStatus('文件读取失败，请使用下载链接。'); });
    return () => controller.abort();
  }, [path]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setStatus('已复制完整内容。'); }
    catch { area.current?.focus(); area.current?.select(); setStatus('内容已选中，请按 Ctrl/Cmd+C 复制。'); }
  };
  return <section className="file-reader">
    <div className="file-actions"><h3>{title}</h3><Button variant="secondary" onPress={copy} isDisabled={!text}>复制全文</Button><a className="text-link" href={asset(path)} download>下载文本 <Icon name="download" /></a></div>
    <p className="reader-status" role="status">{status}</p>
    {text && <textarea ref={area} value={text} readOnly aria-label={title} spellCheck={false} />}
  </section>;
}

function CaseViewer({ work, close }: { work: Work | null; close: () => void }) {
  const [tab, setTab] = useState('overview');
  const [ready, setReady] = useState(false);
  useEffect(() => { setTab('overview'); setReady(false); }, [work?.id]);
  return <Modal.Backdrop isOpen={!!work} onOpenChange={open => { if (!open) close(); }} variant="blur">
    <Modal.Container size="cover" scroll="inside"><Modal.Dialog className="case-dialog">
      {work && <>
        <Modal.CloseTrigger aria-label="关闭案例"><Icon name="close" /></Modal.CloseTrigger>
        <Modal.Header><div className="case-meta">作品 {String(work.number).padStart(2, '0')}<span>{work.domain}</span></div><Modal.Heading className="case-title">{work.title}</Modal.Heading><p>{work.description}</p></Modal.Header>
        <Modal.Body><Tabs selectedKey={tab} onSelectionChange={k => setTab(String(k))}>
          <Tabs.ListContainer><Tabs.List aria-label="案例内容">
            <Tabs.Tab id="overview">体验作品<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="prompt">制作提示词<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="guide">使用与边界<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="record">创作记录<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List></Tabs.ListContainer>
          <Tabs.Panel id="overview">
            <div className="case-tools"><a className="action-link primary" href={asset(work.entry)} target="_blank" rel="noopener noreferrer">在新窗口体验 <Icon name="external" /></a><a className="action-link secondary" href={asset(work.entry)} download={`${work.id}.html`}>下载 HTML <Icon name="download" /></a><Chip>{work.dimension}</Chip></div>
            <div className="frame-shell">{!ready && <p role="status"><span className="loading-dot" />正在打开作品…</p>}<iframe title={work.title} src={asset(work.entry)} onLoad={() => setReady(true)} allow="fullscreen; autoplay; clipboard-write" allowFullScreen /></div>
            <p className="subtle case-help">需要更大的操作空间？在新窗口体验。重要进度请使用作品里的保存入口。</p>
          </Tabs.Panel>
          <Tabs.Panel id="prompt">{tab === 'prompt' && <TextFile path={work.prompt} title="独立制作提示词" />}</Tabs.Panel>
          <Tabs.Panel id="guide">{tab === 'guide' && <TextFile path={work.guide} title="使用说明与模型边界" />}</Tabs.Panel>
          <Tabs.Panel id="record">{tab === 'record' && <TextFile path={work.record} title="设计与迭代记录" />}</Tabs.Panel>
        </Tabs></Modal.Body>
        <Modal.Footer><span className="subtle">下载后，随时在自己的浏览器里打开。</span><Button slot="close" variant="secondary">回到展厅</Button></Modal.Footer>
      </>}
    </Modal.Dialog></Modal.Container>
  </Modal.Backdrop>;
}

export default function App() {
  const [collection, setCollection] = useState('all');
  const [medium, setMedium] = useState('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Work | null>(selectedFromHash);
  const [mode, setMode] = useState('make');
  const [copied, setCopied] = useState('');
  const [starter, setStarter] = useState(ideas[0][1]);
  const [preview, setPreview] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const completeArea = useRef<HTMLTextAreaElement>(null);
  const main = useRef<HTMLElement>(null);
  useAtelierMotion(main, JSON.stringify([collection, medium, query, expanded, preview, copied]));

  useEffect(() => {
    const fn = () => setSelected(selectedFromHash());
    addEventListener('hashchange', fn);
    return () => removeEventListener('hashchange', fn);
  }, []);
  useEffect(() => { document.title = selected ? `${selected.title} · 想象显影机` : '想象显影机 · Imagination Atelier'; }, [selected]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id === 'hero' ? '' : visible[0].target.id);
    }, { rootMargin: '-15% 0px -60% 0px' });
    main.current?.querySelectorAll('section[id]').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    const media = matchMedia('(min-width: 761px)');
    const closeOnResize = () => { if (media.matches) setMenuOpen(false); };
    addEventListener('keydown', closeOnEscape);
    media.addEventListener('change', closeOnResize);
    return () => { removeEventListener('keydown', closeOnEscape); media.removeEventListener('change', closeOnResize); };
  }, [menuOpen]);

  const active = collections.find(c => c.id === collection)!;
  const filtered = useMemo(() => works.filter(w =>
    (collection === 'all' || w.series === collection)
    && (medium === 'all' || (medium === '3D' ? w.dimension.includes('3D') : !w.dimension.includes('3D')))
    && `${w.title} ${w.domain} ${w.description} ${w.subject}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [collection, medium, query]);
  const visibleWorks = expanded || collection !== 'all' || medium !== 'all' || query.trim() ? filtered : filtered.slice(0, 9);
  const fullInstruction = `${metaPrompt.trim()}\n\n${modes.find(m => m.id === mode)!.request}\n\n我的想法：\n${starter.trim()}`;
  const open = (work: Work) => { setSelected(work); history.replaceState(null, '', `#work=${encodeURIComponent(work.id)}`); };
  const close = () => { setSelected(null); history.replaceState(null, '', '#works'); };
  const resetFilters = () => { setQuery(''); setMedium('all'); setCollection('all'); setExpanded(false); };
  const copyStarter = async () => {
    try { await navigator.clipboard.writeText(fullInstruction); setCopied('已复制完整指令。粘贴到你使用的 AI 中，开始创作。'); }
    catch {
      setPreview(true); setCopied('复制未完成，内容已选中。请按 Ctrl/Cmd+C 复制。');
      requestAnimationFrame(() => { completeArea.current?.focus(); completeArea.current?.select(); });
    }
  };

  return <>
    <a className="skip-link" href="#works">跳到作品目录</a>
    <header className="site-header">
      <a className="brand" href="#hero" aria-label="想象显影机首页"><span className="brand-symbol" aria-hidden="true">ia.</span><span>想象显影机<small>Imagination Atelier</small></span></a>
      <nav id="main-navigation" className={menuOpen ? 'is-open' : ''} aria-label="主导航">{navItems.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>
      <a className="header-cta" href={repo} target="_blank" rel="noopener noreferrer">GitHub <Icon name="external" /></a>
      <button className="menu-toggle" aria-controls="main-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? '关闭导航' : '打开导航'} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
    </header>

    <main ref={main}>
      <section id="hero" className="hero">
        <div className="hero-copy">
          <h1>把想象，<span>做成作品。</span></h1>
          <p>体验 {works.length} 件作品，<span className="keep-together">或开始你的下一次创作。</span></p>
          <div className="hero-buttons"><a className="action-link primary" href="#works">探索作品 <Icon name="arrow" /></a><a className="action-link secondary" href="#skill">开始我的创作 <Icon name="plus" /></a></div>
        </div>
        <div className="featured-grid" role="group" aria-label="精选作品" tabIndex={0}>{featured.map(work => <article className="featured-work" key={work.id}>
          <button className="featured-image" onClick={() => open(work)} aria-label={`体验${work.title}`}><img src={asset(work.preview)} alt={`${work.title}作品画面`} width="1400" height="933" fetchPriority="high" /><span className="feature-open"><Icon name="arrow" /></span></button>
          <div className="featured-caption"><div><span className="feature-label">{work.domain}</span><h2><button onClick={() => open(work)}>{work.title}</button></h2><p>{work.description}</p></div><span className="featured-index" aria-hidden="true">{String(work.number).padStart(2, '0')}</span></div>
        </article>)}</div>
        <div className="hero-bottom"><span>在浏览器里打开，把自己的内容带进去。</span><a href="#works">看看更多可能 <Icon name="arrow" /></a></div>
      </section>

      <section id="works" className="collection-section">
        <div className="section-heading"><div><h2>作品展厅<span className="heading-count">30</span></h2><p>直接看用途，带入自己的材料，完成一次真实任务。</p></div><a className="text-link" href="#skill">有了想法？开始创作 <Icon name="arrow" /></a></div>
        <div className="collection-filters">
          <div className="collection-buttons" role="group" aria-label="作品辑别">{collections.map(c => <Button key={c.id} variant="secondary" aria-pressed={collection === c.id} onPress={() => { setCollection(c.id); setMedium('all'); setExpanded(false); }}>{c.label}<span>{c.id === 'all' ? works.length : works.filter(w => w.series === c.id).length}</span></Button>)}</div>
          <label className="search-box"><Icon name="search" /><input type="search" placeholder="搜索题目、用途或学科" value={query} onChange={e => setQuery(e.target.value)} aria-label="搜索作品" /></label>
        </div>
        <div className="collection-caption"><p>{active.note}</p><div className="medium-filter"><label>媒介 <select aria-label="作品媒介" value={medium} onChange={e => setMedium(e.target.value)}><option value="all">全部媒介</option><option value="3D">包含 3D</option><option value="2D">二维 / 声音</option></select></label><span role="status">{filtered.length} 件作品</span></div></div>
        <div className="work-grid">{visibleWorks.map(w => <article className="work-card" key={w.id}>
          <button className="work-image" data-work={w.id} onClick={() => open(w)} aria-label={`查看${w.title}`}><img src={asset(w.preview)} alt={`${w.title}实际画面`} loading="lazy" width="960" height="640" /><span className="image-arrow"><Icon name="arrow" /></span></button>
          <div className="work-meta"><span>{String(w.number).padStart(2, '0')}<span className="meta-divider">/</span>{w.domain}</span><span className="work-dimension">{w.dimension}</span></div>
          <h3><button onClick={() => open(w)}>{w.title}</button></h3><p>{w.description}</p>
          <div className="work-links"><button onClick={() => open(w)}>体验作品 <Icon name="arrow" /></button><a href={asset(w.entry)} download={`${w.id}.html`} aria-label={`下载${w.title} HTML`}>下载 HTML <Icon name="download" /></a></div>
        </article>)}</div>
        {!filtered.length && <div className="empty-state"><Icon name="search" /><h3>还没找到这件作品</h3><p>换个关键词试试，也许它正是你的下一个创作。</p><Button variant="secondary" onPress={resetFilters}>重置筛选</Button><a className="text-link" href="#skill">开始我的创作 <Icon name="arrow" /></a></div>}
        {visibleWorks.length < filtered.length && <div className="collection-more"><span>已展示 {visibleWorks.length} / {filtered.length} 件</span><Button variant="secondary" onPress={() => setExpanded(true)}>展开全部作品 <Icon name="plus" /></Button></div>}
      </section>

      <section id="method" className="method-section">
        <div className="method-intro"><span className="section-label">创作方法</span><h2>一个好问题，<br />就是作品的起点。</h2><p>告诉 AI 你想理解什么、完成什么、表达什么。<br className="desktop-break" />从具体的内容与操作开始，让想法慢慢成形。</p><a href={asset('prompts/full-meta-prompt.txt')} download className="text-link">带走完整创作方法 <Icon name="download" /></a></div>
        <div className="steps">{steps.map(([number, title, desc]) => <div className="step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{desc}</p></div></div>)}</div>
      </section>

      <section id="skill" className="skill-section">
        <div className="skill-intro"><span className="section-label">轮到你了</span><h2>下一件作品，<br /><span>从你的想法开始。</span></h2><p>一句愿望，一张参考图，一个工作中的麻烦。<br className="desktop-break" />写下起点，把完整指令交给你使用的 AI。</p><div className="skill-notes"><span>写下想法</span><Icon name="arrow" /><span>复制指令</span><Icon name="arrow" /><span>开始创作</span></div><a className="text-link" href={asset('downloads/imagination-developer.zip')} download>下载创作 Skill <Icon name="download" /></a></div>
        <div className="starter-panel">
          <div className="starter-modes" role="group" aria-label="选择交付方式"><span className="mode-indicator" style={{ transform: `translateX(${modes.findIndex(m => m.id === mode) * 100}%)` }} />{modes.map(m => <button key={m.id} aria-pressed={mode === m.id} onClick={() => { setMode(m.id); setCopied(''); }}>{m.label}</button>)}</div>
          <label htmlFor="idea">你想做什么？</label><textarea id="idea" value={starter} onChange={e => { setStarter(e.target.value); setCopied(''); }} placeholder="还没想清楚也没关系，从一句话开始。" />
          <div className="idea-suggestions"><span>试试这些起点</span><div>{ideas.map(([name, text]) => <button key={name} onClick={() => { setStarter(text); setCopied(''); }}>{name}</button>)}</div></div>
          <Button className={`copy-instruction ${copied ? 'has-feedback' : ''}`} onPress={copyStarter} isDisabled={!starter.trim()}>{copied.startsWith('已复制') ? <><Icon name="check" />已复制，去创作</> : <>复制完整创作指令 <Icon name="arrow" /></>}</Button>
          <p className="copy-status subtle" role="status">{copied || '包含创作方法、交付要求和你的想法。'}</p>
          <button className="preview-toggle" aria-expanded={preview} aria-controls="complete-instruction" onClick={() => setPreview(!preview)}>查看完整指令 <Icon name={preview ? 'close' : 'plus'} /></button>
          {preview && <textarea id="complete-instruction" className="complete-instruction" ref={completeArea} value={fullInstruction} readOnly aria-label="完整创作指令" />}
          <details><summary>在支持 Skills 的助手中安装</summary><p>运行下面的命令，或让助手从仓库安装完整目录。</p><code>npx skills add hyyhf/imagination-atelier --skill imagination-developer</code><a className="text-link" href={asset('README.html')} target="_blank" rel="noopener noreferrer">查看安装说明 <Icon name="external" /></a></details>
        </div>
      </section>

      <section id="download" className="downloads-section">
        <div className="section-heading"><div><h2>把喜欢的，带到手边。</h2><p>下载、解压，在自己的浏览器里随时打开。</p></div><span className="download-format">ZIP 文件 · 免费下载</span></div>
        <div className="download-grid">{downloads.map(([name, desc, file], index) => <a key={file} className="download-card" href={asset(`downloads/${file}`)} download><span className="download-number">0{index + 1}</span><div><h3>{name}</h3><p>{desc}</p></div><span className="download-action"><Icon name="download" /><span>下载</span></span></a>)}</div>
      </section>
    </main>

    <footer className="site-footer"><div className="footer-top"><a className="brand" href="#hero"><span className="brand-symbol" aria-hidden="true">ia.</span><span>想象显影机<small>Imagination Atelier</small></span></a><p>给想法一个可以动手的地方。</p><div><a href={repo} target="_blank" rel="noopener noreferrer">GitHub <Icon name="external" /></a><a href={asset('README.html')}>使用说明 <Icon name="arrow" /></a><a href={asset('START.html')}>离线目录 <Icon name="arrow" /></a></div></div><div className="footer-bottom"><span>原创内容采用 MIT 许可 · 第三方资源保留各自许可</span><a href="#hero">回到顶部 <Icon name="up" /></a></div></footer>
    <CaseViewer work={selected} close={close} />
  </>;
}
