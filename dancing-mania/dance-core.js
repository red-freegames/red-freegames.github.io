// 『ダンシングマニア』ロジックコア: THREE/DOM非依存。描画は dance-ui.js。
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

// ステージは配列の順に遊ぶ。ステージを足すときは STAGES と dance-ui.js の THEMES / STAGE_HINT / gimmickText / buildWorld に1件ずつ足す。
// gimmick:
//   'train'   電車が着くたびに改札から客がまとめて出てくる(全員到着までクリア不可)
//   'couple'  新郎新婦を踊らせると周りが一斉に踊る
//   'yagura'  やぐらの周りを人が回る。太鼓が鳴っている間は感染範囲が広がる
//   'rain'    にわか雨の間、通行人がアーケードの下に集まる
//   'walkway' 動く歩道。乗った人(プレイヤー・警備員も)は流される
//   'bell'    昼休み終了のチャイム後、通行人がオフィスの入口へ戻り始める(入られると時間が減る)
//   'band'    雇われた楽団が広場を回り、近くの人を踊らせる
// obstacles: [x, z, 半径] の円柱障害物
// 人数は描画プール NPC_MAX(dance-ui.js) 以下にすること
const STAGES = [
  { name: '駅前広場',        sub: '平日の昼休み',   npc: 60, stubborn: 9,  guards: 1, time: 65, clusters: 3, dj: 1, kids: 3,
    gimmick: 'train', arrivals: [{ at: 12, n: 8 }, { at: 27, n: 8 }] },
  { name: '結婚式の披露宴',  sub: 'ご両家とも困惑', npc: 80, stubborn: 12, guards: 2, time: 75, clusters: 4, dj: 2, kids: 4,
    gimmick: 'couple' },
  { name: '夏祭りの境内',    sub: '盆踊りの夜',     npc: 90, stubborn: 14, guards: 2, time: 75, clusters: 3, dj: 2, kids: 6,
    gimmick: 'yagura', obstacles: [[0, 0, 2.6]], clusterRatio: 0.25, orbitRatio: 0.7, drumFirst: 6, drumEvery: 9, drumDur: 2.4, drumMul: 1.45 },
  { name: '雨の商店街',      sub: 'にわか雨にご注意', npc: 100, stubborn: 15, guards: 2, time: 80, clusters: 2, dj: 2, kids: 5,
    gimmick: 'rain', shelters: [[-23, -12], [-23, 12], [23, -12], [23, 12]], rainFirst: 8, rainDry: 12, rainWet: 7 },
  { name: '空港ロビー',      sub: '搭乗まであと少し', npc: 110, stubborn: 17, guards: 2, time: 85, clusters: 3, dj: 3, kids: 5,
    gimmick: 'walkway', walkways: [{ z: -9, x0: -23, x1: 23, w: 3.2, v: 6 }, { z: 9, x0: -23, x1: 23, w: 3.2, v: -6 }] },
  { name: 'オフィス街の広場', sub: '昼休み終了間近', npc: 120, stubborn: 18, guards: 3, time: 90, clusters: 5, dj: 3, kids: 6,
    gimmick: 'bell', bellAt: 40 },
  { name: '1518年 大聖堂前広場', sub: '楽団が呼ばれた', npc: 130, stubborn: 20, guards: 3, time: 100, clusters: 3, dj: 3, kids: 6,
    gimmick: 'band', obstacles: [[0, 0, 2.2]], bandR: 15, bandSpeed: 2.4, bandInfectR: 4 },
];

