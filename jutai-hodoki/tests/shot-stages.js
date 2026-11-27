// node tests/shot-stages.js 出力先の接頭辞 … 各ステージを開き、想定解を適用して描画を確認（目視用）
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '/tmp/jh';
const SOL = {
  1: `line([[5,5],[22,5]])`,
  2: `fly(8,9);fly(8,10)`,
  3: `fly(15,10)`,
  4: `line([[17,3],[17,12]]);fly(21,12);line([[12,11],[9,11],[9,19]])`,
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/googlesyndication|googletagmanager/, r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.waitForTimeout(300);
  for (let si = 1; si < 5; si++) {
    await p.evaluate(([si, sol]) => {
      const U = __JH_UI__, J = __JH__;
      U.loadStage(si); setTimeout(U.closeOv, 300);
      const net = U.ui.net;
      const line = pts => { const t = []; for (let s = 0; s + 1 < pts.length; s++) { let [x, y] = pts[s]; const [x1, y1] = pts[s + 1]; if (!t.length) t.push(J.idx(x, y)); while (x !== x1 || y !== y1) { if (x < x1) x++; else if (x > x1) x--; else if (y < y1) y++; else y--; t.push(J.idx(x, y)); } } U.ui.used += J.commitPath(net, t).cost; };
      const fly = (x, y) => { U.ui.used += J.applyTool(net, 'fly', J.idx(x, y)); };
      U.ui.speed = 4;
      if (window.__withSol) eval(sol);
    }, [si, SOL[si]]);
    await p.waitForTimeout(5000);
    await p.screenshot({ path: `${out}-s${si + 1}a.png` });
    await p.evaluate(([si, sol]) => {
      const U = __JH_UI__, J = __JH__, net = U.ui.net;
      const line = pts => { const t = []; for (let s = 0; s + 1 < pts.length; s++) { let [x, y] = pts[s]; const [x1, y1] = pts[s + 1]; if (!t.length) t.push(J.idx(x, y)); while (x !== x1 || y !== y1) { if (x < x1) x++; else if (x > x1) x--; else if (y < y1) y++; else y--; t.push(J.idx(x, y)); } } U.ui.used += J.commitPath(net, t).cost; };
      const fly = (x, y) => { U.ui.used += J.applyTool(net, 'fly', J.idx(x, y)); };
      eval(sol);
    }, [si, SOL[si]]);
    await p.waitForTimeout(6000);
    await p.screenshot({ path: `${out}-s${si + 1}b.png` });
  }
  console.log('errors:', errs);
  await b.close();
})();
