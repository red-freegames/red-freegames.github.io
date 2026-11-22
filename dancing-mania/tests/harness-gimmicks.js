// 特別な通行人・ステージの仕掛け・踊りの効果のテスト
const fs = require('fs');
eval(fs.readFileSync(require('path').join(__dirname, '..', 'dance-core.js'), 'utf8'));
const DM = globalThis.__DM__;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FAIL:', m); } }
function parkGuards(G) { for (const g of G.guards) { g.x = 25; g.z = 25; g.hx = 25; g.hz = 25; g.tx = 25; g.tz = 25; g.waitT = 999; } }
function step(G, n, input) { for (let i = 0; i < n && G.phase === 'play'; i++) { parkGuards(G); G.update(1 / 30, input || { x: 0, z: 0 }); } }

// --- 特別な通行人の人数 ---
DM.STAGES.forEach(function (st, i) {
  const G = DM.createGame(5 + i); G.startStage(i);
  ok(G.npcs.filter(n => n.kind === 'dj').length === st.dj, 'stage ' + (i + 1) + ' dj count');
  ok(G.npcs.filter(n => n.kind === 'kid').length === st.kids, 'stage ' + (i + 1) + ' kid count');
  ok(G.npcs.filter(n => n.stubborn).length === st.stubborn + (st.gimmick === 'couple' ? 2 : 0), 'stage ' + (i + 1) + ' stubborn count');
});

// --- DJ は感染範囲が広い ---
{
  const G = DM.createGame(1); G.startStage(1);
  const dj = G.npcs.find(n => n.kind === 'dj');
  const t = G.npcs.find(n => n.kind === 'normal' && !n.stubborn && n.state === 'walk');
  G.player.x = -25; G.player.z = 25;
  dj.state = 'dancer'; dj.x = 0; dj.z = 0; dj.dirT = 999;
  const d = DM.CFG.infectR * 1.5; // 普通なら届かない距離
  for (let i = 0; i < 40 && t.state === 'walk'; i++) { t.x = dj.x + d; t.z = dj.z; t.stand = true; step(G, 1); }
  ok(t.state === 'dancer', 'DJ infects at ' + d.toFixed(1) + ' (normal range ' + DM.CFG.infectR + ')');
  const G2 = DM.createGame(1); G2.startStage(1);
  const nd = G2.npcs.find(n => n.kind === 'normal' && n.state === 'walk');
  const t2 = G2.npcs.find(n => n.kind === 'normal' && !n.stubborn && n.state === 'walk' && n !== nd);
  G2.player.x = -25; G2.player.z = 25;
  nd.state = 'dancer'; nd.x = 0; nd.z = 0; nd.dirT = 999;
  for (let i = 0; i < 40; i++) { t2.x = nd.x + d; t2.z = nd.z; t2.stand = true; step(G2, 1); }
  ok(t2.state === 'walk', 'normal dancer does NOT infect at ' + d.toFixed(1));
}

// --- 子どもは速い ---
{
  const G = DM.createGame(2); G.startStage(0);
  const kid = G.npcs.find(n => n.kind === 'kid'), norm = G.npcs.find(n => n.kind === 'normal' && !n.stand && n.state === 'walk');
  G.player.x = -25; G.player.z = 25;
  kid.state = 'dancer'; norm.state = 'dancer';
  let dk = 0, dn = 0;
  for (let i = 0; i < 30; i++) {
    const kx = kid.x, kz = kid.z, nx = norm.x, nz = norm.z;
    G.guards.length = 0; G.update(1 / 30, { x: 0, z: 0 });
    dk += Math.hypot(kid.x - kx, kid.z - kz); dn += Math.hypot(norm.x - nx, norm.z - nz);
  }
  ok(dk > dn * 1.8, 'dancing kid travels farther: kid ' + dk.toFixed(2) + ' vs normal ' + dn.toFixed(2));
}

// --- 駅: 電車が着くと客が出てくる。全員到着するまでクリアしない ---
{
  const G = DM.createGame(3); G.startStage(0);
  const st = DM.STAGES[0];
  const away = G.npcs.filter(n => n.state === 'away').length;
  ok(away === st.arrivals.reduce((s, a) => s + a.n, 0), 'passengers wait in train: ' + away);
  ok(G.totalNpc === st.npc, 'away passengers count toward total');
  // 今いる人を全員踊らせても、電車が残っていればクリアしない
  for (const n of G.npcs) if (n.state === 'walk') n.state = 'dancer';
  step(G, 2);
  ok(G.phase === 'play', 'no clear while trains are pending');
  let trains = 0;
  for (let i = 0; i < 30 * 30 && G.arrivals.length; i++) { step(G, 1); for (const e of G.drainEvents()) if (e.type === 'train') trains++; }
  ok(trains === st.arrivals.length, 'all trains arrived: ' + trains);
  ok(G.npcs.filter(n => n.state === 'away').length === 0, 'no one left in train');
  const newcomer = G.npcs.find(n => n.state === 'walk');
  ok(newcomer && newcomer.z < -15, 'passengers appear near the gate (z=' + (newcomer && newcomer.z.toFixed(1)) + ')');
}