// 称号(高い順)。人数増(60〜130人)後、7ステージ通しのボットの中央値が約100万点・最大約118万点。
const RANKS = [
  { min: 1100000, name: 'ダンシングマニア' },
  { min: 750000,  name: '踊りの感染源' },
  { min: 400000,  name: '広場のスター' },
  { min: 150000,  name: 'かけだしダンサー' },
  { min: 0,      name: 'ただの通行人' },
];
// 踊りの解放: ベストスコアが unlock(=称号のライン) 以上で選べる。選んだ踊りは全ダンサーが踊る(シンクロは維持)
const DANCES = [
  { id: 'basic', name: 'へんな踊り',     unlock: RANKS[4].min, desc: '効果なし。すべての始まり', fx: {} },
  { id: 'robot', name: 'ロボットダンス', unlock: RANKS[3].min, desc: '自分の感染範囲 +12%',     fx: { playerRMul: 1.12 } },
  { id: 'bon',   name: '盆踊り',         unlock: RANKS[2].min, desc: '連鎖の猶予 +0.8秒',       fx: { chainAdd: 0.8 } },
  { id: 'twist', name: 'ツイスト',       unlock: RANKS[1].min, desc: '移動速度 +8%',            fx: { speedMul: 1.08 } },
  { id: 'mania', name: 'マニアの舞',     unlock: RANKS[0].min, desc: 'フィーバー時間 +2秒',     fx: { feverAdd: 2 } },
];
function danceById(id) { for (const d of DANCES) if (d.id === id) return d; return DANCES[0]; }
function unlockedDances(best) { return DANCES.filter(function (d) { return (best || 0) >= d.unlock; }); }

const CFG = {
  playerSpeed: 9.4,
  npcSpeed: 2.3,
  dancerSpeed: 1.35,
  guardSpeed: 7.0,
  guardPatrolSpeed: 3.2,
  infectR: 3.0,
  exposeNeed: 0.7,        // 通常の人が感染するまでの滞在秒数
  stubbornNeed: 1.8,      // 頑固な人
  exposeDecay: 1.6,       // 範囲外での減衰(秒換算)
  chainWindow: 2.5,
  catchR: 1.3,
  chaseSense: 11,         // 警備員がプレイヤーを追い始める距離
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
  // 特別な通行人
  djRMul: 1.7,          // DJ が踊った時の感染範囲倍率
  djSpeed: 1.4, djDancerSpeed: 1.0,
  kidSpeed: 3.6, kidDancerSpeed: 3.0,
  // ステージの仕掛け
  coupleBurstR: 9,      // 新郎新婦が踊り出した時に一斉感染させる半径
  coupleTable: [0, -17],
  gate: [0, -25.5],     // 駅の改札
  doors: [[-14, -26], [14, -26]], // オフィスの入口
  leaveSpeed: 2.6,      // チャイム後に入口へ向かう速さ
  escapePenalty: 3,     // 入口に入られると減る秒数
  // 波モード(試作, createGame(seed, { wave: true })):
  // 新しく踊り出した人は waveDelay 秒後に1回だけ「パルス」を出し、円の中の通行人を即座に踊らせる。
  // 踊り出した人がまたパルスを出すので、ドミノのように波が広がる。
  waveDelay: 0.2,        // 踊り出してからパルスまでの秒数(波の進む速さ)
  wavePulseMul: 1.0,     // パルスの半径(感染範囲に対する倍率)
  waveStubbornHit: 0.5,  // 頑固な人はパルス1回でこれだけ溜まる(2回で踊る)
  waveDancerRate: 1.0,   // 波モードでの、踊っている通行人の「近くにいる」感染の速さ(1=いつもどおり。波は上乗せ)
};

function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
function pushOut(o, obs, rad) { // 円柱障害物から押し出す
  if (!obs) return;
  for (const b of obs) {
    const dx = o.x - b[0], dz = o.z - b[1], d = Math.hypot(dx, dz), m = b[2] + rad;
    if (d < m) { if (d < 0.001) { o.z = b[1] + m; } else { o.x = b[0] + dx / d * m; o.z = b[1] + dz / d * m; } }
  }
}
function onWalkway(o, w) { return Math.abs(o.z - w.z) < w.w / 2 && o.x >= w.x0 && o.x <= w.x1; }

