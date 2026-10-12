const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const project = path.resolve(__dirname, '../..'), root = path.join(project, '.artifacts/model-regression/11-popup');
fs.mkdirSync(root, {recursive:true});
const html = fs.readFileSync(path.join(project, 'public/works/11-popup/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(a => a[1]);
const reports = [], test = (name, fn) => { fn(); reports.push({ name, pass: true }); };
for (let i = 0; i < scripts.length; i++) new vm.Script(scripts[i], { filename: 'inline-' + i + '.js' });
const pure = vm.createContext({ console });
for (const source of scripts.filter(source => /globalThis\.(?:AppModel|OpeningPlanner)\s*=/.test(source))) vm.runInContext(source, pure);
const M = pure.AppModel, P = pure.OpeningPlanner, state = M.initialState(), plain = x => JSON.parse(JSON.stringify(x));
test('Every inline script parses and the final HTML has no external script, style or font dependency', () => {
  assert(!/<script[^>]+src=|<link[^>]+(?:href|rel)=/i.test(html));
  assert(!/\bfetch\s*\(|\bimport\s*\(/.test(scripts.join('\n')));
  const fonts = [...html.matchAll(/url\(([^)]+)\)/g)].map(x => x[1]); assert(fonts.every(x => x.startsWith('data:')));
});
test('Default old layout has zero hard footprint conflicts but three unreachable service points', () => {
  assert.equal(M.derive(state).hard, 0); assert.equal(P.route(state).reachable, 4); assert.equal(P.route(state).total, 7);
});
test('Tidy preserves every object, price, dimension and name, and makes all seven points reachable', () => {
  const result = P.tidy(state); assert.equal(result.failed.length, 0); assert.equal(M.derive(result.state).hard, 0); assert.equal(result.routes.reachable, 7);
  for (const a of state.items) { const b = result.state.items.find(b => a.id === b.id); for (const k of ['type', 'w', 'd', 'h', 'price', 'name']) assert.equal(a[k], b[k]); }
  assert.deepEqual(plain(state), plain(M.initialState()));
});
test('Independent route geometry: every path segment clears all expanded rectangles and remains within the room', () => {
  const result = P.tidy(state), s = result.state, radius = s.clearance / 2;
  // Independent bounds, without calling AppModel.bbox or the planner's blocked nodes.
  const boxes = s.items.map(a => { const swap = a.angle === 90 || a.angle === 270, w = swap ? a.d : a.w, d = swap ? a.w : a.d; return [a.x - w / 2 - radius, a.y - d / 2 - radius, a.x + w / 2 + radius, a.y + d / 2 + radius]; });
  for (const target of result.routes.results) {
    assert(target.path.length > 0); let length = 0;
    target.path.forEach((a, i) => {
      assert(a.x >= radius && a.x <= s.room.w - radius); assert(a.y >= radius && a.y <= s.room.d);
      if (!i) { assert(a.x >= s.room.doorX - s.room.door / 2 + radius && a.x <= s.room.doorX + s.room.door / 2 - radius); return; }
      const b = target.path[i - 1]; assert(a.x === b.x || a.y === b.y); length += Math.hypot(a.x - b.x, a.y - b.y);
      for (let n = 0; n <= 10; n++) { const x = a.x + (b.x - a.x) * n / 10, y = a.y + (b.y - a.y) * n / 10; assert(!boxes.some(q => x > q[0] && y > q[1] && x < q[2] && y < q[3])); }
    });
    assert(Math.abs(target.distance - length / 1000) <= .005);
  }
});
test('Known path is 4.00 m, a full-width barrier blocks it, and removing the barrier restores it', () => {
  const s = M.initialState(); s.room = { w: 6000, d: 5000, h: 2800, door: 1500, doorX: 3000 }; s.items = [{ ...s.items[0], x: 3000, y: 300 }]; s.selected = 'P01';
  assert.equal(P.route(s).results[0].distance, 4);
  s.items.push({ ...M.add({ ...s, items: [] }, 'table').items[0], id: 'P20', w: 6000, d: 500, x: 3000, y: 3000 });
  assert.equal(P.route(s).results[0].reachable, false); s.items.pop(); assert.equal(P.route(s).results[0].reachable, true);
});
test('An entrance narrower than requested clearance is rejected by the route, and zero furniture remains a legal empty plan', () => {
  const n = M.copy(state); n.room.door = 500; assert.equal(P.route(n).entryOpen, false); assert.equal(P.route(n).reachable, 0);
  n.items = []; n.selected = null; assert(M.validate(n).ok); assert.equal(P.route(n).total, 0); assert.equal(P.cost(n).furniture, 0);
});
test('A 4200 × 3600 mm own-room starter has six reachable points and no footprint conflicts', () => {
  const n = M.copy(state); n.room = { w: 4200, d: 3600, h: 2800, door: 1000, doorX: 2100 }; const result = P.preset(n, 'lifestyle');
  assert.equal(result.failed.length, 0); assert.equal(result.routes.reachable, 6); assert.equal(result.routes.total, 6); assert.equal(M.derive(result.state).hard, 0);
});
test('All three starter types fit the default room and preserve the room rather than substituting a demo', () => {
  for (const mode of ['lifestyle', 'fashion', 'gallery']) { const result = P.preset(state, mode); assert.equal(result.failed.length, 0); assert.equal(result.routes.reachable, result.routes.total); assert.deepEqual(plain(result.state.room), plain(state.room)); }
});
test('Opening cost independently reconciles 5520 + 350 + 10%, and budget zero remains zero', () => {
  const c = P.cost(state); assert.equal(c.furniture, 5520); assert.equal(c.total, 6457); assert.equal(c.remaining, 3543);
  const n = M.copy(state); n.planning = { ...n.planning, budget: 0, delivery: 0, venue: 0, reserve: 0 }; assert.equal(P.cost(n).total, 5520); assert.equal(P.cost(n).remaining, -5520);
});
test('Save/read preserves extended budgets and notes, and old v1 plans still open', () => {
  const n = P.tidy(state).state; n.planning.brief = '现场保留一张桌子\n入口先走一遍'; n.planning.venue = 1750; const restored = M.read(M.serialize(n)); assert.deepEqual(plain(restored), plain(n)); assert.deepEqual(plain(P.cost(restored)), plain(P.cost(n)));
  delete n.planning; delete n.appearance; assert(M.read(M.serialize(n)));
  n.planning = { budget: Infinity }; assert.throws(() => M.read(M.serialize(n))); n.planning = { reserve: -1 }; assert.throws(() => M.read(M.serialize(n)));
});
test('Scene graph still represents the same millimetre furniture and contains object details', () => {
  vm.runInContext(scripts[3], pure); vm.runInContext(scripts[4], pure); const scene = pure.SceneApp.buildScene(state); assert(scene.objects.length > 140); assert(scene.objects.some(a => a.name.includes('P05')));
});
const elements = {};
function element(id = '') {
  const e = { id, value: '', hidden: false, style: {}, dataset: {}, textContent: '', innerHTML: '', clientWidth: 1000, clientHeight: 600, width: 1000, height: 600, events: {}, classList: { toggle() {}, add() {}, remove() {} }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }), setAttribute() {}, getAttribute: () => null, addEventListener(name, fn) { this.events[name] = fn; }, querySelectorAll: () => [], querySelector: () => element(), before() {}, after() {}, append() {}, remove() {}, focus() {}, click() { this.onclick?.(); }, scrollIntoView() {}, hasPointerCapture: () => false, releasePointerCapture() {}, setPointerCapture() {}, getContext: () => ({}) };
  return e;
}
const c = vm.createContext({ console, Blob, URL, setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setInterval: () => 1, clearInterval() {}, devicePixelRatio: 1, ResizeObserver: class { observe() {} disconnect() {} }, localStorage: { setItem() {}, getItem: () => null }, addEventListener() {}, confirm: () => true }); c.window = c;
c.document = { getElementById: id => elements[id] || (elements[id] = element(id)), querySelectorAll: () => [], querySelector: () => element(), createElement: () => element(), addEventListener() {}, activeElement: null, hidden: false, body: element(), head: element() };
for (let i = 0; i < scripts.length - 1; i++) {
  if (i === 5) { c.Atelier3D.Renderer = class { render() {} resize() {} dispose() {} }; c.Atelier3D.Orbit = class { constructor(can, cam) { this.camera = cam; this.radius = 8; } sync() {} dispose() {} }; }
  vm.runInContext(scripts[i], c, { timeout: 15000 });
}
const B = c.AtelierBridge;
test('Real 3D picking no longer throws on the old out-of-scope wall-height variable', () => {
  const s = B.peek(), scene = c.SceneApp.buildScene(s); assert.doesNotThrow(() => c.AppModel.pick3D(s, scene.camera, 1000, 600, 500, 350));
});
test('Real controller arrangement transaction can undo and redo the entire original layout', () => {
  const first = plain(B.peek()); B.arrange(); assert.equal(B.plan().reachable, 7); assert.equal(B.peek().items.length, 8);
  B.undo(); assert.deepEqual(plain(B.peek()), first); B.redo(); assert.equal(B.plan().reachable, 7);
});
test('Notebook retains old metrics and adds genuine current route and complete cost metrics', () => {
  const rows = c.AtelierLab.metrics(B.peek()); assert(rows.length >= 7); assert.equal(rows.find(x => x.label === '入口可达点').value, 7); assert.equal(rows.find(x => x.label === '开店总费用').value, 6457);
});
test('Real budget editing participates in the same history and restores exactly, including zero', () => {
  const old = plain(B.peek()); elements['opening-budget'].value = '0'; elements['opening-budget'].onchange({ target: elements['opening-budget'] }); assert.equal(B.costs().budget, 0); assert.equal(B.plan().reachable, 7);
  B.undo(); assert.deepEqual(plain(B.peek()), old); B.redo(); assert.equal(B.costs().budget, 0);
});
test('Bridge restores the extended serialized plan and rejects an invalid replacement atomically', () => {
  const original = plain(B.peek()); const encoded = JSON.stringify(original); B.restore(JSON.parse(encoded)); assert.deepEqual(plain(B.peek()), original);
  const invalid = plain(original); invalid.planning.reserve = -10; assert.throws(() => B.restore(invalid)); assert.deepEqual(plain(B.peek()), original);
});
test('Cannot-fit arrangement preserves the whole current plan, rather than dropping furniture', () => {
  const n = plain(B.peek()); n.room = { w: 2000, d: 2000, h: 2800, door: 1000, doorX: 1000 }; B.restore(n); const before = plain(B.peek()); B.arrange(); assert.deepEqual(plain(B.peek()), before); assert(elements.status.textContent.includes('摆不下'));
});
test('Invalid budget input is rejected and has no effect on current state', () => {
  const before = plain(B.peek()); elements['opening-reserve'].value = '-2'; elements['opening-reserve'].onchange({ target: elements['opening-reserve'] }); assert.deepEqual(plain(B.peek()), before);
});
const good = P.tidy(state).state; fs.writeFileSync(path.join(root, 'verified-plan.json'), M.serialize(good)); fs.writeFileSync(path.join(root, 'verified-report.html'), P.report(good)); fs.writeFileSync(path.join(root, 'verified-plan.svg'), P.planSVG(good, true)); fs.writeFileSync(path.join(root, 'verified-shopping.csv'), M.csv(good));
test('Report escapes user title and notes, includes actual coordinates, costs and route checks', () => {
  const n = M.copy(good); n.title = '<script>alert(1)</script>'; n.planning.brief = '<img onerror=x> 现场'; const report = P.report(n); assert(!report.includes('<script>alert(1)</script>')); assert(report.includes('&lt;script&gt;')); assert(report.includes('&lt;img onerror=x&gt;')); assert(report.includes('¥6457')); assert(report.includes('7 / 7')); assert(report.includes('1935')); assert(report.includes('window.print()'));
});
fs.writeFileSync(path.join(root, 'test-results.json'), JSON.stringify({ scope: 'Final inline scripts; real model and controller executed. DOM/WebGL outputs stubbed only for controller checks. Does not prove browser pointer or visual behaviour.', checks: reports }, null, 2));
console.log(reports.length + ' final-model/controller check groups passed. Browser verification still required.');