// --- 披露宴: 新郎新婦が踊ると周りが一斉に踊る ---
{
  const G = DM.createGame(4); G.startStage(1);
  const bride = G.npcs.find(n => n.kind === 'bride');
  const guests = G.npcs.filter(n => n.state === 'walk' && !n.stubborn).slice(0, 5);
  guests.forEach((n, i) => { n.x = bride.x + (i - 2) * 1.5; n.z = bride.z + 6; n.stand = true; }); // 新婦から6、プレイヤーから8
  G.player.x = bride.x; G.player.z = bride.z - 2;
  let burst = null;
  for (let i = 0; i < 30 * 3 && bride.state === 'walk'; i++) { step(G, 1); for (const e of G.drainEvents()) if (e.type === 'burst' && (!burst || e.n > burst.n)) burst = e; }
  for (const e of G.drainEvents()) if (e.type === 'burst' && (!burst || e.n > burst.n)) burst = e;
  ok(bride.state === 'dancer', 'bride infected');
  ok(burst && burst.n >= 5, 'burst fired, hit ' + (burst && burst.n));
  ok(guests.every(n => n.state === 'dancer'), 'guests around the couple all dance');
}

// --- オフィス: チャイム後に入口へ戻り、入られると時間が減る ---
{
  const G = DM.createGame(6); G.startStage(2);
  G.player.x = 25; G.player.z = 25;
  G.elapsed = DM.STAGES[2].bellAt - 0.01;
  let bell = false, esc = 0;
  const total0 = G.totalNpc, t0 = G.timeLeft, e0 = G.elapsed;
  for (let i = 0; i < 30 * 4; i++) { step(G, 1); for (const e of G.drainEvents()) { if (e.type === 'bell') bell = true; if (e.type === 'escape') esc++; } }
  ok(bell, 'bell rang');
  ok(G.npcs.filter(n => n.state === 'walk').every(n => n.leaving || n.kind === 'bride'), 'all walkers are leaving');
  ok(esc > 0 && G.totalNpc === total0 - esc, 'escapes reduce total: ' + esc);
  const expectLeft = t0 - (G.elapsed - e0) - esc * DM.CFG.escapePenalty;
  ok(G.phase !== 'play' || Math.abs(G.timeLeft - expectLeft) < 0.05, 'time penalty applied: ' + G.timeLeft.toFixed(2) + ' vs ' + expectLeft.toFixed(2));
}

// --- 踊りの効果 ---
{
  ok(DM.unlockedDances(0).length === 1 && DM.unlockedDances(80000).length === DM.DANCES.length, 'unlock by best score');
  const a = DM.createGame(1, { dance: 'bon' }); ok(a.chainWin === DM.CFG.chainWindow + 0.8, 'bon extends chain window');
  const b = DM.createGame(1, { dance: 'twist' }); b.startStage(0); parkGuards(b);
  const c = DM.createGame(1); c.startStage(0); parkGuards(c);
  b.update(1 / 30, { x: 1, z: 0 }); c.update(1 / 30, { x: 1, z: 0 });
  ok(b.player.x > c.player.x, 'twist is faster');
  const d = DM.createGame(1, { dance: 'nope' }); ok(d.dance.id === 'basic', 'unknown dance falls back to basic');
}

// --- ボット: 仕掛けがどれくらい効いているか ---
let bells = 0, escapes = 0, bursts = 0, trains = 0, clears = [0, 0, 0];
for (let seed = 1; seed <= 30; seed++) {
  const G = DM.createGame(seed);
  for (let s = 0; s < 3; s++) {
    G.startStage(s);
    let steps = 0;
    while (G.phase === 'play' && steps < 60 * 300) {
      let tgt = null, best = Infinity;
      for (const n of G.npcs) { if (n.state !== 'walk' || n.immune > 0) continue; const d = (n.x - G.player.x) ** 2 + (n.z - G.player.z) ** 2; if (d < best) { best = d; tgt = n; } }
      let ix = 0, iz = 0;
      if (tgt) { ix = tgt.x - G.player.x; iz = tgt.z - G.player.z; const l = Math.hypot(ix, iz) || 1; ix /= l; iz /= l; }
      for (const g of G.guards) { const d = Math.hypot(g.x - G.player.x, g.z - G.player.z); if (d < 5.5 && G.fever <= 0) { ix += (G.player.x - g.x) / (d || 1) * 1.6; iz += (G.player.z - g.z) / (d || 1) * 1.6; } }
      G.update(1 / 30, { x: ix, z: iz });
      for (const e of G.drainEvents()) { if (e.type === 'bell') bells++; if (e.type === 'escape') escapes++; if (e.type === 'burst') bursts++; if (e.type === 'train') trains++; }
      steps++;
    }
    if (G.phase === 'clear' || G.phase === 'goal') clears[s]++; else break;
  }
}
console.log('bot clears:', clears.map(c => c + '/30').join(' '), '| trains', trains, '| couple bursts', bursts, '| bells', bells, '| escapes', escapes);
console.log(fails === 0 ? 'ALL GIMMICK TESTS PASS' : fails + ' FAILURES');
