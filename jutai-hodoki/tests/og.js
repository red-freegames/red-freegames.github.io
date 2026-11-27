// node tests/og.js … og.png（1200x630）を作る
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route(/googlesyndication|googletagmanager/, r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.waitForTimeout(300);
  const url = await p.evaluate(() => {
    const U = __JH_UI__, J = __JH__;
    U.loadStage(4); U.closeOv();
    for (let k = 0; k < 30 * 70; k++) J.step(U.ui.sim, 1 / 30);
    U.ui.heat = false; U.render();
    return document.getElementById('cv').toDataURL('image/png');
  });
  await p.setViewportSize({ width: 1200, height: 630 });
  await p.setContent(`<html><body style="margin:0;width:1200px;height:630px;overflow:hidden;font-family:'Noto Sans CJK JP','Noto Sans JP',sans-serif">
    <div style="position:absolute;inset:0;background:url(${url}) 40px -40px/1920px 1280px no-repeat"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(25,34,28,.97) 0%,rgba(25,34,28,.93) 50%,rgba(25,34,28,0) 62%)"></div>
    <div style="position:absolute;left:64px;top:96px;color:#fff">
      <div style="font-size:24px;font-weight:900;letter-spacing:.12em;color:#ff8a8d">RED FREE GAMES</div>
      <div style="font-size:120px;font-weight:900;letter-spacing:.06em;line-height:1.15;margin-top:6px;text-shadow:6px 6px 0 #000">渋滞<span style="color:#ffd54a">ほどき</span></div>
      <div style="font-size:34px;font-weight:900;margin-top:18px;line-height:1.45">大渋滞の街を、<br>予算内の道路工事でほどけ。</div>
      <div style="display:flex;gap:10px;margin-top:26px">${['橋', '跨線橋', '立体交差', '全5ステージ'].map(t => `<span style="font-size:22px;font-weight:900;background:#e8262b;border-radius:99px;padding:4px 18px">${t}</span>`).join('')}</div>
    </div></body></html>`);
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.resolve(__dirname, '../og.png') });
  await b.close();
  console.log('og.png written');
})();
