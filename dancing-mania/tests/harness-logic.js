const fs = require('fs');
eval(fs.readFileSync(require('path').join(__dirname, '..', 'dance-core.js'), 'utf8'));
const DM = globalThis.__DM__;
let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('FAIL:', msg); } }

// --- unit: infection by standing next to an NPC ---
{
  const G = DM.createGame(42);
  G.startStage(0);
  const n = G.npcs[0];
  n.x = 2; n.z = 22; n.dirT = 999; // beside player spawn (0,22); keep it from wandering far
  let infected = false;
  for (let t = 0; t < 90 && G.phase === 'play'; t++) {
    G.update(1 / 30, { x: 0, z: 0 });
    if (n.state === 'dancer') { infected = true; break; }
    n.x = G.player.x + 2; n.z = G.player.z; // pin beside player
  }
  ok(infected, 'NPC next to player becomes infected');
  ok(G.score >= 100, 'score awarded, got ' + G.score);
  ok(G.chain === 1, 'chain is 1');
}

// --- unit: stubborn takes longer ---
{
  const G = DM.createGame(7);
  G.startStage(0);
  const stub = G.npcs.find(p => p.stubborn), norm = G.npcs.find(p => !p.stubborn);
  function timeToInfect(npc) {
    let t = 0;
    while (t < 5 && G.phase === 'play') {
      npc.x = G.player.x + 2; npc.z = G.player.z;
      G.update(1 / 30, { x: 0, z: 0 }); t += 1 / 30;
      if (npc.state === 'dancer') return t;
    }
    return 99;
  }
  const tn = timeToInfect(norm);
  const ts = timeToInfect(stub);
  ok(tn < ts, 'stubborn slower: normal ' + tn.toFixed(2) + 's vs stubborn ' + ts.toFixed(2) + 's');
  ok(Math.abs(tn - DM.CFG.exposeNeed) < 0.1, 'normal ~0.7s, got ' + tn.toFixed(2));
}

// --- unit: guard catch x3 = game over ---
{
  const G = DM.createGame(3);
  G.startStage(0);
  const g = G.guards[0];
  let guardPhase = 0;
  for (let t = 0; t < 60 * 30 && G.phase === 'play'; t++) {
    if (G.player.invuln <= 0) { g.mode = 'patrol'; g.x = G.player.x; g.z = G.player.z; }
    G.update(1 / 30, { x: 0, z: 0 });
  }
  ok(G.phase === 'over' && G.overReason === 'caught', '3 catches -> over (phase=' + G.phase + ' reason=' + G.overReason + ' hearts=' + G.hearts + ')');
}

// --- unit: timeout = game over ---
{
  const G = DM.createGame(5);
  G.startStage(0);
  for (let t = 0; t < 60 * 200 && G.phase === 'play'; t++) {
    for (const g of G.guards) { g.x = -25; g.z = -25; g.mode = 'patrol'; g.waitT = 999; g.tx = -25; g.tz = -25; }
    for (const n of G.npcs) { const d = Math.hypot(n.x - G.player.x, n.z - G.player.z); if (d < 8) { n.x = -20; n.z = 0; } }
    G.update(1 / 30, { x: 0, z: 0 });
  }
  ok(G.phase === 'over' && G.overReason === 'time', 'timeout -> over, phase=' + G.phase);
}

// --- unit: guard cures a dancer when player is far away ---
{
  const G = DM.createGame(11);
  G.startStage(0);
  const n = G.npcs[0];
  n.state = 'dancer'; n.x = -20; n.z = -20; // near guard home (-22,-22)
  G.player.x = 25; G.player.z = 25; // far corner, out of chase sense... 25,25 to -22,-22 is far
  let cured = false;
  for (let t = 0; t < 30 * 30 && G.phase === 'play'; t++) {
    G.update(1 / 30, { x: 0, z: 0 });
    // keep player pinned far (update doesn't move player without input; fine)
    if (n.state === 'walk' && n.immune > 0) { cured = true; break; }
  }
  ok(cured, 'guard cures dancer');
}

// --- bot playthrough sims ---
function botRun(seed) {
  const G = DM.createGame(seed);
  const res = [];
  for (let s = 0; s < DM.STAGES.length; s++) {
    G.startStage(s);
    let steps = 0;
    while (G.phase === 'play' && steps < 60 * 300) {
      // target: nearest non-immune walker
      let tgt = null, best = Infinity;
      for (const n of G.npcs) {
        if (n.state !== 'walk' || n.immune > 0) continue;
        const d = (n.x - G.player.x) ** 2 + (n.z - G.player.z) ** 2;
        if (d < best) { best = d; tgt = n; }
      }
      if (!tgt) { // all remaining are immune; wait near a dancer cluster
        for (const n of G.npcs) { if (n.state === 'walk') { tgt = n; break; } }
      }
      let ix = 0, iz = 0;
      if (tgt) { ix = tgt.x - G.player.x; iz = tgt.z - G.player.z; const l = Math.hypot(ix, iz) || 1; ix /= l; iz /= l; }
      // flee guards when close
      for (const g of G.guards) {
        const d = Math.hypot(g.x - G.player.x, g.z - G.player.z);
        if (d < 5.5) { ix += (G.player.x - g.x) / (d || 1) * 1.6; iz += (G.player.z - g.z) / (d || 1) * 1.6; }
      }
      G.update(1 / 30, { x: ix, z: iz });
      steps++;
    }
    res.push({ stage: s, phase: G.phase, infected: G.infectedCount() + '/' + G.totalNpc, hearts: G.hearts, maxChain: G.maxChain, score: G.score });
    if (G.phase !== 'clear' && G.phase !== 'goal') break;
  }
  return res;
}
let clears = DM.STAGES.map(() => 0), goals = 0, scores = [];
for (let seed = 1; seed <= 30; seed++) {
  const r = botRun(seed);
  r.forEach((x, i) => { if (x.phase === 'clear' || x.phase === 'goal') clears[i]++; });
  const last = r[r.length - 1];
  if (last.phase === 'goal') goals++;
  scores.push(last.score);
  if (seed <= 3) console.log('seed', seed, JSON.stringify(r));
}
scores.sort((a, b) => a - b);
console.log('stage clear rates (bot):', clears.map(c => c + '/30').join(' '), '| full clear:', goals + '/30');
console.log('final score min/median/max:', scores[0], scores[15], scores[29]);
console.log(fails === 0 ? 'ALL UNIT TESTS PASS' : fails + ' FAILURES');
