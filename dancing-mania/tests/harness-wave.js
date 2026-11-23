// 波モード(試作)のテストと、いつものモードとの比較
const fs = require('fs');
eval(fs.readFileSync(require('path').join(__dirname, '..', 'dance-core.js'), 'utf8'));
const DM = globalThis.__DM__;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FAIL:', m); } }
function parkGuards(G) { for (const g of G.guards) { g.x = 25; g.z = 25; g.hx = 25; g.hz = 25; g.tx = 25; g.tz = 25; g.waitT = 999; } }

// --- 一列に並べた通行人を、波がドミノのように倒していく ---
{
  const G = DM.createGame(1, { wave: true }); G.startStage(1);
  const line = G.npcs.filter(n => !n.stubborn && n.kind === 'normal').slice(0, 8);
  for (const n of G.npcs) { if (!line.includes(n)) { n.x = 24; n.z = -24; n.stand = true; n.immune = 999; } }
  const gap = DM.CFG.infectR * 0.8; // 隣にだけ届く間隔
  line.forEach((n, i) => { n.x = -20 + i * gap; n.z = 0; n.stand = true; n.dirT = 999; });
  G.player.x = -20 - gap; G.player.z = 0;
  const times = [];
  for (let f = 0; f < 30 * 6 && G.phase === 'play'; f++) {
    parkGuards(G); G.update(1 / 30, { x: 0, z: 0 });
    G.player.x = -20 - gap; G.player.z = 0; // プレイヤーは端で止まる(最初の1人だけ触る)
    line.forEach((n, i) => { if (n.state === 'dancer' && times[i] === undefined) times[i] = G.elapsed; });
  }
  ok(line.every(n => n.state === 'dancer'), 'whole line danced: ' + line.filter(n => n.state === 'dancer').length + '/8');
  const span = times[7] - times[0];
  ok(span > 7 * 0.15 && span < 7 * 0.45, 'wave travels ~0.2s per person: ' + span.toFixed(2) + 's for 7 hops');
  ok(G.stats.pulse >= 7 && G.stats.player === 1, 'one touch, rest by pulses (player ' + G.stats.player + ', pulse ' + G.stats.pulse + ')');
  ok(G.maxWave >= 8, 'wave size tracked: ' + G.maxWave);
}
// --- いつものモードでは同じ並びでもパルスは出ない ---
{
  const G = DM.createGame(1); G.startStage(1);
  ok(!G.wave, 'wave off by default');
  const line = G.npcs.filter(n => !n.stubborn && n.kind === 'normal').slice(0, 8);
  const gap = DM.CFG.infectR * 0.8;
  line.forEach((n, i) => { n.x = -20 + i * gap; n.z = 0; n.stand = true; });
  G.player.x = -20 - gap; G.player.z = 0;
  let pulses = 0;
  for (let f = 0; f < 30; f++) { parkGuards(G); G.update(1 / 30, { x: 0, z: 0 }); for (const e of G.drainEvents()) if (e.type === 'pulse') pulses++; }
  ok(pulses === 0, 'no pulses in normal mode');
}
// --- 頑固な人はパルス2回で踊る。説教で戻された人はパルスを出さない ---
{
  const G = DM.createGame(2, { wave: true }); G.startStage(1);
  const stub = G.npcs.find(n => n.stubborn && n.kind !== 'bride' && n.kind !== 'groom');
  const a = G.npcs.find(n => !n.stubborn && n.kind === 'normal');
  for (const n of G.npcs) if (n !== stub && n !== a) { n.x = 24; n.z = 24; n.stand = true; n.immune = 999; }
  a.x = 0; a.z = 0; a.stand = true; stub.x = 2; stub.z = 0; stub.stand = true;
  G.player.x = -20; G.player.z = -20; parkGuards(G);
  a.state = 'dancer'; G.pulses.push({ id: a.id, at: G.elapsed, waveId: 99 });
  G.update(1 / 30, { x: 0, z: 0 });
  ok(stub.state === 'walk' && stub.exposure >= 0.45, 'stubborn half-filled by one pulse (' + stub.exposure.toFixed(2) + ')');
  G.pulses.push({ id: a.id, at: G.elapsed, waveId: 99 }); G.update(1 / 30, { x: 0, z: 0 });
  ok(stub.state === 'dancer', 'stubborn dances after second pulse');
  const b = G.npcs.find(n => n.immune > 900 && !n.stubborn); b.immune = 0; b.x = 0; b.z = 3; b.stand = true;
  const c = G.npcs.find(n => n.immune > 900 && !n.stubborn && n !== b); c.immune = 0; c.x = 0; c.z = 6; c.stand = true;
  b.state = 'dancer'; G.pulses.push({ id: b.id, at: G.elapsed + 0.1, waveId: 98 });
  b.state = 'walk'; b.immune = 5; // 説教で戻された
  c.exposure = 0;
  for (let f = 0; f < 6; f++) G.update(1 / 30, { x: 0, z: 0 });
  ok(c.exposure < 0.5 && c.state === 'walk', 'cured dancer does not pulse');
}

// --- ボット比較: いつもの vs 波 ---
function bot(wave) {
  let clears = DM.STAGES.map(() => 0), goals = 0, maxWaves = [], chains = [], direct = 0, total = 0, scores = [];
  for (let seed = 1; seed <= 30; seed++) {
    const G = DM.createGame(seed, { wave: wave });
    let reached = 0;
    for (let s = 0; s < DM.STAGES.length; s++) {
      G.startStage(s);
      let steps = 0;
      while (G.phase === 'play' && steps < 60 * 300) {
        let tgt = null, best = Infinity;
        for (const n of G.npcs) { if (n.state !== 'walk' || n.immune > 0) continue; const d = (n.x - G.player.x) ** 2 + (n.z - G.player.z) ** 2; if (d < best) { best = d; tgt = n; } }
        let ix = 0, iz = 0;
        if (tgt) { ix = tgt.x - G.player.x; iz = tgt.z - G.player.z; const l = Math.hypot(ix, iz) || 1; ix /= l; iz /= l; }
        for (const g of G.guards) { const d = Math.hypot(g.x - G.player.x, g.z - G.player.z); if (d < 5.5 && G.fever <= 0) { ix += (G.player.x - g.x) / (d || 1) * 1.6; iz += (G.player.z - g.z) / (d || 1) * 1.6; } }
        G.update(1 / 30, { x: ix, z: iz }); G.drainEvents(); steps++;
      }
      if (G.phase === 'clear' || G.phase === 'goal') clears[s]++; else break;
    }
    if (G.phase === 'goal') goals++;
    maxWaves.push(G.maxWave); chains.push(G.maxChain); scores.push(G.score);
    direct += G.stats.player; total += G.stats.player + G.stats.pulse + G.stats.dancer + G.stats.other;
  }
  maxWaves.sort((a, b) => a - b); chains.sort((a, b) => a - b); scores.sort((a, b) => a - b);
  return { clears: clears.join('/'), goals, maxWaveMedian: maxWaves[15], maxChainMedian: chains[15], playerShare: (direct / total * 100).toFixed(0) + '%', scoreMedian: scores[15] };
}
const a = bot(false), b = bot(true);
console.log('normal:', JSON.stringify(a));
console.log('wave  :', JSON.stringify(b));
ok(parseInt(b.playerShare) < parseInt(a.playerShare), 'wave mode: fewer people need the player directly (' + a.playerShare + ' -> ' + b.playerShare + ')');
console.log(fails === 0 ? 'ALL WAVE TESTS PASS' : fails + ' FAILURES');
