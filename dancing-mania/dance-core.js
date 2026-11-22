// 『ダンシングマニア(仮)』ロジックコア: THREE/DOM非依存。描画は dance-ui.js。
(function () {
'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARENA = 27; // 移動可能範囲は ±ARENA の正方形

const STAGES = [
  { name: '駅前広場',        sub: '平日の昼休み',   npc: 26, stubborn: 4,  guards: 1, time: 60, clusters: 3 },
  { name: '結婚式の披露宴',  sub: 'ご両家とも困惑', npc: 38, stubborn: 7,  guards: 2, time: 70, clusters: 4 },
  { name: 'オフィス街の広場', sub: '昼休み終了間近', npc: 52, stubborn: 11, guards: 3, time: 90, clusters: 5 },
];

const CFG = {
  playerSpeed: 9.4,
  npcSpeed: 2.3,
  dancerSpeed: 1.35,
  guardSpeed: 7.5,
  guardPatrolSpeed: 3.2,
  infectR: 4.3,
  exposeNeed: 0.7,        // 通常の人が感染するまでの滞在秒数
  stubbornNeed: 1.8,      // 頑固な人
  exposeDecay: 1.6,       // 範囲外での減衰(秒換算)
  chainWindow: 2.5,
  catchR: 1.3,
  chaseSense: 14,         // 警備員がプレイヤーを追い始める距離
  cureR: 2.2,
  cureTime: 2.0,
  immunityTime: 5,
  invulnTime: 2.5,
  hearts: 3,
  feverChain: 12,       // この連鎖数に到達でフィーバー
  feverTime: 5,         // フィーバー持続秒数
  feverRadiusMul: 1.5,  // フィーバー中の感染範囲倍率
  feverExposeMul: 1.6,  // フィーバー中の感染速度倍率
  clusterRatio: 0.45,   // 人だかりに配置する割合の目安
};

function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

function createGame(seed) {
  const rng = mulberry32(seed >>> 0 || 1);
  const G = {
    phase: 'ready', // ready | play | clear | over | goal
    stageIdx: 0,
    score: 0,
    hearts: CFG.hearts,
    timeLeft: 0,
    elapsed: 0,
    chain: 0,
    maxChain: 0,
    lastInfectAt: -99,
    lastClearBonus: 0,
    overReason: '',
    player: { x: 0, z: 22, face: Math.PI, invuln: 0, moving: false },
    npcs: [],
    guards: [],
    fever: 0,
    clusters: [],
    events: [],
    totalNpc: 0,
    totalInfectedEver: 0,
  };

  function ev(type, data) { G.events.push(Object.assign({ type: type }, data || {})); }

  G.drainEvents = function () { const e = G.events; G.events = []; return e; };

  G.infectedCount = function () {
    let n = 0; for (const p of G.npcs) if (p.state === 'dancer') n++;
    return n;
  };

  G.chainTimeLeft = function () {
    if (G.chain <= 0) return 0;
    return Math.max(0, CFG.chainWindow - (G.elapsed - G.lastInfectAt));
  };

  G.startStage = function (idx) {
    const st = STAGES[idx];
    G.stageIdx = idx;
    G.phase = 'play';
    G.hearts = CFG.hearts;
    G.timeLeft = st.time;
    G.elapsed = 0;
    G.chain = 0;
    G.lastInfectAt = -99;
    G.totalNpc = st.npc;
    G.player.x = 0; G.player.z = 22; G.player.face = Math.PI; G.player.invuln = 0;
    G.npcs = [];
    for (let i = 0; i < st.npc; i++) {
      let x = 0, z = 0, tries = 0;
      do { x = (rng() * 2 - 1) * (ARENA - 2); z = (rng() * 2 - 1) * (ARENA - 2); tries++; }
      while (dist2(x, z, G.player.x, G.player.z) < 25 && tries < 30);
      const dir = rng() * Math.PI * 2;
      G.npcs.push({
        id: i, x: x, z: z, dir: dir, dirT: 1 + rng() * 3,
        state: 'walk', exposure: 0, stubborn: i < st.stubborn, stand: false,
        immune: 0, cureProg: 0, walkPhase: rng() * Math.PI * 2,
        colorIdx: (rng() * 8) | 0,
      });
    }
    const homes = [[-22, -22], [22, -22], [0, -24], [-22, 22]];
    G.guards = [];
    for (let i = 0; i < st.guards; i++) {
      G.guards.push({
        id: i, x: homes[i][0], z: homes[i][1], hx: homes[i][0], hz: homes[i][1],
        mode: 'patrol', tx: homes[i][0], tz: homes[i][1], waitT: 0,
        targetId: -1, cureT: 0, face: 0,
      });
    }
    // --- 人だかり(屋台などの周りに固まる人々) ---
    G.fever = 0;
    G.clusters = [];
    let ct = 0;
    while (G.clusters.length < st.clusters && ct < 80) {
      ct++;
      const cx = (rng() * 2 - 1) * 19, cz = (rng() * 2 - 1) * 19;
      if (dist2(cx, cz, G.player.x, G.player.z) < 64) continue;
      let okC = true;
      for (const c of G.clusters) if (dist2(cx, cz, c.x, c.z) < 121) okC = false;
      if (okC) G.clusters.push({ x: cx, z: cz });
    }
    if (G.clusters.length) {
      const per = Math.ceil(st.npc * CFG.clusterRatio / G.clusters.length);
      const counts = G.clusters.map(function () { return 0; });
      for (const n of G.npcs) {
        if (n.stubborn) continue; // 頑固な人は人だかりに入らない
        let bi = -1;
        for (let k = 0; k < G.clusters.length; k++) if (counts[k] < per && (bi < 0 || counts[k] < counts[bi])) bi = k;
        if (bi < 0 || rng() < 0.25) continue;
        const c = G.clusters[bi], ang = rng() * Math.PI * 2, rad = 1.1 + rng() * 1.4;
        n.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, c.x + Math.sin(ang) * rad));
        n.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, c.z + Math.cos(ang) * rad));
        n.dir = Math.atan2(c.x - n.x, c.z - n.z);
        n.stand = true;
        counts[bi]++;
      }
    }
    ev('stage', { stage: idx });
  };

  function clampArena(o, m) {
    const lim = ARENA - (m || 0.6);
    if (o.x < -lim) o.x = -lim; if (o.x > lim) o.x = lim;
    if (o.z < -lim) o.z = -lim; if (o.z > lim) o.z = lim;
  }

  function infect(npc) {
    npc.state = 'dancer';
    npc.exposure = 0; npc.cureProg = 0;
    G.totalInfectedEver++;
    if (G.elapsed - G.lastInfectAt <= CFG.chainWindow) G.chain++;
    else G.chain = 1;
    G.lastInfectAt = G.elapsed;
    if (G.chain > G.maxChain) G.maxChain = G.chain;
    if (G.chain === CFG.feverChain && G.fever <= 0) {
      G.fever = CFG.feverTime;
      ev('fever', {});
    }
    const pts = 100 + (G.chain - 1) * 30;
    G.score += pts;
    ev('infect', { id: npc.id, x: npc.x, z: npc.z, chain: G.chain, pts: pts });
    if (G.infectedCount() >= G.totalNpc) {
      const bonus = Math.ceil(G.timeLeft) * 10 + G.hearts * 200;
      G.score += bonus;
      G.lastClearBonus = bonus;
      G.phase = (G.stageIdx >= STAGES.length - 1) ? 'goal' : 'clear';
      ev(G.phase === 'goal' ? 'goal' : 'clear', { bonus: bonus });
    }
  }

  G.update = function (dt, input) {
    if (G.phase !== 'play') return;
    if (dt > 0.05) dt = 0.05;
    G.elapsed += dt;
    G.timeLeft -= dt;
    if (G.fever > 0) G.fever -= dt;
    if (G.timeLeft <= 0) {
      G.timeLeft = 0;
      G.phase = 'over'; G.overReason = 'time';
      ev('over', { reason: 'time' });
      return;
    }
    const P = G.player;
    if (P.invuln > 0) P.invuln -= dt;

    // --- プレイヤー移動 ---
    let mx = (input && input.x) || 0, mz = (input && input.z) || 0;
    const ml = Math.hypot(mx, mz);
    P.moving = ml > 0.01;
    if (P.moving) {
      mx /= (ml > 1 ? ml : 1); mz /= (ml > 1 ? ml : 1);
      P.x += mx * CFG.playerSpeed * dt;
      P.z += mz * CFG.playerSpeed * dt;
      P.face = Math.atan2(mx, mz);
      clampArena(P);
    }

    // --- NPC移動 ---
    for (const n of G.npcs) {
      n.dirT -= dt;
      if (n.dirT <= 0) { n.dir = rng() * Math.PI * 2; n.dirT = 1.5 + rng() * 3; }
      if (n.immune > 0) n.immune -= dt;
      if (n.stand && n.state === 'walk') continue; // 人だかりの人はその場に留まる
      const sp = n.state === 'dancer' ? CFG.dancerSpeed : CFG.npcSpeed;
      n.x += Math.sin(n.dir) * sp * dt;
      n.z += Math.cos(n.dir) * sp * dt;
      if (n.x < -ARENA + 0.6) { n.x = -ARENA + 0.6; n.dir = Math.PI / 2 + (rng() - 0.5); }
      if (n.x > ARENA - 0.6) { n.x = ARENA - 0.6; n.dir = -Math.PI / 2 + (rng() - 0.5); }
      if (n.z < -ARENA + 0.6) { n.z = -ARENA + 0.6; n.dir = (rng() - 0.5); }
      if (n.z > ARENA - 0.6) { n.z = ARENA - 0.6; n.dir = Math.PI + (rng() - 0.5); }
    }
    // 軽い押し分け(重なり防止)
    for (let i = 0; i < G.npcs.length; i++) {
      for (let j = i + 1; j < G.npcs.length; j++) {
        const a = G.npcs[i], b = G.npcs[j];
        const d2 = dist2(a.x, a.z, b.x, b.z);
        if (d2 < 0.81 && d2 > 0.0001) {
          const d = Math.sqrt(d2), push = (0.9 - d) / 2;
          const ux = (b.x - a.x) / d, uz = (b.z - a.z) / d;
          const am = (a.stand && a.state === 'walk') ? 0 : 1;
          const bm = (b.stand && b.state === 'walk') ? 0 : 1;
          if (am) { const k = bm ? 1 : 2; a.x -= ux * push * k; a.z -= uz * push * k; }
          if (bm) { const k = am ? 1 : 2; b.x += ux * push * k; b.z += uz * push * k; }
        }
      }
    }

    // --- 感染判定 ---
    const sources = [{ x: P.x, z: P.z }];
    for (const n of G.npcs) if (n.state === 'dancer') sources.push(n);
    const fR = CFG.infectR * (G.fever > 0 ? CFG.feverRadiusMul : 1);
    const R2 = fR * fR;
    for (const n of G.npcs) {
      if (n.state !== 'walk' || n.immune > 0) continue;
      let near = false;
      for (const s of sources) { if (dist2(n.x, n.z, s.x, s.z) <= R2) { near = true; break; } }
      const need = n.stubborn ? CFG.stubbornNeed : CFG.exposeNeed;
      if (near) {
        n.exposure += dt / need * (G.fever > 0 ? CFG.feverExposeMul : 1);
        if (n.exposure >= 1) infect(n);
      } else if (n.exposure > 0) {
        n.exposure = Math.max(0, n.exposure - dt * CFG.exposeDecay / need);
      }
    }
    if (G.phase !== 'play') return; // 全員感染でクリアした場合

    // --- 警備員AI ---
    for (const g of G.guards) {
      if (G.fever > 0) { // フィーバー中は警備員も踊る: 追跡も説教もしない
        if (g.targetId >= 0) { const tn = G.npcs[g.targetId]; if (tn) tn.cureProg = 0; g.targetId = -1; }
        g.cureT = 0; g.mode = 'dance';
        continue;
      }
      const dP = Math.hypot(P.x - g.x, P.z - g.z);
      if (g.mode === 'return') {
        const dh = Math.hypot(g.hx - g.x, g.hz - g.z);
        if (dh < 0.8) { g.mode = 'patrol'; g.waitT = 0.5; }
        else {
          g.x += (g.hx - g.x) / dh * CFG.guardSpeed * dt;
          g.z += (g.hz - g.z) / dh * CFG.guardSpeed * dt;
          g.face = Math.atan2(g.hx - g.x, g.hz - g.z);
        }
        continue;
      }
      if (P.invuln <= 0 && dP <= CFG.chaseSense) {
        g.mode = 'chase'; g.targetId = -1; g.cureT = 0;
        if (dP > 0.001) {
          g.x += (P.x - g.x) / dP * CFG.guardSpeed * dt;
          g.z += (P.z - g.z) / dP * CFG.guardSpeed * dt;
          g.face = Math.atan2(P.x - g.x, P.z - g.z);
        }
        if (dP <= CFG.catchR) {
          G.hearts--;
          P.invuln = CFG.invulnTime;
          g.mode = 'return';
          ev('catch', { hearts: G.hearts, x: P.x, z: P.z });
          if (G.hearts <= 0) {
            G.phase = 'over'; G.overReason = 'caught';
            ev('over', { reason: 'caught' });
            return;
          }
        }
        continue;
      }
      // 治療(説教)対象: 最寄りのダンサー。ただし他警備員が担当中の相手は避ける
      let target = null, best = Infinity;
      for (const n of G.npcs) {
        if (n.state !== 'dancer') continue;
        let taken = false;
        for (const o of G.guards) if (o !== g && o.targetId === n.id && o.mode === 'cure') taken = true;
        const d = dist2(g.x, g.z, n.x, n.z);
        if (d < best && !taken) { best = d; target = n; }
      }
      if (!target && g.targetId >= 0) {
        const n = G.npcs[g.targetId];
        if (n && n.state === 'dancer') target = n;
      }
      if (target) {
        g.mode = 'cure'; g.targetId = target.id;
        const d = Math.sqrt(best === Infinity ? dist2(g.x, g.z, target.x, target.z) : best);
        if (d > CFG.cureR) {
          g.cureT = 0; target.cureProg = 0;
          g.x += (target.x - g.x) / d * CFG.guardSpeed * dt;
          g.z += (target.z - g.z) / d * CFG.guardSpeed * dt;
          g.face = Math.atan2(target.x - g.x, target.z - g.z);
        } else {
          g.face = Math.atan2(target.x - g.x, target.z - g.z);
          g.cureT += dt;
          target.cureProg = Math.min(1, g.cureT / CFG.cureTime);
          if (g.cureT >= CFG.cureTime) {
            target.state = 'walk';
            target.immune = CFG.immunityTime;
            target.cureProg = 0; target.exposure = 0;
            g.targetId = -1; g.cureT = 0;
            ev('cure', { id: target.id, x: target.x, z: target.z });
          }
        }
      } else {
        g.mode = 'patrol'; g.targetId = -1;
        if (g.waitT > 0) { g.waitT -= dt; }
        else {
          const d = Math.hypot(g.tx - g.x, g.tz - g.z);
          if (d < 1) { g.tx = (rng() * 2 - 1) * 20; g.tz = (rng() * 2 - 1) * 20; g.waitT = 1 + rng() * 2; }
          else {
            g.x += (g.tx - g.x) / d * CFG.guardPatrolSpeed * dt;
            g.z += (g.tz - g.z) / d * CFG.guardPatrolSpeed * dt;
            g.face = Math.atan2(g.tx - g.x, g.tz - g.z);
          }
        }
      }
    }
  };

  return G;
}

function rankFor(score) {
  if (score >= 75000) return 'ダンシングマニア';
  if (score >= 50000) return '踊りの感染源';
  if (score >= 28000) return '広場のスター';
  if (score >= 10000) return 'かけだしダンサー';
  return 'ただの通行人';
}

globalThis.__DM__ = { STAGES: STAGES, CFG: CFG, ARENA: ARENA, createGame: createGame, rankFor: rankFor, mulberry32: mulberry32 };
})();
