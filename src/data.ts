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
  ['01', '找到真正的愿望', '一句话、一张图、一个还说不清楚的念头，都可以成为起点。'],
  ['02', '让形式服务内容', '该是空间，就认真做三维；该是文字，就让阅读成立。不预设一个万能面板。'],
  ['03', '做完一段真实任务', '输入、改变、反馈、结果。既给你能动手的默认方案，也接受你自己的内容。'],
  ['04', '看见问题，再显影', '核对画面、规则、文件和恢复。让改进有证据，让下一次创作有积累。'],
];
