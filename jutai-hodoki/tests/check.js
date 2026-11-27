// node tests/check.js [stageId]
// index.html のロジック（1つ目の <script>）を読み、各ステージについて
//  ・工事前は目標を大きく上回って渋滞すること
//  ・想定解（pass: true）が予算内で目標を達成すること
// を検証する。調整時は数値を眺める用途にも使う
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const blocks = html.match(/<script>([\s\S]*?)<\/script>/g);
if (!blocks || blocks.length !== 2) throw new Error('script blocks must be exactly 2 (logic, UI)');
eval(blocks[0].replace(/<\/?script>/g, ''));
const J = globalThis.__JH__;
const SOL = require('./solutions.js');
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fail++; };
// CONF 表の基本性質（左側通行）
ok(J.CONF[0 * 16 + 0 * 4 + 0] === 0, '同じ方向から来る車どうしは衝突しない');
ok(J.CONF[(0 * 4 + 0) * 16 + (2 * 4 + 2)] === 0, '対向の直進どうしは同時に通れる');
ok(J.CONF[(0 * 4 + 0) * 16 + (1 * 4 + 1)] === 1, '直交する直進どうしは衝突する');
ok(J.CONF[(0 * 4 + 1) * 16 + (2 * 4 + 2)] === 1, '右折は対向直進と衝突する');
ok(J.CONF[(0 * 4 + 3) * 16 + (2 * 4 + 1)] === 0, '向かい合う左折どうしは衝突しない');
const only = process.argv[2];
for (const st of J.STAGES) {
  if (only && st.id !== only) continue;
  console.log(`${st.id} ${st.name}（目標 ${st.target}% / 予算 ${st.budget}万円）`);
  const base = J.runTest(st, J.makeNet(st));
  ok(base.jam >= st.target + 15, `工事前 渋滞度 ${base.jam}% 平均 ${base.avgT.toFixed(1)}分`);
  for (const [name, s] of Object.entries(SOL[st.id] || {})) {
    const net = J.makeNet(st);
    const c = {
      used: 0, cut: false,
      line(pts) { const t = []; for (let k = 0; k + 1 < pts.length; k++) { let [x, y] = pts[k]; const [x1, y1] = pts[k + 1]; if (!t.length) t.push(J.idx(x, y)); while (x !== x1 || y !== y1) { if (x < x1) x++; else if (x > x1) x--; else if (y < y1) y++; else y--; t.push(J.idx(x, y)); } } const r = J.commitPath(net, t); if (r.ok !== t.length) this.cut = true; this.used += r.cost; },
      tool(n, x, y) { const r = J.applyTool(net, n, J.idx(x, y)); if (r == null) this.cut = true; else this.used += r; },
      fly(x, y) { this.tool('fly', x, y); },
    };
    s.fn(c);
    const r = J.runTest(st, net);
    const stars = J.starsOf(st, r, c.used);
    const line = `${name}: 渋滞度 ${r.jam}% 平均 ${r.avgT.toFixed(1)}分 費用 ${c.used}万円 ★${stars}`;
    if (s.pass) ok(!c.cut && c.used <= st.budget && stars > 0, line); else console.log('  -    ' + line);
  }
}
// 決定性：同じ設計なら同じ結果
const st = J.STAGES[0];
ok(JSON.stringify(J.runTest(st, J.makeNet(st))) === JSON.stringify(J.runTest(st, J.makeNet(st))), '本番テストは同じ設計なら同じ結果になる');
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);
