import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Chip, Modal, Tabs } from '@heroui/react';
import { asset, collections, repo, steps, works, type Work } from './data';
import metaPrompt from '../prompts/full-meta-prompt.txt?raw';

const selectedFromHash = () => {
  const raw = location.hash.startsWith('#work=') ? location.hash.slice(6) : '';
  try { return works.find(w => w.id === decodeURIComponent(raw)) || null; } catch { return null; }
};
const featured = [
  { work: works[10], label: '空间布置', action: '把自己的小店，先安放在尺寸里。', step: '改变房间与家具尺寸，直接摆放，再带走现场方案。' },
  { work: works[11], label: '纸样工坊', action: '让一份心意，真正折成形。', step: '输入礼物尺寸，定制包装，再把毫米纸样带到打印机。' },
  { work: works[20], label: '数据实验', action: '让自己的数据，给出可复核的回答。', step: '带入观测数据，比较模型，追踪误差，再留下分析结果。' },
];
const modes = [
  { id: 'make', label: '直接做作品', request: '本次交付：直接制作并交付完整本地 HTML 作品和必要的资源。' },
  { id: 'prompt', label: '生成制作提示词', request: '本次交付：先给我可以交给另一位 AI 独立执行的完整制作提示词。' },
  { id: 'explore', label: '先找方向', request: '本次交付：先提出少量体验真正不同的作品方向，说明各自的动作、反馈和成果。' },
];
const ideas = [
  ['安排一个小展览', '我有一批不同尺寸的展品，想在小展厅里亲手摆放，看到遮挡与通道，最后带走布置图。'],
  ['理解一个概念', '我想让中学生亲手改变镜子的位置，看到光如何反射，自己找到把光送到目标的方法。'],
  ['把回忆做成礼物', '我想用几张照片、一段声音和一些文字，为朋友做一份可以本地打开、慢慢翻看的纪念作品。'],
];

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
      .catch(e => { if (e.name !== 'AbortError') setStatus('文件读取失败，请使用独立下载链接。'); });
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
  const [ready, setReady] = useState(false);
  useEffect(() => { setTab('overview'); setReady(false); }, [work?.id]);
  return <Modal.Backdrop isOpen={!!work} onOpenChange={open => { if (!open) close(); }} variant="blur">
    <Modal.Container size="cover" scroll="inside"><Modal.Dialog className="case-dialog">
      {work && <><Modal.CloseTrigger aria-label="关闭案例" /><Modal.Header><div className="eyebrow">WORK {String(work.number).padStart(2, '0')} / {work.domain}</div><Modal.Heading className="case-title">{work.title}</Modal.Heading><p>{work.description}</p></Modal.Header>
      <Modal.Body><Tabs selectedKey={tab} onSelectionChange={k => setTab(String(k))}>
        <Tabs.ListContainer><Tabs.List aria-label="案例内容"><Tabs.Tab id="overview">体验作品<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="prompt">制作提示词<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="guide">使用与边界<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="record">创作记录<Tabs.Indicator /></Tabs.Tab></Tabs.List></Tabs.ListContainer>
        <Tabs.Panel id="overview"><div className="case-tools"><a className="action-link primary" href={asset(work.entry)} target="_blank" rel="noopener noreferrer">独立窗口打开 ↗</a><a className="action-link" href={asset(work.entry)} download={`${work.id}.html`}>下载单文件 HTML ↓</a><Chip>{work.dimension}</Chip></div>
          <div className="frame-shell">{!ready && <p role="status">正在打开作品…</p>}<iframe title={work.title} src={asset(work.entry)} onLoad={() => setReady(true)} allow="fullscreen; autoplay; clipboard-write" allowFullScreen /></div>
          <p className="subtle">可以直接操作。需要更大工作区时，在独立窗口中打开；重要进度请使用作品里的保存入口。</p></Tabs.Panel>
        <Tabs.Panel id="prompt">{tab === 'prompt' && <TextFile path={work.prompt} title="独立制作提示词" />}</Tabs.Panel>
        <Tabs.Panel id="guide">{tab === 'guide' && <TextFile path={work.guide} title="使用说明与模型边界" />}</Tabs.Panel>
        <Tabs.Panel id="record">{tab === 'record' && <TextFile path={work.record} title="设计与迭代记录" />}</Tabs.Panel>
      </Tabs></Modal.Body><Modal.Footer><span className="subtle">在本地使用，成果由你保留。</span><Button slot="close" variant="secondary">回到展览</Button></Modal.Footer></>}
    </Modal.Dialog></Modal.Container>
  </Modal.Backdrop>;
}

