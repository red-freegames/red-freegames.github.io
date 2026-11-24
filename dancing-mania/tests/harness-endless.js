// エンドレスステージのテスト
const fs = require('fs');
eval(fs.readFileSync(require('path').join(__dirname, '..', 'dance-core.js'), 'utf8'));
const DM = globalThis.__DM__, CFG = DM.CFG, E = DM.STAGES.length;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FAIL:', m); } }
function parkGuards(G) { for (const g of G.guards) { g.x = -25; g.z = -25; g.hx = -25; g.hz = -25; g.tx = -25; g.tz = -25; g.waitT = 999; g.mode = "patrol"; } } // プレイヤー(25,25)の反対の隅

ok(DM.stageDef(E) === DM.ENDLESS && DM.stageDef(0) === DM.STAGES[0], 'stageDef resolves endless after the 7 stages');
// --- 人が入ってきて、時間切れはなく、正気の人が上限に達すると終わる ---
{
  const G = DM.createGame(1); G.startStage(E);
  ok(G.isEndless() && G.timeLeft === Infinity, 'endless has no time limit');
  const n0 = G.npcs.length; let spawns = 0;
  G.player.x = 25; G.player.z = 25;
  for (let i = 0; i < 30 * 10 && G.phase === 'play'; i++) { parkGuards(G); G.update(1 / 30, { x: 0, z: 0 }); for (const e of G.drainEvents()) if (e.type === 'spawn') spawns++; }
  ok(spawns >= 6, 'people keep arriving: ' + spawns + ' in 10s');
  ok(G.npcs.every(n => n.state === 'gone' || Math.abs(n.x) <= DM.ARENA && Math.abs(n.z) <= DM.ARENA), 'arrivals stay inside the arena');
  for (let i = 0; i < 30 * 200 && G.phase === 'play'; i++) { parkGuards(G); G.update(1 / 30, { x: 0, z: 0 }); }
  ok(G.phase === 'over' && G.overReason === 'sane', 'too many sane people ends the run (' + G.phase + '/' + G.overReason + ')');
  ok(G.saneCount() >= CFG.endlessLimit, 'sane count reached the limit: ' + G.saneCount());
  ok(G.npcs.length <= CFG.npcMax, 'never more than npcMax people: ' + G.npcs.length);
}
// --- 踊り出した人は踊り疲れて帰り、その枠が使い回される。クリアにはならない ---
{
  const G = DM.createGame(2); G.startStage(E); parkGuards(G);
  for (const n of G.npcs) n.state = 'dancer';
  let tired = 0, cleared = false;
  for (let i = 0; i < 30 * (CFG.endlessTire + 2); i++) { parkGuards(G); G.update(1 / 30, { x: 0, z: 0 }); for (const e of G.drainEvents()) { if (e.type === 'tired') tired++; if (e.type === 'clear' || e.type === 'goal') cleared = true; } }
  ok(tired >= 30, 'dancers get tired and leave: ' + tired);
  ok(!cleared && G.phase === 'play', 'endless never clears');
  const len = G.npcs.length;
  for (let i = 0; i < 30 * 5; i++) { parkGuards(G); G.update(1 / 30, { x: 0, z: 0 }); }
  ok(G.npcs.length === len, 'gone slots are reused before growing (' + len + ' -> ' + G.npcs.length + ')');
}
// --- 警備員が増える(最大6人) ---
{
  const G = DM.createGame(3); G.startStage(E);
  G.player.x = 25; G.player.z = 25;
  let adds = 0;
  for (let i = 0; i < 30 * (CFG.endlessGuardEvery * 7) && G.phase === 'play'; i++) { G.player.invuln = 99; for (const n of G.npcs) if (n.state === 'walk') n.state = 'dancer'; G.update(1 / 30, { x: 0, z: 0 }); for (const e of G.drainEvents()) if (e.type === 'guardAdd') adds++; }
  ok(adds === 5 && G.guards.length === 6, 'guards grow to 6: +' + adds);
}
// --- ボット: 何秒生き残れるか ---
{
  const t = [], sc = [], why = {};
  for (let seed = 1; seed <= 20; seed++) {
    const G = DM.createGame(seed); G.startStage(E); let steps = 0;
    while (G.phase === 'play' && steps < 30 * 900) {
      let tgt = null, best = Infinity;
      for (const n of G.npcs) { if (n.state !== 'walk' || n.immune > 0) continue; const d = (n.x - G.player.x) ** 2 + (n.z - G.player.z) ** 2; if (d < best) { best = d; tgt = n; } }
      let ix = 0, iz = 0;
      if (tgt) { ix = tgt.x - G.player.x; iz = tgt.z - G.player.z; const l = Math.hypot(ix, iz) || 1; ix /= l; iz /= l; }
      for (const g of G.guards) { const d = Math.hypot(g.x - G.player.x, g.z - G.player.z); if (d < 5.5 && G.fever <= 0) { ix += (G.player.x - g.x) / (d || 1) * 1.6; iz += (G.player.z - g.z) / (d || 1) * 1.6; } }
      G.update(1 / 30, { x: ix, z: iz }); G.drainEvents(); steps++;
    }
    t.push(Math.round(G.elapsed)); sc.push(G.score); why[G.overReason || 'alive'] = (why[G.overReason || 'alive'] || 0) + 1;
  }
  t.sort((a, b) => a - b); sc.sort((a, b) => a - b);
  console.log('bot survival s min/median/max:', t[0], t[10], t[19], '| score median', sc[10], '| ended by', JSON.stringify(why));
  ok(t[10] > 30, 'bot survives a while (median ' + t[10] + 's)');
}
console.log(fails === 0 ? 'ALL ENDLESS TESTS PASS' : fails + ' FAILURES');
