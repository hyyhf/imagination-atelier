import catalog from './catalog.json';
export type Work = typeof catalog[number];
export const works: Work[] = catalog;
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
export const repo = 'https://github.com/hyyhf/imagination-atelier';
export const collections = [
  { id: 'all', label: '全部作品', en: 'COMPLETE COLLECTION', note: '三十种题目，三十种打开想象的方式。' },
  { id: 'science', label: '科学实验室', en: 'VOLUME 03 / SCIENCE', note: '数学、物理、地理、计算机与大模型。把抽象概念放到手边。' },
  { id: 'practical', label: '实用工坊', en: 'VOLUME 02 / PRACTICE', note: '从布置小店到剪辑声音。输入自己的内容，带走真正的成果。' },
  { id: 'explore', label: '想象展览', en: 'VOLUME 01 / EXPLORATION', note: '光、器物、字与故事。探索一种想法应该拥有的形状。' },
];
export const steps = [
  ['01', '找到真正想做的事', '理解、决定、创造，或留住一种感受。从你希望得到什么开始。'],
  ['02', '让关系变得可感知', '尺寸如何影响空间，条件怎样改变结果。选合适的画面，让变化看得见。'],
  ['03', '把动作连成完整体验', '带入自己的内容，直接修改、判断与比较，最后得到可以继续使用的成果。'],
  ['04', '在真实使用中完善', '打开最终文件，走完实际任务，再打磨表现、操作与保存，让想法真正落地。'],
];
