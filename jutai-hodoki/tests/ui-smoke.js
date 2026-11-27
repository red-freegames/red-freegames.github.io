// node tests/ui-smoke.js [出力先の接頭辞]
// ブラウザで タイトル→ステージ1→道路を引く→本番テスト→結果 まで通し、エラーが出ないことを確かめる。
// 接頭辞を渡すと各画面のスクリーンショットも保存する
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2];
(async () => {
  const shot = async (p, name) => { if (out) await p.screenshot({ path: out + '-' + name + '.png' }); };
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route(/googlesyndication|googletagmanager/, r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.waitForTimeout(800);
  await shot(p, 'title');
  await p.click('#goStages'); await p.waitForTimeout(200);
  await shot(p, 'stages');
  await p.click('.sc[data-si="0"]'); await p.waitForTimeout(700);
  await shot(p, 'brief');
  await p.click('#goBuild'); await p.waitForTimeout(4000);
  await shot(p, 'build');
  // 道路を引く (15,14)->(29,14)
  const box = await p.locator('#cv').boundingBox();
  const at = (x, y) => [box.x + (x + 0.5) / 30 * box.width, box.y + (y + 0.5) / 20 * box.height];
  await p.mouse.move(...at(15, 14)); await p.mouse.down(); await p.mouse.move(...at(22, 14), { steps: 8 }); await p.mouse.move(...at(29, 14), { steps: 8 });
  await shot(p, 'drag');
  await p.mouse.up(); await p.waitForTimeout(3000);
  await shot(p, 'built');
  await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  await shot(p, 'test');
  await p.click('#bSkip'); await p.waitForTimeout(500);
  await shot(p, 'result');
  const res = await p.evaluate(() => !!__JH_UI__.ui.result && document.querySelector('.verdict') !== null);
  await b.close();
  const bad = errs.filter(e => !/ERR_FAILED/.test(e));
  console.log(res ? '  ok   結果画面まで到達' : '  FAIL 結果画面に到達しない');
  console.log(bad.length ? '  FAIL エラー: ' + bad.join(' / ') : '  ok   ページエラーなし');
  process.exit(res && !bad.length ? 0 : 1);
})();
