/* Imagination Atelier v4 — case-specific comparison, portable experiments.
 * Pure model adapter: no network, no DOM, no executable content from imports.
 * MIT, hyyhf and contributors. */
(function(root){'use strict';
const ID=__CASE_ID__, M=root.AppModel||root.SceneApp||root.Artwork;
const clone=x=>JSON.parse(JSON.stringify(x));
const row=(label,value,unit='',note='')=>({label,value:Number.isFinite(value)?value:typeof value==='number'?String(value):value,unit,note});
const round=(v,n=3)=>Number.isFinite(v)?+v.toFixed(n):v;
const range=(v,a,b)=>Math.max(a,Math.min(b,v));
function validate(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('记录需要一个完整的作品状态');
 let p=clone(raw),i=ID;
 // Early editorial pieces need explicit structure checks, not blind Object.assign.
 if(i===1){if(!['square','slot','circle'].includes(p.shape)||!['size','offset','altitude'].every(k=>Number.isFinite(p[k])))throw Error('天窗记录无效');p=M.normalize(p);}
 else if(i===2)p=M.restore(M.snapshot(p));
 else if(i===3){if(!['depth','azimuth','fold','yaw','pitch','zoom'].every(k=>Number.isFinite(p[k])))throw Error('剖切参数无效');p=M.normalizeState(p);}
 else if(i===4)p=M.unpack(M.pack(p));
 else if(i===5)p=M.validateState(p);
 else if(i===6)p=M.validate(p);
 else if(i===7){p={plan:M.validate(p.plan),t:range(Number(p.t)||0,0,180)};}
 else if(i===8)p=M.validateState(p);
 else if(i===9){const init=M.initialState();if(!Array.isArray(p.choices)||p.choices.length!==4||p.choices.some(x=>x!==null&&!['A','B'].includes(x))||!Array.isArray(p.visited)||p.visited.some(x=>!M.evidence.some(e=>e.id===x)))throw Error('地图记录损坏');p={...init,mode:['inspect','trace','result'].includes(p.mode)?p.mode:'inspect',choices:p.choices,visited:[...new Set(p.visited)],activeGap:range(Math.floor(p.activeGap||0),0,3),selectedEvidence:M.evidence.some(e=>e.id===p.selectedEvidence)?p.selectedEvidence:null,lens:{enabled:!!p.lens?.enabled,x:range(Number(p.lens?.x)||349,35,1285),y:range(Number(p.lens?.y)||340,33,845)}};if(p.mode==='result'&&M.evaluate(p.choices))p=M.archive(p);else if(p.mode==='result')p.mode='trace';}
 else if(i===10){let b=M.initialState();if(!['x','z','yaw','pitch','maxS','clock','travel'].every(k=>Number.isFinite(p[k]))||!M.walkable(p.x,p.z))throw Error('探索存档的位置无效');p={...b,...p,seen:{...p.seen},guide:null,guideKind:null,flip:null};p.pitch=range(p.pitch,-1.2,1.2);if(JSON.stringify(p).length>12000)throw Error('探索记录过大');}
 else if(i===11||i===12||i===13){const v=M.validate(p);if(!v.ok)throw Error(v.errors.join('；'));if(i===11&&p.appearance){if(!['oak','ink','birch'].includes(p.appearance.finish)||!['day','studio','soft'].includes(p.appearance.lighting))throw Error('材料或光线方案无效');p.appearance={finish:p.appearance.finish,lighting:p.appearance.lighting,cut:!!p.appearance.cut,decor:p.appearance.decor!==false};}}
 else if(i===20){M.validate(p.state);if(p.format!=='atelier-audio-project'||p.version!==1||!Array.isArray(p.media)||p.media.length!==p.state.sources.length)throw Error('音频记录缺少原始媒体');for(const m of p.state.sources){const a=p.media.filter(x=>x.id===m.id);if(a.length!==1)throw Error('媒体索引无效');if(m.kind==='pcm'&&(!Array.isArray(a[0].data)||a[0].data.length!==m.channels||a[0].data.some(x=>typeof x!=='string'||x.length!==Math.ceil(m.frames*4/3)*4)))throw Error('媒体采样长度无效');}}
 else {let v=M.validate(p);if(v&&typeof v==='object'&&('format'in v||'kind'in v||'schema'in v))p=v;}
 return p;
}
function metrics(p){let d;const i=ID;
 if(i===1){d=M.describe(p);return [row('天窗开口',round(d.area,2),'m²'),row('太阳高度',p.altitude,'°'),row('横向偏移',round(p.offset,2),'m'),row('光斑中心 X',round(d.projectedCenter[0],2),'m','沿用原几何光线模型')];}
 if(i===2){d=M.derive(p);return[row('左轮',round(d.rpmL,2),'rpm'),row('右轮',round(d.rpmR,2),'rpm'),row('输入转速',p.rpm,'rpm'),row('平均约束残差',round((d.rpmL+d.rpmR)/2-d.rpmC,9),'rpm','理想运动学；不是受力分析')];}
 if(i===3){d=M.getModel(p).summary;return[row('切入比例',round(p.depth*100,1),'%'),row('剖面暴露岩层',d.exposedLayers,'层'),row('剖面宽度',round(d.span,2),'模型单位'),row('褶皱幅度',p.fold,'','合成连续地层，不是勘探数据')];}
 if(i===4){d=M.measures(p);return[row('瓶口 / 腹部',d.ratio,'%'),row('高度 / 腹宽',d.squat,'%'),row('壁厚',p.wall,'模型单位'),row('材质',M.clayNames[p.clay],'')];}
 if(i===5){d=M.neighborhood(p.focusId);return[row('实际第一近邻',d.count,'个'),row('片段外续接位置',d.missing.length,'个'),row('上 / 同 / 下层',`${d.layers.up} / ${d.layers.middle} / ${d.layers.down}`),row('中心位置',p.focusId,'a/2','有限 FCC 片段；空圈不算实际原子')];}
 if(i===6){d=M.trace(p);return[row('反射次数',d.hits.length,'次'),row('抵达靶面',d.hitTarget?'是':'否'),row('路径终止',d.reason),row('实际光程',round(d.segments.reduce((a,x)=>a+Math.hypot(...x.a.map((v,k)=>v-x.b[k])),0),3),'模型单位','有限镜面、实际相交判定')];}
 if(i===7){d=M.metrics(M.simulate(p.plan,180));return[row('车辆平均延误',round(d.carDelay,2),'s','固定180秒，相同种子；含尚在等候者'),row('行人平均等候',round(d.pedDelay,2),'s'),row('车辆完成 / 剩余',`${d.carDone} / ${d.carRemaining}`),row('行人完成 / 剩余',`${d.pedDone} / ${d.pedRemaining}`)];}
 if(i===8)return[row('文字长度',Array.from(p.text).length,'码点'),row('风场能量',round(M.energy(p),3),'相对量'),row('版式',Number(p.preset)+1),row('随机种子',p.seed,'','相同文字、风场和种子可复现')];
 if(i===9)return[row('已勘读线索',p.visited.length,'/ 8'),row('已选择缺口',p.choices.filter(Boolean).length,'/ 4'),row('路线假设',p.choices.map(x=>x||'—').join(' · ')),row('归档状态',p.result?`${p.result.supported} / 4 得到支持`:'尚未归档','', '选择不等于证据支持；保存不揭示答案')];
 if(i===10){d=M.describe(p);return[row('所在章节',d.chapter),row('实际行走',round(p.travel,1),'m · 场景标尺'),row('已见位置',Object.values(p.seen).filter(Boolean).length,'处'),row('池边秘密',p.opened?'已发现':'尚未打开','', '书签保留当前探索；不把复位当作结局')];}
 if(i===11){d=M.derive(p);return[row('采购合计',round(d.cost,2),'元'),row('占地比',round(d.footprint/d.area*100,1),'%','矩形占地相加，不是可通行性证明'),row('位置冲突',d.hard,'处'),row('间距待复核',d.warnings.filter(x=>x.kind==='gap').length,'处')];}
 if(i===12){d=M.derive(p);return[row('纸样需要',`${round(d.required.w,1)} × ${round(d.required.h,1)}`,'mm · 含边距'),row('选定纸张可容纳',d.fit||d.rotatedFit?'可以':'不可以'),row('用纸面积比例',round(d.paperUse,2),'%'),row('净内部体积',round(d.volume,3),'L')];}
 if(i===13){d=M.derive(p);return[row('板材总成本',round(d.cost,2),'元'),row('整板数量',d.sheets.length,'张'),row('材料利用率',round(d.use,2),'%'),row('未排入板件',d.unplaced.length,'件','启发式排样，不承诺全局最优')];}
 if(i===14){d=M.derive(p);return[row('填土净量',round(d.totalLiters,1),'L','几何净量，不估算湿土承重'),row('按株距位置',d.totalPlants,'株'),row('箱体占地',round(d.occupied,2),'m²'),row('位置待复核',d.issues.length,'处')];}
 if(i===15){d=M.derive(p);return[row('开始备餐',M.clock(d.schedule.start)),row('时间跨度',d.schedule.span,'min'),row('采购缺口',d.shopping.filter(x=>x.buy>0).length,'种','沿用相同菜谱与库存，不能假设增加人数不增加操作时长'),row('启用菜谱',d.active,'道')];}
 if(i===16){d=M.derive(p);return[row('环节总时长',d.total,'min'),row('相对预算',d.delta,'min'),row('到场学生',d.present,'人'),row('分组数量',d.groups.length,'组')];}
 if(i===17){d=M.derive(p);return[row('总镜头时长',d.duration,'s'),row('水平视角',round(d.hFov,1),'°'),row('当前焦距',M.shot(p).lens,'mm'),row('相机至目标',round(d.distance,2),'m')];}
 if(i===18){d=M.derive(p);return[row('原始来源',d.sources,'篇'),row('证据卡',d.cards,'张'),row('尚未归类',d.unassigned,'张'),row('引用需复核',d.unmatched,'张','逐字匹配不等于研究结论成立')];}
 if(i===19){d=M.derive(p);return[row('计划总重量',round(d.allWeight,2),'kg · 含空箱'),row('已安排',`${d.placed} / ${d.total}`,'件'),row('越界 / 重叠',`${d.outside.length} / ${d.overlaps.length}`),row('位置与重量检查',d.ready?'通过':'有待处理','', '矩形包围盒模型；实际装入后仍须检查')];}
 if(i===20){d=M.derive(p.state);return[row('混音长度',round(d.duration,3),'s'),row('有效片段',d.active,'段'),row('主增益',p.state.masterDb,'dB'),row('源采样已随记录',p.media.length,'份','恢复时同时恢复媒体；不自动上传')];}
 if(i===21){d=M.derive(p);if(!d.ok)return[row('拟合状态','不可识别'),row('原因',d.error||d.message||'当前数据不足')];return[row('训练 RMSE',round(d.rmse,5),p.yUnit),row('留出 RMSE',d.validationRMSE==null?'无留出点':round(d.validationRMSE,5),p.yUnit),row('查询估计',round(d.query.y,5),p.yUnit),row('训练 / 留出',`${d.n} / ${d.validation}`,'点','同一数据不增加证据独立性')];}
 if(i===22){d=M.derive(p);return d.runs.map(r=>{const end=r.points[r.points.length-1];return row(r.id+' 最终目标',round(end.f,7),'',`${r.points.length-1}步；${r.reason}`)});}
 if(i===23){d=M.derive(p);return[row('总速度增量',round(d.dv,5),'km/s'),row('转移飞行时间',round(d.time/3600,4),'h'),row('当前轨道高度',round(d.altitude,2),'km'),row('求解残差',d.keplerResidual,'rad','理想二体霍曼转移；不包含摄动或变轨面机动')];}
 if(i===24){d=M.derive(p);return[row('探测节点',p.probe),row('当前电压',round(d.current?.volt[p.probe],6),'V'),row('节点电流残差',d.current?.kcl??d.dc?.kcl??'无解','A'),row('离散时间步长',p.dt,'s','后向欧拉，减小步长检查数值收敛')];}
 if(i===25){d=M.derive(p);return[row('选定汇水面积',round(d.selectedArea,1),'m²'),row('估算径流体积',round(d.selectedVolume,2),'m³'),row('填洼体积',round(d.fillVolume,2),'m³'),row('上游格网',d.count,'格','合成 / 用户DEM；不是水动力洪水预测')];}
 if(i===26){d=M.derive(p);return[row('球面路线距离',round(d.total,3),'km'),row('纬向尺度',round(d.scales.east,4),'倍'),row('经向尺度',round(d.scales.north,4),'倍'),row('面积尺度',round(d.scales.area,4),'倍','地图投影不改变球面计算距离')];}
 if(i===27){d=M.simulate(p);const x=d.metrics||M.metrics(d,d.end);return[row('交付 / 发送',`${x.delivered} / ${x.sent}`,'包'),row('丢包率',round(x.loss*100,2),'%'),row('平均完成时延',round(x.mean,3),'ms'),row('P95 完成时延',round(x.p95,3),'ms','只对交付包统计时延；另列丢包率')];}
 if(i===28){d=M.derive(p);return[row('实际 PX8 大小',d.binary.length,'bytes'),row('相对原始 RGB',round(d.binary.length/(d.width*d.height*3)*100,2),'%'),row('重建 PSNR',d.metrics?round(d.metrics.psnr,3):'无原图','dB'),row('非零系数',d.nonzero,'项','实际编码与解码，不用质量参数冒充误差')];}
 if(i===29){const v=M.view(p);return[row('训练步数',p.step,'步'),row('最可能的下一个字',v.rank[0]?.char||'—'),row('最高概率',round((v.rank[0]?.p||0)*100,3),'%'),row('观察分布熵',round(v.entropy,5),'bits','相同权重与上下文，观察消融如何改变分布；不是生成结果')];}
 if(i===30){d=M.derive(p);return[row('平均 Recall@k',round(d.evaluation.mean.recall,4)),row('平均 nDCG@k',round(d.evaluation.mean.ndcg,4)),row('可评测问题',`${d.evaluation.eligible} / ${d.evaluation.total}`),row('提示词长度',d.prompt.characters,'码点','词法检索；相关性判断范围决定指标含义')];}
 return [];
}
function variants(raw){const p=clone(raw),i=ID;const make=(name,why,fn)=>{let n=clone(p);const r=fn(n);return {name,why,payload:validate(r||n)}};
 let out=[];
 const add=(...x)=>{try{out.push(make(...x))}catch(e){out.push({name:x[0],why:x[1],error:e.message})}};
 if(i===1){add('低角度光','同一天窗，太阳高度改为 25°。',n=>{n.altitude=25});add('高角度光','同一天窗，太阳高度改为 72°。',n=>{n.altitude=72});add('改为圆窗','保留尺度和光线，检查开口形状的差异。',n=>{n.shape='circle'});}
 if(i===2){for(const [t,l]of [[0,'直行'],[.45,'左转'],[-.45,'右转']])add(l,'保持输入转速，转向改为 '+Math.round(t*100)+'%。',n=>{n.turn=t;n.playing=false});}
 if(i===3){add('切到中央','同一地层、同一方向，切入一半。',n=>{n.depth=.5});add('旋转剖面','保留切入深度，方位增加 45°。',n=>{n.azimuth=range(n.azimuth+45,-70,70);n.depth=Math.max(.35,n.depth)});add('不褶皱的对照','保持切面，只将褶皱幅度归零。',n=>{n.fold=0;n.depth=Math.max(.5,n.depth)});}
 if(i===4){add('收住瓶口','只推瓶口附近，保留腹部与足部。',n=>M.sculpt(n,1,-.15,.22));add('打开肩部','在肩部局部放开，不重新起坯。',n=>M.sculpt(n,.78,.12,.24));add('换米釉看轮廓','几何完全不变，只比较表面材质。',n=>{n.clay='cream'});}
 if(i===5){add('只看第一近邻','不换中心，只去掉更远的点阵。',n=>{n.mode='shell';n.layer='all'});add('从内部看','不换中心，视点移到该原子。',n=>{n.mode='inside';n.insideZoom=1});add('边界原子','比较有限片段的表面站位；不是另一种晶格。',n=>{n.focusId=M.stations.face||Object.values(M.stations)[1];n.mode='shell';n.layer='all'});}
 if(i===6){add('理想对准','按本台三个镜心与靶心求解；这是解答参考。',n=>{n.mirrors=clone(M.solution());n.blocker=false});add('末镜偏差 0.6°','先理想对准，再只偏转最后一面镜子。',n=>{n.mirrors=clone(M.solution());n.mirrors[2].yaw+=.6;n.blocker=false});add('插入挡板','保持你的角度，检查真正的遮挡。',n=>{n.blocker=true});}
 if(i===7){for(const [ns,ped,l]of [[23,10,'均衡配时'],[29,10,'增加南北'],[19,16,'增加行人']])add(l,'同一180秒窗口、需求与随机种子。',n=>{n.plan.ns=ns;n.plan.ped=ped;n.t=180});}
 if(i===8){add('无风对照','文字、版式、种子不变，仅移除扰动。',n=>M.calm(n));add('逆风','只反转风向，观察相同文字的反应。',n=>{n.wind.dx*=-1;n.wind.dy*=-1});add('更轻的风','强度减半，保留中心与方向。',n=>{n.wind.dx*=.5;n.wind.dy*=.5});}
 if(i===9||i===10) return [];
 if(i===11){add('木色 · 日间','尺寸、位置和采购不变，只更换空间表面。',n=>{n.appearance={finish:'oak',lighting:'day'}});add('深色 · 展陈','同一布置，深色金属与暖白墙面。',n=>{n.appearance={finish:'ink',lighting:'studio'}});add('桦木 · 柔光','同一布置，浅木色与低对比度照明。',n=>{n.appearance={finish:'birch',lighting:'soft'}});}
 if(i===12){add('只看纸样','你的尺寸、颜色和文字不变，完全展开。',n=>{n.fold=0;n.open=0});add('合盖状态','按实际几何闭合，不改变礼物尺寸。',n=>{n.fold=100;n.open=0});add('更厚的纸','纸厚增加 0.2 mm，检查插舌与纸张余量。',n=>{n.thickness=range(n.thickness+.2,.1,3)});}
 if(i===13){add('按木纹排样','保持柜体，约束纹理方向并重新排。',n=>{n.stock.grain=true});add('允许旋转排样','仍为同一柜体，放开木纹约束作对照。',n=>{n.stock.grain=false});add('减少一层','只减少一层活动层板，重算板件与成本。',n=>{n.cabinet.shelves=Math.max(0,n.cabinet.shelves-1)});}
 if(i===14){add('株距加 20%','箱体与填土不变，比较稀植的几何位置数。',n=>{n.boxes.forEach(b=>b.spacing=range(Math.round(b.spacing*1.2),5,150))});add('填土减 5 cm','不改株距，仅计算更浅填土的净量；不是种植建议。',n=>{n.boxes.forEach(b=>b.soil=Math.max(3,b.soil-5))});add('株距减 15%','只作几何容量对照，不据此推断产量。',n=>{n.boxes.forEach(b=>b.spacing=range(Math.round(b.spacing*.85),5,150))});}
 if(i===15){add('增加一位帮手','同菜谱与设备，只增加人手资源容量。',n=>{const r=n.resources.find(x=>x.id==='hands');if(!r)throw Error('你的资源中没有 hands；请手动调整相应人手');r.capacity=Math.min(12,r.capacity+1)});add('晚 30 分钟上桌','相同工作量，整体上桌时刻后移。',n=>{let[h,m]=n.serve.split(':').map(Number),t=Math.min(1439,h*60+m+30);n.serve=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')});add('多两位客人','食材按人数换算，步骤时间维持你填写的值。',n=>{n.guests=Math.min(100,n.guests+2)});}
 if(i===16){add('多 5 分钟讨论','只给最后一个环节增加5分钟，显示预算差额。',n=>{if(!n.activities.length)throw Error('先添加环节');n.activities[n.activities.length-1].minutes+=5});add('四人小组','保持名单、缺席与随机种子，只比较每组目标人数。',n=>{n.grouping.mode='size';n.grouping.value=4});add('六人小组','相同名单，六人一组，保留人数不整除的分配。',n=>{n.grouping.mode='size';n.grouping.value=6});}
 if(i===17){for(const lens of [24,50,85])add(lens+' mm','锁定机位与目标，只改变当前镜头焦距。',n=>{const q=M.shot(n);q.lens=lens});}
 if(i===18) return [];
 if(i===19){add('重新自动排布','同一箱体和物品，使用原有启发式重新安排。',n=>M.autoPack(n));add('箱深增加 3 cm','对照更深的箱体，重新排布；重量上限不变。',n=>{n.case.depth=Math.min(200,n.case.depth+3);return M.autoPack(n)});add('轻量方案','仅将每种衣物数量减一（至少保留一件），重新排布。',n=>{n.entries.forEach(e=>{if(e.type==='clothes')e.qty=Math.max(1,e.qty-1)});return M.autoPack(n)});}
 if(i===20){add('主音量减 3 dB','源采样与剪辑点不变，整体降低增益。',n=>{n.state.masterDb=Math.max(-36,n.state.masterDb-3)});add('背景轨更轻','只对第二轨片段减6dB，不修改源采样。',n=>{n.state.clips.forEach(c=>{if(c.track===1)c.gainDb=Math.max(-36,c.gainDb-6)})});add('结尾缓缓落下','每段尾部淡出至少1秒且不超过有效片长。',n=>{n.state.clips.forEach(c=>{c.fadeOut=Math.min(c.out-c.in,Math.max(c.fadeOut,1))})});}
 if(i===21){add('直线','同一数据、权重、留出划分，只比较模型。',n=>{n.model='linear'});add('二次曲线','训练拟合可能更好，应同时检查留出误差。',n=>{n.model='quadratic'});add('指数模型','仅对可识别、满足正值条件的数据尝试。',n=>{n.model='exponential'});}
 if(i===22){add('学习率减半','目标函数、起点、步数不变。',n=>{n.methods.forEach(m=>m.rate=Math.max(.00001,m.rate*.5))});add('学习率倍增','观察可能的发散；不隐藏停止原因。',n=>{n.methods.forEach(m=>m.rate=Math.min(2,m.rate*2))});add('迭代预算倍增','保持算法参数，最多2000步。',n=>{n.steps=Math.min(2000,n.steps*2)});}
 if(i===23){add('目标高度减少 20%','保持中心天体与出发圆轨道。',n=>{n.h2=Math.max(1,n.h2*.8)});add('目标高度增加 20%','比较理想转移的时间与速度代价。',n=>{n.h2=Math.min(10000000,n.h2*1.2)});add('转移到中点','所有轨道参数不变，只取飞行时间中点。',n=>{n.progress=.5});}
 if(i===24){add('时间步长减半','同一电路，检查数值离散对结果的影响。',n=>{n.dt=Math.max(.000001,n.dt/2)});add('电容翻倍','只改变所有电容的容量，输入单位仍为 µF。',n=>{n.parts.forEach(x=>{if(x.type==='C')x.value*=2})});add('电阻翻倍','只改变电阻，其余拓扑与源保持不变。',n=>{n.parts.forEach(x=>{if(x.type==='R')x.value*=2})});}
 if(i===25){add('雨量减半','同一DEM、出水口与径流系数。',n=>{n.rain*=.5});add('雨量翻倍','估算体积按同一简化规则改变；非洪峰预测。',n=>{n.rain=Math.min(1000,n.rain*2)});add('地形夸张关闭','地形数据和计算完全不变，只还原竖向显示比例。',n=>{n.exaggeration=1});}
 if(i===26){for(const[k,l]of [['equalArea','等积圆柱'],['mercator','墨卡托'],['equirect','等距圆柱']])add(l,'球面路线与航点不变，只比较投影。',n=>{n.projection=k});}
 if(i===27){add('瓶颈带宽翻倍','找到启用链路中最小带宽，仅将它们翻倍。',n=>{const a=n.links.filter(x=>x.enabled),m=Math.min(...a.map(x=>x.mbps));a.filter(x=>x.mbps===m).forEach(x=>x.mbps*=2)});add('队列容量翻倍','带宽与传播时延不变；比较丢包和尾部时延。',n=>{n.links.forEach(x=>x.buffer=Math.min(1000,x.buffer*2))});add('发包间隔翻倍','同样包数和大小，减少瞬时到达压力。',n=>{n.flows.forEach(x=>x.interval=Math.min(10000,x.interval*2))});}
 if(i===28){add('细节优先','同一工作像素，质量85、保留64项。',n=>{if(n.source.kind==='px8')throw Error('请先将解码结果设为工作原图');n.params.quality=85;n.params.keep=64});add('平衡试验','质量55、保留28项；测实际文件与像素误差。',n=>{if(n.source.kind==='px8')throw Error('请先将解码结果设为工作原图');n.params.quality=55;n.params.keep=28});add('更小的码流','质量25、保留12项；比较有多少细节丢失。',n=>{if(n.source.kind==='px8')throw Error('请先将解码结果设为工作原图');n.params.quality=25;n.params.keep=12});}
 if(i===29){add('观察移除位置编码','仅改变可视化观察条件，不重新训练权重。',n=>{n.settings.position=false});add('观察消融头 0','同一权重，禁用第一注意力头的观察路径。',n=>{n.settings.ablate=0});add('观察消融头 1','同一权重，禁用第二注意力头的观察路径。',n=>{n.settings.ablate=1});}
 if(i===30){add('BM25','同一资料与判断，切换词法排序方法。',n=>{n.params.method='bm25'});add('TF-IDF','同一分块，比较余弦得分的排序。',n=>{n.params.method='tfidf'});add('更多检索证据','只把 k 增加2，保留提示词字符预算。',n=>{n.params.k=Math.min(20,n.params.k+2)});}
 return out;
}
function diff(a,b){const out=[];function go(a,b,path,depth){if(out.length>=32)return;if(JSON.stringify(a)===JSON.stringify(b))return;if(depth>4||typeof a!==typeof b||a==null||b==null||typeof a!=='object'){out.push({path,from:brief(a),to:brief(b)});return;}if(Array.isArray(a)||Array.isArray(b)){if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length){out.push({path,from:brief(a),to:brief(b)});return;}if(a.length>80){out.push({path,from:`${a.length}项`,to:`${b.length}项 · 内容已改变`});return;}}for(const k of new Set([...Object.keys(a),...Object.keys(b)]))go(a[k],b[k],path?path+'.'+k:k,depth+1)}go(a,b,'',0);return out;}
function brief(x){if(x===undefined)return'—';if(x===null)return'空';if(Array.isArray(x))return x.length+'项';if(x&&typeof x==='object')return Object.keys(x).length+'字段';return String(x).slice(0,120);}
root.AtelierLab={id:ID,version:4,clone,validate,metrics,variants,diff};
})(globalThis);
