import catalog from './catalog.json';
export type Work = typeof catalog[number];
export const works: Work[] = catalog;
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
export const repo = 'https://github.com/hyyhf/imagination-atelier';
export const collections = [
  { id: 'all', label: '全部作品', en: 'COMPLETE COLLECTION', note: '从实际用途开始选择，带入自己的模型、订单、表格、文稿或素材。' },
  { id: 'science', label: '科学实验室', en: 'VOLUME 03 / SCIENCE', note: '数学、物理、地理、计算机与大模型。把抽象概念放到手边。' },
  { id: 'practical', label: '工作与生活', en: 'VOLUME 02 / PRACTICE', note: '排程、表格、文字、养护与音频。换自己的材料，继续处理下一项。' },
  { id: 'explore', label: '设计与工程', en: 'VOLUME 01 / DESIGN', note: '零件、产品、空间与实体尺寸。编辑结构和材质，生成自己的设计成果。' },
];
export const steps = [
  ['01', '找到最费力的那一步', '从你的材料与目标出发，找出反复操作、难以判断或需要来回搬运的工作。'],
  ['02', '设计更直接的做法', '共同规格只改一次，关键细节直接调整，让一个决定贯穿预览和最终成果。'],
  ['03', '先把关键结果做对', '先验证照片、零件、计划或体验本身，再围绕它完成工作台。'],
  ['04', '换一份材料继续做', '带走能用的结果，保留有用的规则和设置，用下一项真实任务检验完成度。'],
];
