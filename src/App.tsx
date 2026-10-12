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
const featured = [
  { work: works.find(w => w.id === '03-photo-batch')!, title: '照片多规格裁切', label: '照片批量出图', note: '圈定主体，联动多种比例，整批带走可用图片。' },
  { work: works.find(w => w.id === '05-drawer')!, title: '抽屉分隔板设计', label: '抽屉分隔板', note: '改净格尺寸，查看插接装配，带走 1:1 切割图。' },
  { work: works.find(w => w.id === '10-product-studio')!, title: '3D 产品摄影', label: '3D 产品摄影', note: '导入自己的产品模型，布光取景，输出照片与海报。' },
];
const gallerySelection = ['03-photo-batch', '05-drawer', '10-product-studio', '01-assembly', '12-packaging', '02-production']
  .map(id => works.find(work => work.id === id)!).filter(Boolean);
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
const navItems = [['works', '作品展厅'], ['method', '创作方法'], ['skill', '灵感工作台'], ['download', '下载收藏']];

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
  const [featureIndex, setFeatureIndex] = useState(0);
  const feature = featured[featureIndex];
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
    const media = matchMedia('(min-width: 681px)');
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
  const isCurated = !expanded && collection === 'all' && medium === 'all' && !query.trim();
  const visibleWorks = isCurated ? gallerySelection : filtered;
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
      <a className="header-cta" href="#skill">开始创作 <Icon name="external" /></a>
      <button className="menu-toggle" aria-controls="main-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? '关闭导航' : '打开导航'} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
    </header>

    <main ref={main}>
      <section id="hero" className="hero">
        <div className="hero-layout">
          <div className="hero-copy">
            <p className="hero-intro">从一句想法，到自己的工具与作品</p>
            <h1>把想法，<br /><em>做成作品。</em></h1>
            <p className="hero-description">带入自己的材料，直接调整细节，<br />带走能继续使用的结果。</p>
            <div className="hero-buttons"><a className="action-link primary" href="#works">进入作品展厅 <Icon name="external" /></a><a className="hero-secondary" href="#skill">我也想做一个 <Icon name="arrow" /></a></div>
            <div className="hero-footnote"><span className="hero-count">{works.length}<small>件可交互作品</small></span><p>在浏览器里体验<br />也可以下载，慢慢探索</p></div>
          </div>
          <div className="hero-exhibit">
            <div className="exhibit-topline"><span>实际作品 / 直接体验</span><span>0{featureIndex + 1} — 03</span></div>
            <button className={`exhibit-art exhibit-art--${feature.work.slug}`} onClick={() => open(feature.work)} aria-label={`体验${feature.work.title}`}>
              <img key={feature.work.id} src={asset(feature.work.preview)} alt={feature.work.title} width="1400" height="933" fetchPriority="high" />
              <span className="exhibit-invitation">亲手试一试 <Icon name="external" /></span>
            </button>
            <div className="exhibit-caption" aria-live="polite"><div><h2>{feature.title}</h2><p>{feature.note}</p></div><span className="exhibit-number" aria-hidden="true">0{featureIndex + 1}</span></div>
            <div className="exhibit-selector" role="group" aria-label="切换精选作品">{featured.map((item, index) => <button key={item.work.id} aria-pressed={featureIndex === index} onClick={() => setFeatureIndex(index)}><span>0{index + 1}</span>{item.label}<Icon name="arrow" /></button>)}</div>
          </div>
        </div>
        <div className="hero-bottom"><span>从生活里的问题，到脑海里的奇想。</span><a href="#works">往下探索 <Icon name="down" /></a></div>
      </section>

      <section id="works" className="collection-section">
        <div className="section-heading"><div><span className="section-kicker">01 / THE COLLECTION</span><h2>选择你要完成的事<span className="heading-count">{works.length}</span></h2></div><p>先试关键操作，再换自己的材料。<br />每件作品附使用说明与实际边界。</p></div>
        <div className="collection-filters">
          <div className="collection-buttons" role="group" aria-label="作品辑别">{collections.map(c => <Button key={c.id} variant="secondary" aria-pressed={collection === c.id} onPress={() => { setCollection(c.id); setMedium('all'); setExpanded(false); }}>{c.label}<span>{c.id === 'all' ? works.length : works.filter(w => w.series === c.id).length}</span></Button>)}</div>
          <label className="search-box"><Icon name="search" /><input type="search" placeholder="搜索题目、用途或学科" value={query} onChange={e => setQuery(e.target.value)} aria-label="搜索作品" /></label>
        </div>
        <div className="collection-caption"><p>{active.note}</p><div className="medium-filter"><label>媒介 <select aria-label="作品媒介" value={medium} onChange={e => setMedium(e.target.value)}><option value="all">全部媒介</option><option value="3D">包含 3D</option><option value="2D">二维 / 声音</option></select></label><span role="status">{filtered.length} 件作品</span></div></div>
        <div className={`work-grid${isCurated ? ' curated-grid' : ''}`}>{visibleWorks.map(w => <article className="work-card" key={w.id}>
          <button className="work-image" data-work={w.id} onClick={() => open(w)} aria-label={`查看${w.title}`}><img src={asset(w.preview)} alt={`${w.title}实际画面`} loading="lazy" width="960" height="640" /><span className="image-arrow"><Icon name="arrow" /></span></button>
          <div className="work-meta"><span>{String(w.number).padStart(2, '0')}<span className="meta-divider">/</span>{w.domain}</span><span className="work-dimension">{w.dimension}</span></div>
          <h3><button onClick={() => open(w)}>{w.title}</button></h3><p>{w.description}</p>
          <div className="work-links"><button onClick={() => open(w)}>体验作品 <Icon name="arrow" /></button><a href={asset(w.entry)} download={`${w.id}.html`} aria-label={`下载${w.title} HTML`}>下载 HTML <Icon name="download" /></a></div>
        </article>)}</div>
        {!filtered.length && <div className="empty-state"><Icon name="search" /><h3>还没找到这件作品</h3><p>换个关键词试试，也许它正是你的下一个创作。</p><Button variant="secondary" onPress={resetFilters}>重置筛选</Button><a className="text-link" href="#skill">开始我的创作 <Icon name="arrow" /></a></div>}
        {visibleWorks.length < filtered.length && <div className="collection-more"><span>已展示 {visibleWorks.length} / {filtered.length} 件</span><Button variant="secondary" onPress={() => setExpanded(true)}>展开全部作品 <Icon name="plus" /></Button></div>}
      </section>

      <section id="method" className="method-section">
        <div className="method-intro"><div><span className="section-kicker">02 / THE PROCESS</span><h2>让最费力的事，<br /><em>有更直接的做法。</em></h2></div><div><p>你只需说想完成什么。<br />Skill 引导 AI 找出困难、设计关键操作，<br />用实际结果检验这套做法。</p><a href={asset('prompts/full-meta-prompt.txt')} download className="text-link">带走完整创作方法 <Icon name="external" /></a></div></div>
        <div className="steps">{steps.map(([number, title, desc], index) => <div className="step" key={number}><div className="step-top"><Icon name={(['compass', 'layers', 'hand', 'check'] as const)[index]} /><span>{number}</span></div><div><h3>{title}</h3><p>{desc}</p></div></div>)}</div>
      </section>

      <section id="skill" className="skill-section">
        <div className="skill-intro"><span className="section-kicker">03 / YOUR NEXT IDEA</span><h2>这里还留着<br /><em>你的位置。</em></h2><p>想理解的概念，想送出的礼物，<br />或一直想解决的小麻烦。<br />下一件作品，就从这句话开始。</p><div className="idea-orbit" aria-hidden="true"><span>what if</span><Icon name="plus" /></div><a className="text-link" href={asset('downloads/imagination-developer.zip')} download>已经有想法？下载创作 Skill <Icon name="download" /></a></div>
        <div className="starter-panel">
          <div className="starter-modes" role="group" aria-label="选择交付方式"><span className="mode-indicator" style={{ transform: `translateX(${modes.findIndex(m => m.id === mode) * 100}%)` }} />{modes.map(m => <button key={m.id} aria-pressed={mode === m.id} onClick={() => { setMode(m.id); setCopied(''); }}>{m.label}</button>)}</div>
          <label htmlFor="idea">如果可以，我想做一个……</label><textarea id="idea" value={starter} onChange={e => { setStarter(e.target.value); setCopied(''); }} placeholder="还没想清楚也没关系，从一句话开始。" />
          <div className="idea-suggestions"><span>试试这些起点</span><div>{ideas.map(([name, text]) => <button key={name} onClick={() => { setStarter(text); setCopied(''); }}>{name}</button>)}</div></div>
          <Button className={`copy-instruction ${copied ? 'has-feedback' : ''}`} onPress={copyStarter} isDisabled={!starter.trim()}>{copied.startsWith('已复制') ? <><Icon name="check" />已复制，去创作</> : <>复制完整创作指令 <Icon name="arrow" /></>}</Button>
          <p className="copy-status subtle" role="status">{copied || '包含创作方法、交付要求和你的想法。'}</p>
          <button className="preview-toggle" aria-expanded={preview} aria-controls="complete-instruction" onClick={() => setPreview(!preview)}>查看完整指令 <Icon name={preview ? 'close' : 'plus'} /></button>
          {preview && <textarea id="complete-instruction" className="complete-instruction" ref={completeArea} value={fullInstruction} readOnly aria-label="完整创作指令" />}
          <details><summary>在支持 Skills 的助手中安装</summary><p>运行下面的命令，或让助手从仓库安装完整目录。</p><code>npx skills add hyyhf/imagination-atelier --skill imagination-developer</code><a className="text-link" href={asset('README.html')} target="_blank" rel="noopener noreferrer">查看安装说明 <Icon name="external" /></a></details>
        </div>
      </section>

      <section id="download" className="downloads-section">
        <div className="section-heading"><div><span className="section-kicker">04 / TAKE IT WITH YOU</span><h2>喜欢的话，就带走吧。</h2></div><p>下载，解压，随时打开。<br />让灵感在你的电脑里继续生长。</p></div>
        <div className="download-grid">{downloads.map(([name, desc, file], index) => <a key={file} className="download-card" href={asset(`downloads/${file}`)} download><span className="download-number">0{index + 1}</span><div><h3>{name}</h3><p>{desc}</p></div><span className="download-action"><Icon name="download" /><span>下载</span></span></a>)}</div>
      </section>
    </main>

    <footer className="site-footer"><div className="footer-statement"><p>Stay curious.<br /><em>Keep imagining.</em></p><a href="#hero" aria-label="回到顶部"><Icon name="up" /></a></div><div className="footer-top"><a className="brand" href="#hero"><span className="brand-symbol" aria-hidden="true">ia.</span><span>想象显影机<small>Imagination Atelier</small></span></a><div><a href={repo} target="_blank" rel="noopener noreferrer">GitHub <Icon name="external" /></a><a href={asset('README.html')}>使用说明 <Icon name="arrow" /></a><a href={asset('START.html')}>离线目录 <Icon name="arrow" /></a></div></div><div className="footer-bottom"><span>原创内容采用 MIT 许可 · 第三方资源保留各自许可</span><span>给好奇心，一个动手的地方。</span></div></footer>
    <CaseViewer work={selected} close={close} />
  </>;
}
