# 想象显影机 · Imagination Atelier

**把说不清的想法，做成能完成自己任务的作品。**

想象显影机是一套面向 AI Agent 的快速作品元 Skill，调用名为 `imagination-developer`。从一句愿望、参考图片、现成资料或工作中的麻烦开始，让 AI 找到最费力的环节，设计更直接的操作方式，制作一个或少量可本地打开的 HTML 文件。

它不按行业套模板。机械零件、订单、文稿、音频、教学内容、游戏规则或一个还没有名字的想法，都可以成为起点。二维、三维、时间线和互动叙事由任务决定；完成当前任务后，还要考虑如何换一份材料、复用设置，快速完成下一件。

[体验作品](https://hyyhf.github.io/imagination-atelier/) · [安装](#安装) · [使用](#使用) · [下载创作工具包](https://hyyhf.github.io/imagination-atelier/downloads/imagination-atelier-creative-kit.zip) · [阅读 Skill](skills/imagination-developer/SKILL.md)

## 作品效果

下面是实际可操作的 HTML 作品。截图来自真实运行页面，点击「体验」即可带入自己的材料；每件附有独立制作提示词、使用说明和验证记录。

<table><tr>
<td width="50%"><a href="docs/screenshots/03-photo-batch.jpg"><img src="docs/screenshots/03-photo-batch.jpg" alt="照片多规格裁切实际操作画面" width="640"></a><br><strong>照片多规格裁切</strong><br>圈定主体，联动生成多种比例，逐图微调并成套导出；换下一批沿用规格。<br><a href="https://hyyhf.github.io/imagination-atelier/works/03-photo-batch/index.html">体验 ↗</a></td>
<td width="50%"><a href="docs/screenshots/05-drawer.jpg"><img src="docs/screenshots/05-drawer.jpg" alt="抽屉分隔板设计实际操作画面" width="640"></a><br><strong>抽屉分隔板设计</strong><br>调整净格与板厚，联动插接槽口和装配，检查物品适配，导出1:1切割图与板件清单。<br><a href="https://hyyhf.github.io/imagination-atelier/works/05-drawer/index.html">体验 ↗</a></td>
</tr><tr>
<td width="50%"><a href="docs/screenshots/01-assembly.jpg"><img src="docs/screenshots/01-assembly.jpg" alt="机械装配与爆炸图编辑器的实际三维零件和结构编辑画面" width="640"></a><br><strong>机械装配与爆炸图编辑器</strong><br>导入自己的零件，修改装配关系、爆炸向量、材质和拆装步骤，输出资料图、零件清单和说明。<br><a href="https://hyyhf.github.io/imagination-atelier/works/01-assembly/index.html">体验 ↗</a></td>
<td width="50%"><a href="docs/screenshots/10-product-studio.jpg"><img src="docs/screenshots/10-product-studio.jpg" alt="3D产品摄影与海报制作的实际模型布光取景界面" width="640"></a><br><strong>3D 产品摄影与海报制作</strong><br>导入商品模型、贴图与标识，调整材质、灯光和镜头，生成高分辨率照片、海报与多视角图片；换品保留摄影设置。<br><a href="https://hyyhf.github.io/imagination-atelier/works/10-product-studio/index.html">体验 ↗</a></td>
</tr><tr>
<td width="50%"><a href="docs/screenshots/02-production.jpg"><img src="docs/screenshots/02-production.jpg" alt="生产订单排程工具的实际订单甘特图与工序约束" width="640"></a><br><strong>生产订单排程工具</strong><br>导入订单与工艺路线，按设备、班次、停机和前置约束排程。手动调度、定位冲突、比较交期，导出派工明细。<br><a href="https://hyyhf.github.io/imagination-atelier/works/02-production/index.html">体验 ↗</a></td>
<td width="50%"><a href="docs/screenshots/08-csv-cleaner.jpg"><img src="docs/screenshots/08-csv-cleaner.jpg" alt="CSV表格批量清洗工具的实际规则和异常追踪" width="640"></a><br><strong>CSV 表格批量清洗工具</strong><br>合并本地表格，编排清洗与校验规则，更正异常并追踪原值，导出结果和问题清单；同一规则可处理下一批。<br><a href="https://hyyhf.github.io/imagination-atelier/works/08-csv-cleaner/index.html">体验 ↗</a></td>
</tr><tr>
<td width="50%"><a href="docs/screenshots/09-text-compare.jpg"><img src="docs/screenshots/09-text-compare.jpg" alt="文本差异对比与逐条审校的真实文稿对照和人工决定" width="640"></a><br><strong>文本差异对比与逐条审校</strong><br>对比两份文稿，逐条接受、保留或自定义改写，记录备注，生成确认合稿和报告；合稿可成为下一版原稿。<br><a href="https://hyyhf.github.io/imagination-atelier/works/09-text-compare/index.html">体验 ↗</a></td>
<td width="50%"><a href="docs/screenshots/12-packaging.jpg"><img src="docs/screenshots/12-packaging.jpg" alt="礼盒纸样设计与A4拼接打印的实际纸样及折叠预览" width="640"></a><br><strong>礼盒纸样设计与 A4 拼接打印</strong><br>输入礼物尺寸、编辑文字和印记，观察折起效果，用家用打印机输出 1:1 拼接纸样。<br><a href="https://hyyhf.github.io/imagination-atelier/works/12-packaging/index.html">体验 ↗</a></td>
</tr></table>

更多作品包括空间布置、板材排料、备餐计划、音频剪辑、数据标定、教学与科学实验，完整目录见[作品列表](docs/EXAMPLES.md)。这些案例是方法的实例；Skill 的适用范围不限于案例题目。

## 这个 Skill 增加了什么

AI 本来就能写界面、交互和导出功能。这套 Skill 把制作重心放在更难的决定上：怎样减少用户的重复劳动，怎样选对工作对象的表达方式，以及怎样让一次修改贯穿最终成果。

| 制作时的关键决定 | Skill 引导的做法 |
|---|---|
| 该做哪些功能 | 先还原用户当前最费力的一段工作，再设计能代替这段工作的操作机制 |
| 哪些应自动完成 | 自动处理共同规则与重复劳动，保留逐项修正和重要的人工判断 |
| 用什么表达对象 | 根据任务选择像素与变换、路径与尺寸、实体与连接、时间片段或约束记录 |
| 先把什么做好 | 先做出可用的关键成果，再完善围绕它的工作台；不以界面精修代替内容质量 |
| 怎样判断值得再用 | 用自己的材料完成任务，改变条件，再换下一批；检查实际结果与返工量 |

表达类作品也有自己的质量要求：内容、节奏、互动与输出应形成完整体验。Skill 不强迫每个题目都做成后台、套用同一界面或加入无关功能。

它是一套创作和判断方法，不是能力无限的生成引擎。效果仍取决于执行模型、素材和任务约束。维护时使用同一原始需求进行独立对照，保留直接制作做得更好的部分；[同题对比记录](docs/SKILL_EVALUATION.md)和[评估方法](skills/imagination-developer/references/skill-evaluation.md)说明怎样检查实际增益。

## 安装

在装有 Node.js 的终端中运行：

```bash
npx skills add hyyhf/imagination-atelier --skill imagination-developer
```

[Skills CLI](https://github.com/vercel-labs/skills) 可安装到支持的助手。需要在多个项目中使用时，在命令末尾加上 `--global`。

也可以让支持安装 Skills 的助手执行：

```text
请安装 imagination-developer Skill：
https://github.com/hyyhf/imagination-atelier
Skill 位于 skills/imagination-developer，请安装完整目录。
```

手动安装时，将整个 [skills/imagination-developer](https://github.com/hyyhf/imagination-atelier/tree/main/skills/imagination-developer) 文件夹复制到助手的技能目录，保留 `SKILL.md`、`references` 和 `agents`。

普通聊天也可以使用：复制[完整元提示词](prompts/full-meta-prompt.txt)，在末尾追加自己的需求，一起发送给 AI。或者下载[创作工具包](https://hyyhf.github.io/imagination-atelier/downloads/imagination-atelier-creative-kit.zip)，解压后打开 `START.html`，写下想法、选择交付方式，一次复制完整指令。包内包含元提示词和完整 Skill。

## 使用

点名使用 `imagination-developer`。说「做一个」「实现」「完善」时默认直接交付成品；明确要求制作提示词时，才只交付提示词。

### 直接做作品

```text
使用 imagination-developer。
我每周收到几个渠道的报名表，总要手动整理日期、去重、补齐字段。
做一个本地打开的工具，让我自己设规则，看到有问题的记录并修改，
导出处理好的表格，下周换一批文件还能用同一套规则。
交付完整 HTML 和简短使用说明。
```

### 想法还不清楚

```text
使用 imagination-developer。
我想把奶奶的故事、照片和声音留给家人，但不想只做一个相册。
先提出三个体验不同的方向，说明家人会做什么、看到什么，
以及我还需要提供哪些材料。
```

### 只需要制作提示词

```text
使用 imagination-developer。
我想输入展厅和展品尺寸，尝试摆放，检查遮挡与通道，
最后带走布置图和物品清单。
请写成可以交给另一个 AI 独立执行的完整制作提示词。
```

图片、模型、表格、文案和参考项目都可以一并提供。已有作品也可以继续改进，例如「让模型调整与导出图片一致」「新增批次时保留规则」「让异常能定位到原始记录」。

默认交付一个或少量 HTML 文件，按需要附 CSS、JavaScript 或本地素材。使用成品无需进入工程、安装依赖或启动开发环境；可根据任务输出图片、纸样、文稿、表格、音频和可恢复方案。具体输入格式、运行条件与验证范围见各作品说明。

## 许可

原创代码、Skill 与文档采用 [MIT License](LICENSE)。第三方库与素材保留各自许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