function createGame(seed, opts) {
  const rng = mulberry32(seed >>> 0 || 1);
  const dance = danceById(opts && opts.dance);
  let waveSeq = 0;
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
    dance: dance,
    chainWin: CFG.chainWindow + (dance.fx.chainAdd || 0),
    arrivals: [],   // 駅: 未到着の電車 [{at, ids}]
    bellRung: false,
    escaped: 0,
    drum: 0, nextDrumAt: 0,   // 夏祭り: 太鼓の残り秒 / 次の太鼓
    rain: 0, nextRainAt: 0,   // 商店街: 雨の残り秒 / 次の雨
    band: [],                 // 大聖堂: 楽団 [{x, z, a}]
    wave: !!(opts && opts.wave), // 波モード(試作)
    pulses: [],               // 波モード: 予約されたパルス [{id, at, waveId}]
    waveSize: {},             // 波ごとの人数 {waveId: n}
    maxWave: 0,               // このプレイで一番大きかった波
    stats: { player: 0, pulse: 0, dancer: 0, other: 0 }, // 何で踊り出したか(調整用)
  };

  function ev(type, data) { G.events.push(Object.assign({ type: type }, data || {})); }

  G.drainEvents = function () { const e = G.events; G.events = []; return e; };

  G.infectedCount = function () {
    let n = 0; for (const p of G.npcs) if (p.state === 'dancer') n++;
    return n;
  };

  G.chainTimeLeft = function () {
    if (G.chain <= 0) return 0;
    return Math.max(0, G.chainWin - (G.elapsed - G.lastInfectAt));
  };

  G.nextTrainIn = function () { return G.arrivals.length ? Math.max(0, G.arrivals[0].at - G.elapsed) : -1; };
  G.bellIn = function () { const st = STAGES[G.stageIdx]; return st.gimmick === 'bell' && !G.bellRung ? Math.max(0, st.bellAt - G.elapsed) : -1; };
  G.radiusOf = function (n) { return n.kind === 'dj' ? CFG.djRMul : 1; };
  G.stage = function () { return STAGES[G.stageIdx]; };
  G.nextDrumIn = function () { return G.stage().gimmick === 'yagura' ? Math.max(0, G.nextDrumAt - G.elapsed) : -1; };
  G.nextRainIn = function () { return G.stage().gimmick === 'rain' ? Math.max(0, G.nextRainAt - G.elapsed) : -1; };

  function blocked(x, z, pad) { // 障害物・動く歩道の上か
    const st = STAGES[G.stageIdx];
    for (const b of (st.obstacles || [])) if (dist2(x, z, b[0], b[1]) < Math.pow(b[2] + pad, 2)) return true;
    for (const w of (st.walkways || [])) if (Math.abs(z - w.z) < w.w / 2 + pad && x > w.x0 - pad && x < w.x1 + pad) return true;
    return false;
  }

  G.startStage = function (idx) {
    const st = STAGES[idx];
    G.arrivals = []; G.bellRung = false; G.escaped = 0;
    G.pulses = []; G.waveSize = {};
    G.drum = 0; G.nextDrumAt = st.drumFirst || 0;
    G.rain = 0; G.nextRainAt = st.rainFirst || 0;
    G.band = [];
    if (st.gimmick === 'band') for (let i = 0; i < 3; i++) G.band.push({ a: Math.PI - i * 0.13, x: 0, z: 0, face: 0 });
    for (const b of G.band) { b.x = Math.sin(b.a) * st.bandR; b.z = Math.cos(b.a) * st.bandR; }
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
      while ((dist2(x, z, G.player.x, G.player.z) < 25 || blocked(x, z, 1)) && tries < 30);
      const dir = rng() * Math.PI * 2;
      G.npcs.push({
        id: i, x: x, z: z, dir: dir, dirT: 1 + rng() * 3,
        state: 'walk', exposure: 0, stubborn: i < st.stubborn, stand: false,
        immune: 0, cureProg: 0, walkPhase: rng() * Math.PI * 2,
        colorIdx: (rng() * 8) | 0, kind: 'normal', leaving: false, burstUsed: false,
      });
    }
    // 特別な通行人: 頑固な人の後ろの番号に DJ・子ども・(披露宴なら)新郎新婦を割り当てる
    let k = st.stubborn;
    for (let i = 0; i < (st.dj || 0); i++) G.npcs[k++].kind = 'dj';
    for (let i = 0; i < (st.kids || 0); i++) { const n = G.npcs[k++]; n.kind = 'kid'; n.dirT = 0.5 + rng(); }
    if (st.gimmick === 'couple') {
      const tx = CFG.coupleTable[0], tz = CFG.coupleTable[1];
      ['bride', 'groom'].forEach(function (kind, j) {
        const n = G.npcs[k++];
        n.kind = kind; n.stubborn = true; n.stand = true;
        n.x = tx + (j ? 0.8 : -0.8); n.z = tz; n.dir = 0; // 客席(南)を向く
      });
    }
    // 駅: 後ろの番号の普通の人を「まだ電車の中」にしておく
    if (st.gimmick === 'train') {
      let last = G.npcs.length - 1;
      for (const a of st.arrivals) {
        const ids = [];
        for (let i = 0; i < a.n; i++) {
          while (last >= 0 && G.npcs[last].kind !== 'normal') last--;
          const n = G.npcs[last--];
          n.state = 'away'; n.x = CFG.gate[0]; n.z = -40;
          ids.push(n.id);
        }
        G.arrivals.push({ at: a.at, ids: ids });
      }
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
      if (st.gimmick === 'couple' && dist2(cx, cz, CFG.coupleTable[0], CFG.coupleTable[1]) < 100) continue;
      if (blocked(cx, cz, 4.5)) continue;
      if (st.gimmick === 'yagura' && dist2(cx, cz, 0, 0) < 121) continue; // やぐらの周りの通り道は空けておく
      let okC = true;
      for (const c of G.clusters) if (dist2(cx, cz, c.x, c.z) < 121) okC = false;
      if (okC) G.clusters.push({ x: cx, z: cz });
    }
    if (G.clusters.length) {
      const per = Math.ceil(st.npc * (st.clusterRatio || CFG.clusterRatio) / G.clusters.length);
      const counts = G.clusters.map(function () { return 0; });
      for (const n of G.npcs) {
        if (n.stubborn || n.kind !== 'normal' || n.state !== 'walk') continue; // 頑固な人・特別な人・未到着の人は人だかりに入らない
        let bi = -1;
        for (let k = 0; k < G.clusters.length; k++) if (counts[k] < per && (bi < 0 || counts[k] < counts[bi])) bi = k;
        if (bi < 0 || rng() < 0.25) continue;
        const c = G.clusters[bi], ang = rng() * Math.PI * 2, rad = 1.1 + rng() * (0.6 + Math.sqrt(per) * 0.45); // 人数が多いほど人だかりも広く
        n.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, c.x + Math.sin(ang) * rad));
        n.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, c.z + Math.cos(ang) * rad));
        n.dir = Math.atan2(c.x - n.x, c.z - n.z);
        n.stand = true;
        counts[bi]++;
      }
    }
    if (st.gimmick === 'yagura') { // やぐらの周りを回る人
      for (const n of G.npcs) {
        if (n.stand || n.kind !== 'normal' || n.stubborn || rng() > st.orbitRatio) continue;
        n.orbit = 7 + rng() * 6;
        const a = rng() * Math.PI * 2; n.x = Math.sin(a) * n.orbit; n.z = Math.cos(a) * n.orbit;
      }
    }
    ev('stage', { stage: idx });
  };

  function clampArena(o, m) {
    const lim = ARENA - (m || 0.6);
    if (o.x < -lim) o.x = -lim; if (o.x > lim) o.x = lim;
    if (o.z < -lim) o.z = -lim; if (o.z > lim) o.z = lim;
  }

  // cause: 'player' | 'dancer' | 'pulse' | 'other'。waveId は同じ波の仲間(省略で新しい波)
  function infect(npc, cause, waveId) {
    npc.state = 'dancer';
    npc.exposure = 0; npc.cureProg = 0;
    G.totalInfectedEver++;
    G.stats[cause || 'other']++;
    if (waveId === undefined) waveId = ++waveSeq;
    npc.waveId = waveId;
    const wn = G.waveSize[waveId] = (G.waveSize[waveId] || 0) + 1;
    if (wn > G.maxWave) G.maxWave = wn;
    if (G.wave) G.pulses.push({ id: npc.id, at: G.elapsed + CFG.waveDelay, waveId: waveId });
    if (G.elapsed - G.lastInfectAt <= G.chainWin) G.chain++;
    else G.chain = 1;
    G.lastInfectAt = G.elapsed;
    if (G.chain > G.maxChain) G.maxChain = G.chain;
    if (G.chain === CFG.feverChain && G.fever <= 0) {
      G.fever = CFG.feverTime + (G.dance.fx.feverAdd || 0);
      ev('fever', {});
    }
    const pts = 100 + (G.chain - 1) * 30;
    G.score += pts;
    ev('infect', { id: npc.id, x: npc.x, z: npc.z, chain: G.chain, pts: pts, kind: npc.kind, wave: wn });
    // 新郎新婦: 踊り出した瞬間、周りの客が一斉に踊り出す(1人につき1回だけ)
    if ((npc.kind === 'bride' || npc.kind === 'groom') && !npc.burstUsed) {
      npc.burstUsed = true;
      const R2 = CFG.coupleBurstR * CFG.coupleBurstR;
      const hit = G.npcs.filter(function (o) { return o.state === 'walk' && o.immune <= 0 && dist2(o.x, o.z, npc.x, npc.z) <= R2; });
      ev('burst', { x: npc.x, z: npc.z, n: hit.length, kind: npc.kind });
      for (const o of hit) { if (G.phase !== 'play') break; if (o.state === 'walk') infect(o, 'other', waveId); }
    }
    checkClear();
  }

  function checkClear() {
    if (G.phase !== 'play' || G.arrivals.length) return;
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
      const ps = CFG.playerSpeed * (G.dance.fx.speedMul || 1);
      P.x += mx * ps * dt;
      P.z += mz * ps * dt;
      P.face = Math.atan2(mx, mz);
      clampArena(P);
    }

    // --- ステージの仕掛け ---
    while (G.arrivals.length && G.elapsed >= G.arrivals[0].at) { // 電車が着いた
      const a = G.arrivals.shift();
      a.ids.forEach(function (id, j) {
        const n = G.npcs[id];
        n.state = 'walk'; n.exposure = 0; n.stand = false;
        n.x = CFG.gate[0] + (j - (a.ids.length - 1) / 2) * 1.3; n.z = CFG.gate[1];
        n.dir = Math.PI + (rng() - 0.5) * 0.9; // 南(広場の中)へ
        n.dirT = 2 + rng() * 2;
      });
      ev('train', { n: a.ids.length, x: CFG.gate[0], z: CFG.gate[1], left: G.arrivals.length });
    }
    const st = STAGES[G.stageIdx];
    if (st.gimmick === 'yagura') {
      if (G.drum > 0) G.drum -= dt;
      if (G.elapsed >= G.nextDrumAt) { G.drum = st.drumDur; G.nextDrumAt += st.drumEvery; ev('drum', {}); }
    }
    if (st.gimmick === 'rain') {
      if (G.rain > 0) {
        G.rain -= dt;
        if (G.rain <= 0) { // 雨上がり: 散っていく
          G.rain = 0;
          for (const n of G.npcs) if (n.shelter) { n.shelter = null; n.dir = rng() * Math.PI * 2; n.dirT = 1 + rng() * 2; }
          ev('rain', { on: false });
        }
      } else if (G.elapsed >= G.nextRainAt) {
        G.rain = st.rainWet; G.nextRainAt += st.rainWet + st.rainDry;
        ev('rain', { on: true });
      }
    }
    if (st.gimmick === 'band') {
      for (const b of G.band) {
        b.a += st.bandSpeed / st.bandR * dt;
        const nx = Math.sin(b.a) * st.bandR, nz = Math.cos(b.a) * st.bandR;
        b.face = Math.atan2(nx - b.x, nz - b.z); b.x = nx; b.z = nz;
      }
    }
    if (st.gimmick === 'bell' && !G.bellRung && G.elapsed >= st.bellAt) {
      G.bellRung = true;
      for (const n of G.npcs) if (n.state === 'walk') { n.leaving = true; n.stand = false; }
      ev('bell', {});
    }

    // --- NPC移動 ---
    for (const n of G.npcs) {
      if (n.state === 'away' || n.state === 'gone') continue;
      n.dirT -= dt;
      if (n.dirT <= 0) { n.dir = rng() * Math.PI * 2; n.dirT = n.kind === 'kid' ? 0.6 + rng() * 1.4 : 1.5 + rng() * 3; }
      if (n.immune > 0) n.immune -= dt;
      if (G.bellRung && n.state === 'walk' && n.kind !== 'bride' && n.kind !== 'groom') { // チャイム後: 最寄りの入口へ
        n.leaving = true; n.stand = false;
        let dx = 0, dz = 0, bd = Infinity;
        for (const d of CFG.doors) { const q = dist2(n.x, n.z, d[0], d[1]); if (q < bd) { bd = q; dx = d[0]; dz = d[1]; } }
        if (bd < 1.44) {
          n.state = 'gone'; G.totalNpc--; G.escaped++;
          G.timeLeft -= CFG.escapePenalty;
          ev('escape', { id: n.id, x: n.x, z: n.z });
          continue;
        }
        n.dir = Math.atan2(dx - n.x, dz - n.z);
        const ls = n.kind === 'kid' ? CFG.kidSpeed : CFG.leaveSpeed;
        n.x += Math.sin(n.dir) * ls * dt; n.z += Math.cos(n.dir) * ls * dt;
        continue;
      }
      if (n.stand && n.state === 'walk') continue; // 人だかりの人はその場に留まる
      if (G.rain > 0 && n.state === 'walk') { // 雨宿り: 最寄りのアーケードへ走り、その下で止まる
        if (!n.shelter) {
          let bs = null, bd = Infinity;
          for (const sh of st.shelters) { const q = dist2(n.x, n.z, sh[0], sh[1]); if (q < bd) { bd = q; bs = sh; } }
          const ja = rng() * Math.PI * 2, jr = 0.6 + rng() * 1.8;
          n.shelter = { x: bs[0] + Math.sin(ja) * jr * 0.6, z: bs[1] + Math.cos(ja) * jr * 1.4 };
        }
        const dx = n.shelter.x - n.x, dz = n.shelter.z - n.z, d = Math.hypot(dx, dz);
        if (d > 0.25) { n.dir = Math.atan2(dx, dz); const rs = Math.min(d, (n.kind === 'kid' ? CFG.kidSpeed : 3.4) * dt); n.x += dx / d * rs; n.z += dz / d * rs; }
        continue;
      }
      if (n.orbit && n.state === 'walk') { // やぐらの周りを反時計回りに歩く
        const d = Math.hypot(n.x, n.z) || 1;
        const tx = n.z / d, tz = -n.x / d, corr = (n.orbit - d) * 0.35;
        n.dir = Math.atan2(tx + n.x / d * corr, tz + n.z / d * corr);
        n.x += Math.sin(n.dir) * CFG.npcSpeed * dt; n.z += Math.cos(n.dir) * CFG.npcSpeed * dt;
        continue;
      }
      const dancing = n.state === 'dancer';
      const sp = n.kind === 'kid' ? (dancing ? CFG.kidDancerSpeed : CFG.kidSpeed)
        : n.kind === 'dj' ? (dancing ? CFG.djDancerSpeed : CFG.djSpeed)
        : (dancing ? CFG.dancerSpeed : CFG.npcSpeed);
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
        if (a.state === 'away' || a.state === 'gone' || b.state === 'away' || b.state === 'gone') continue;
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

    // 動く歩道と障害物
    for (const w of (st.walkways || [])) {
      if (onWalkway(P, w)) P.x += w.v * dt;
      for (const n of G.npcs) if (n.state !== 'away' && n.state !== 'gone' && onWalkway(n, w)) n.x += w.v * dt;
      for (const g of G.guards) if (onWalkway(g, w)) g.x += w.v * dt;
    }
    if (st.obstacles || st.walkways) {
      pushOut(P, st.obstacles, 0.5); clampArena(P);
      for (const n of G.npcs) { if (n.state === 'away' || n.state === 'gone') continue; pushOut(n, st.obstacles, 0.45); clampArena(n); }
      for (const g of G.guards) { pushOut(g, st.obstacles, 0.5); clampArena(g); }
    }

    // --- 感染判定 ---
    const fR = CFG.infectR * (G.fever > 0 ? CFG.feverRadiusMul : 1) * (G.drum > 0 ? st.drumMul : 1);
    const dRate = G.wave ? CFG.waveDancerRate : 1;
    const sources = [{ x: P.x, z: P.z, r2: Math.pow(fR * (G.dance.fx.playerRMul || 1), 2), rate: 1, cause: 'player' }];
    for (const n of G.npcs) if (n.state === 'dancer') sources.push({ x: n.x, z: n.z, r2: Math.pow(fR * G.radiusOf(n), 2), rate: dRate, cause: 'dancer' });
    for (const b of G.band) sources.push({ x: b.x, z: b.z, r2: st.bandInfectR * st.bandInfectR, rate: 1, cause: 'other' });
    for (const n of G.npcs) {
      if (n.state !== 'walk' || n.immune > 0) continue;
      let rate = 0, cause = 'other';
      for (const s of sources) { if (s.rate > rate && dist2(n.x, n.z, s.x, s.z) <= s.r2) { rate = s.rate; cause = s.cause; if (rate >= 1) break; } }
      const need = n.stubborn ? CFG.stubbornNeed : CFG.exposeNeed;
      if (rate > 0) {
        n.exposure += dt / need * rate * (G.fever > 0 ? CFG.feverExposeMul : 1);
        if (n.exposure >= 1) infect(n, cause);
      } else if (n.exposure > 0) {
        n.exposure = Math.max(0, n.exposure - dt * CFG.exposeDecay / need);
      }
      if (G.phase !== 'play') return;
    }
    // 波モード: 予約されたパルスを発火。円の中の通行人を即座に踊らせ、その人がまたパルスを予約する
    if (G.wave && G.pulses.length) {
      const due = G.pulses.filter(function (q) { return q.at <= G.elapsed; });
      if (due.length) G.pulses = G.pulses.filter(function (q) { return q.at > G.elapsed; });
      for (const q of due) {
        const src = G.npcs[q.id];
        if (!src || src.state !== 'dancer') continue; // パルス前に説教で正気に戻された
        const r = fR * G.radiusOf(src) * CFG.wavePulseMul, r2 = r * r;
        ev('pulse', { x: src.x, z: src.z, r: r, waveId: q.waveId, size: G.waveSize[q.waveId] || 0 });
        for (const o of G.npcs) {
          if (o.state !== 'walk' || o.immune > 0 || dist2(o.x, o.z, src.x, src.z) > r2) continue;
          if (o.stubborn) { o.exposure += CFG.waveStubbornHit; if (o.exposure >= 1) infect(o, 'pulse', q.waveId); }
          else infect(o, 'pulse', q.waveId);
          if (G.phase !== 'play') return;
        }
      }
    }
    if (G.phase !== 'play') return; // 全員感染でクリアした場合
    if (G.timeLeft <= 0) { // 入口に入られて時間が尽きた
      G.timeLeft = 0;
      G.phase = 'over'; G.overReason = 'time';
      ev('over', { reason: 'time' });
      return;
    }
    checkClear(); // 最後の通行人が入口に入り、残り全員が踊っている場合
    if (G.phase !== 'play') return;

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
  for (const r of RANKS) if (score >= r.min) return r.name;
  return RANKS[RANKS.length - 1].name;
}

globalThis.__DM__ = { STAGES: STAGES, CFG: CFG, ARENA: ARENA, RANKS: RANKS, DANCES: DANCES, danceById: danceById, unlockedDances: unlockedDances, createGame: createGame, rankFor: rankFor, mulberry32: mulberry32 };
})();
