const fs = require('fs');
eval(fs.readFileSync(require('path').join(__dirname, '..', 'dance-core.js'), 'utf8'));
const DM = globalThis.__DM__;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FAIL:', m); } }

// --- clusters exist and standers stay put ---
{
  const G = DM.createGame(21);
  G.startStage(0);
  ok(G.clusters.length === DM.STAGES[0].clusters, 'clusters created: ' + G.clusters.length);
  const standers = G.npcs.filter(n => n.stand);
  ok(standers.length >= 6, 'standers assigned: ' + standers.length + '/' + G.totalNpc);
  const s = standers[0];
  const x0 = s.x, z0 = s.z;
  G.player.x = -25; G.player.z = -25; // far away so no infection
  for (const g of G.guards) { g.x = 25; g.z = -25; g.waitT = 999; g.tx = 25; g.tz = -25; }
  for (let t = 0; t < 60 * 3; t++) G.update(1 / 30, { x: 0, z: 0 });
  const moved = Math.hypot(s.x - x0, s.z - z0);
  ok(moved < 0.01, 'stander did not move (moved ' + moved.toFixed(3) + ')');
  ok(s.state === 'walk', 'stander still uninfected');
  // standers are near their cluster center
  const c = G.clusters[0];
  const nearCluster = G.npcs.filter(n => n.stand && Math.hypot(n.x - c.x, n.z - c.z) < 3.2);
  ok(nearCluster.length >= 2, 'cluster 0 has nearby standers: ' + nearCluster.length);
}

// --- chain timer ---
{
  const G = DM.createGame(31);
  G.startStage(0);
  ok(G.chainTimeLeft() === 0, 'chain timer 0 before any infection');
  const n = G.npcs.find(p => !p.stand);
  let guard;
  for (let t = 0; t < 60 * 3 && n.state !== 'dancer'; t++) {
    n.x = G.player.x + 2; n.z = G.player.z;
    G.update(1 / 30, { x: 0, z: 0 });
  }
  ok(n.state === 'dancer', 'infected for chain test');
  const left = G.chainTimeLeft();
  ok(left > 2.0 && left <= DM.CFG.chainWindow, 'chainTimeLeft in range: ' + left.toFixed(2));
}

// --- fever: triggers at 12 chain, guards harmless during fever ---
{
  const G = DM.createGame(99);
  G.startStage(2); // 52 NPCs
  // ring 16 non-stubborn walkers around the player
  const targets = G.npcs.filter(p => !p.stubborn).slice(0, 16);
  targets.forEach((n, i) => {
    const a = (i / 16) * Math.PI * 2;
    n.x = G.player.x + Math.sin(a) * 2.5; n.z = G.player.z + Math.cos(a) * 2.5;
    n.stand = false;
  });
  let feverSeen = false, feverAt = -1;
  for (let t = 0; t < 30 * 6; t++) {
    // keep targets pinned near player until infected
    for (const n of targets) if (n.state === 'walk') { /* they wander slowly; re-pin every frame */ }
    targets.forEach((n, i) => { if (n.state === 'walk') { const a = (i / 16) * Math.PI * 2; n.x = G.player.x + Math.sin(a) * 2.5; n.z = G.player.z + Math.cos(a) * 2.5; } });
    G.update(1 / 30, { x: 0, z: 0 });
    for (const e of G.drainEvents()) if (e.type === 'fever') feverSeen = true;
    if (G.fever > 0 && feverAt < 0) feverAt = t;
    if (feverAt >= 0 && t > feverAt + 5) break;
  }
  ok(feverSeen, 'fever event fired');
  ok(G.maxChain >= DM.CFG.feverChain, 'chain reached fever threshold, maxChain=' + G.maxChain);
  // during fever: guard standing on player must not catch
  if (G.fever > 0) {
    const heartsBefore = G.hearts;
    const g = G.guards[0];
    g.x = G.player.x; g.z = G.player.z;
    for (let t = 0; t < 30 && G.fever > 0; t++) G.update(1 / 30, { x: 0, z: 0 });
    ok(G.hearts === heartsBefore, 'no catch during fever (hearts ' + heartsBefore + ' -> ' + G.hearts + ')');
    ok(g.mode === 'dance', 'guard mode is dance during fever');
  } else {
    ok(false, 'fever still active for guard test (fever=' + G.fever.toFixed(2) + ')');
  }
}

// --- bot: clear times + fever counts ---
function botRun(seed) {
  const G = DM.createGame(seed);
  const res = [];
  let fevers = 0;
  for (let s = 0; s < DM.STAGES.length; s++) {
    G.startStage(s);
    let steps = 0;
    while (G.phase === 'play' && steps < 60 * 300) {
      let tgt = null, best = Infinity;
      for (const n of G.npcs) {
        if (n.state !== 'walk' || n.immune > 0) continue;
        const d = (n.x - G.player.x) ** 2 + (n.z - G.player.z) ** 2;
        if (d < best) { best = d; tgt = n; }
      }
      if (!tgt) for (const n of G.npcs) { if (n.state === 'walk') { tgt = n; break; } }
      let ix = 0, iz = 0;
      if (tgt) { ix = tgt.x - G.player.x; iz = tgt.z - G.player.z; const l = Math.hypot(ix, iz) || 1; ix /= l; iz /= l; }
      for (const g of G.guards) {
        const d = Math.hypot(g.x - G.player.x, g.z - G.player.z);
        if (d < 5.5 && G.fever <= 0) { ix += (G.player.x - g.x) / (d || 1) * 1.6; iz += (G.player.z - g.z) / (d || 1) * 1.6; }
      }
      G.update(1 / 30, { x: ix, z: iz });
      for (const e of G.drainEvents()) if (e.type === 'fever') fevers++;
      steps++;
    }
    res.push({ stage: s, phase: G.phase, timeLeft: Math.round(G.timeLeft), maxChain: G.maxChain, score: G.score });
    if (G.phase !== 'clear' && G.phase !== 'goal') break;
  }
  return { res: res, fevers: fevers };
}
let feverRuns = 0, timeLefts = [[], [], []];
for (let seed = 1; seed <= 30; seed++) {
  const r = botRun(seed);
  if (r.fevers > 0) feverRuns++;
  r.res.forEach((x, i) => { if (x.phase === 'clear' || x.phase === 'goal') timeLefts[i].push(x.timeLeft); });
  if (seed <= 2) console.log('seed', seed, JSON.stringify(r.res), 'fevers=' + r.fevers);
}
console.log('runs with fever:', feverRuns + '/30');
timeLefts.forEach((arr, i) => { if (arr.length) { arr.sort((a, b) => a - b); console.log('stage', i + 1, 'clear timeLeft median:', arr[arr.length >> 1], 's (n=' + arr.length + ')'); } });
console.log(fails === 0 ? 'ALL NEW TESTS PASS' : fails + ' FAILURES');