export default function App() {
  const [collection, setCollection] = useState('all');
  const [medium, setMedium] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Work | null>(selectedFromHash);
  const [feature, setFeature] = useState(0);
  const [mode, setMode] = useState('make');
  const [copied, setCopied] = useState('');
  const [starter, setStarter] = useState(ideas[0][1]);
  const [preview, setPreview] = useState(false);
  const completeArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const fn = () => setSelected(selectedFromHash()); addEventListener('hashchange', fn); return () => removeEventListener('hashchange', fn); }, []);
  useEffect(() => { document.title = selected ? `${selected.title} · 想象显影机` : '想象显影机 · Imagination Atelier'; }, [selected]);
  const active = collections.find(c => c.id === collection)!;
  const current = featured[feature];
  const filtered = useMemo(() => works.filter(w => (collection === 'all' || w.series === collection) && (medium === 'all' || (medium === '3D' ? w.dimension.includes('3D') : !w.dimension.includes('3D'))) && `${w.title} ${w.domain} ${w.description} ${w.subject}`.toLowerCase().includes(query.trim().toLowerCase())), [collection, medium, query]);
  const fullInstruction = `${metaPrompt.trim()}\n\n${modes.find(m => m.id === mode)!.request}\n\n我的想法：\n${starter.trim()}`;
  const open = (work: Work) => { setSelected(work); history.replaceState(null, '', `#work=${encodeURIComponent(work.id)}`); };
  const close = () => { setSelected(null); history.replaceState(null, '', '#works'); };
  const copyStarter = async () => {
    try { await navigator.clipboard.writeText(fullInstruction); setCopied('已复制元提示词、交付要求和你的想法。粘贴到你使用的 AI 中即可开始。'); }
    catch { setPreview(true); setCopied('请在下方选中完整指令，按 Ctrl/Cmd+C 复制。'); requestAnimationFrame(() => { completeArea.current?.focus(); completeArea.current?.select(); }); }
  };
  return <>
    <a className="skip-link" href="#works">跳到作品目录</a>
    <header className="site-header"><a className="brand" href="#" aria-label="想象显影机首页"><span className="brand-symbol" aria-hidden="true">ia.</span><span>想象显影机<small>IMAGINATION ATELIER</small></span></a><nav aria-label="主导航"><a href="#works">作品展厅</a><a href="#method">创作方法</a><a href="#skill">开始创作</a><a href={repo} target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav><a className="header-cta" href="#download">带走工具箱 ↗</a></header>
    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">AN ATELIER FOR YOUR NEXT IDEA</p><h1>把想象，<br /><span>做成作品。</span></h1><p className="hero-description">一个还说不清的念头，<br />也可以成为你能亲手使用的东西。</p><p className="hero-intro">用一套创作 Skill，把工具、实验与故事，<br />做成可以直接打开、继续修改、带走成果的作品。</p><div className="hero-buttons"><a className="action-link primary" href="#skill">从我的想法开始 <span>↗</span></a><a className="text-link" href="#works">先逛逛作品展厅 ↓</a></div><div className="hero-foot"><span>本地打开</span><span>真实操作</span><span>保留自己的成果</span></div></div>
        <div className="hero-art"><div className="feature-tabs" role="group" aria-label="精选作品">{featured.map((f, i) => <button key={f.work.id} aria-pressed={feature === i} onClick={() => setFeature(i)}>{f.label}</button>)}<span className="feature-count">0{feature + 1} / 03</span></div><button className="hero-art-button" onClick={() => open(current.work)} aria-label={`体验${current.work.title}`}><img src={asset(current.work.preview)} alt={`${current.work.title}作品画面`} /><span className="feature-open">打开作品 ↗</span></button><div className="art-caption"><div><p className="eyebrow">{current.work.domain}</p><h2>{current.work.title}</h2><p>{current.action}</p></div><button className="feature-arrow" onClick={() => open(current.work)} aria-label={`打开${current.work.title}`}>↗</button></div><p className="feature-step">{current.step}</p></div>
      </section>
      <div className="manifesto"><span>一个想法，有很多种打开方式。</span><div><strong>30</strong><span>件独立作品</span></div><div><strong>03</strong><span>类创作探索</span></div><div><strong>HTML</strong><span>下载后直接使用</span></div></div>
      <section id="works" className="collection-section"><div className="section-heading"><div><p className="eyebrow">THE COLLECTION / 30 WORKS</p><h2>先动手，<br />再看见可能。</h2></div><p>摆放一个空间，理解一条曲线，剪好一段声音。<br />挑一件作品，用自己的内容试一试。<br /><a href="#skill">有了新的想法，就从这里开始 ↗</a></p></div>
        <div className="collection-filters"><div className="collection-buttons" role="group" aria-label="作品辑别">{collections.map(c => <Button key={c.id} variant={collection === c.id ? 'primary' : 'secondary'} aria-pressed={collection === c.id} onPress={() => { setCollection(c.id); setMedium('all'); }}>{c.label}<small>{c.id === 'all' ? '30' : '10'}</small></Button>)}</div><label className="search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="搜索题目、用途或学科" value={query} onChange={e => setQuery(e.target.value)} aria-label="搜索作品" /></label></div>
        <div className="collection-caption"><div><span className="eyebrow">{active.en}</span><p>{active.note}</p></div><div className="medium-filter"><label>媒介 <select value={medium} onChange={e => setMedium(e.target.value)}><option value="all">全部</option><option value="3D">包含真实 3D</option><option value="2D">二维 / 声音</option></select></label><span role="status">{filtered.length} 件作品</span></div></div>
        <div className="work-grid">{filtered.map(w => <article className="work-card" key={w.id}><button className="work-image" onClick={() => open(w)} aria-label={`查看${w.title}`}><img src={asset(w.preview)} alt={`${w.title}实际画面`} loading="lazy" width="960" height="640" /><span className="work-number">{String(w.number).padStart(2, '0')}</span><span className="image-arrow" aria-hidden="true">↗</span></button><div className="work-meta"><span>{w.domain}</span><Chip size="sm">{w.dimension}</Chip></div><h3><button onClick={() => open(w)}>{w.title}</button></h3><p>{w.description}</p><div className="work-links"><button onClick={() => open(w)}>打开作品 ↗</button><a href={asset(w.entry)} download={`${w.id}.html`} aria-label={`下载${w.title} HTML`}>下载 HTML ↓</a></div></article>)}</div>
        {!filtered.length && <div className="empty-state"><h3>还没有找到这件作品。</h3><p>试试别的关键词，或者把这个想法做成新的作品。</p><Button onPress={() => {setQuery('');setMedium('all');setCollection('all');}}>重置筛选</Button><a href="#skill">开始我的创作 ↗</a></div>}
      </section>
      <section id="method" className="method-section"><div className="method-intro"><p className="eyebrow">FROM A THOUGHT TO A THING</p><h2>好作品，<br />从好问题开始。</h2><p>不必先学会描述所有细节。<br />告诉 AI 你想理解什么、完成什么、表达什么。<br />让具体的内容和操作，慢慢把想法显影。</p><a href={asset('prompts/full-meta-prompt.txt')} download className="text-link">阅读完整创作方法 ↗</a></div><div className="steps">{steps.map(([number,title,desc])=><div className="step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{desc}</p></div></div>)}</div></section>
      <section id="skill" className="skill-section"><div className="skill-intro"><p className="eyebrow">YOUR TURN / THE CREATIVE SKILL</p><h2>下一个作品，<br />写下你的起点。</h2><p>一句愿望、一张参考图、一个工作中的麻烦。<br />从你在意的事情开始，交付方式由你选择。</p><div className="skill-notes"><span>01 说出你的想法</span><span>02 复制完整创作指令</span><span>03 发给你使用的 AI</span></div><a className="text-link" href={asset('downloads/imagination-developer.zip')} download>下载并安装 Skill 目录 ↗</a></div><div className="starter-panel"><div className="starter-modes" role="group" aria-label="选择交付方式">{modes.map(m=><button key={m.id} aria-pressed={mode===m.id} onClick={()=>{setMode(m.id);setCopied('');}}>{m.label}</button>)}</div><label htmlFor="idea">你想做什么？</label><textarea id="idea" value={starter} onChange={e=>{setStarter(e.target.value);setCopied('');}} placeholder="即使还没想清楚，也可以从一句话开始。" /><div className="idea-suggestions">{ideas.map(([name,text])=><button key={name} onClick={()=>{setStarter(text);setCopied('');}}>{name} ↗</button>)}</div><Button className="copy-instruction" onPress={copyStarter} isDisabled={!starter.trim()}>复制完整创作指令 ↗</Button><p className="subtle" role="status">{copied || '会一起复制元提示词、交付要求和你的想法。内容只在你的浏览器中生成。'}</p><button className="preview-toggle" aria-expanded={preview} onClick={()=>setPreview(!preview)}>{preview?'收起完整指令':'先看看将复制的完整指令'} {preview?'−':'＋'}</button>{preview&&<textarea className="complete-instruction" ref={completeArea} value={fullInstruction} readOnly aria-label="完整创作指令" />}<details><summary>怎样在支持 Skills 的助手中安装？</summary><p>可以运行下面的命令，或让助手从 GitHub 仓库安装完整目录。</p><code>npx skills add hyyhf/imagination-atelier --skill imagination-developer</code><a href={asset('README.html')} target="_blank" rel="noopener noreferrer">查看安装与使用说明 ↗</a></details></div></section>
      <section id="download" className="downloads-section"><div className="section-heading"><div><p className="eyebrow">TAKE IT WITH YOU</p><h2>把喜欢的，<br />带到手边。</h2></div><p>独立作品、创作方法与完整 Skill。<br />下载后保留一份，随时打开、继续使用。</p></div><div className="download-grid">{[
        ['全部 30 件独立作品','三辑作品与使用说明，解压后打开 START.html。','atelier-all-30.zip','01'],
        ['科学实验室','从观测与条件出发，用十个实验理解关系。','atelier-science.zip','02'],
        ['实用工坊','空间、纸样、音频和生活中的具体任务。','atelier-practical.zip','03'],
        ['想象展览','光、几何、器物与叙事，十种表达探索。','atelier-explore.zip','04'],
        ['创作工具包','元提示词、完整 Skill 与双击可用的创作入口。','imagination-atelier-creative-kit.zip','05'],
        ['完整源码','网站、作品和创作资料，方便继续修改。','portfolio-source.zip','06'],
      ].map(([name,desc,file,num])=><a key={file} className="download-card" href={asset(`downloads/${file}`)} download><span>{num} / ZIP</span><h3>{name}</h3><p>{desc}</p><strong>下载 ↙</strong></a>)}</div></section>
    </main><footer className="site-footer"><a className="brand" href="#"><span className="brand-symbol">ia.</span><span>想象显影机<small>AN IDEA, MADE TANGIBLE.</small></span></a><p>在自己的浏览器里，打开新的可能。<br />原创内容 MIT · 第三方资源保留各自许可</p><div><a href={repo} target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href={asset('README.html')}>使用说明 ↗</a><a href={asset('START.html')}>离线目录 ↗</a></div></footer>
    <CaseViewer work={selected} close={close}/>
  </>;
}
