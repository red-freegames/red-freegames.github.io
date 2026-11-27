/* 『ねえ、起きてる？』ボット：本物の index.html（ロジック＋UI）を仮想時計の上で走らせ、
   人間っぽいプレイヤーに大量プレイさせて結末分布と異常を集計する。
   使い方: node tests/bot.js [試行数=400]   （neoki ディレクトリから） */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const stubSrc = fs.readFileSync(path.join(__dirname, 'stub.js'), 'utf8');

/* 乱数（再現性のためシード付き） */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r){ return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }

function makeWorld(seed){
  const rng = mulberry32(seed);
  let now = 0, seq = 0; const q = [];
  const push = (t, fn, every) => { const id = ++seq; q.push({ t, fn, every, id }); return id; };
  const ctx = {
    console, Math: Object.create(Math), JSON, Object, Array, String, Number, Set, Map, Proxy, Error,
    encodeURIComponent,
    performance: { now: () => now },
    setTimeout: (fn, ms) => push(now + (ms || 0), fn, 0),
    setInterval: (fn, ms) => push(now + ms, fn, ms),
    clearTimeout: id => { const i = q.findIndex(e => e.id === id); if (i >= 0) q.splice(i, 1); },
  };
  ctx.Math.random = rng;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(stubSrc, ctx);
  vm.runInContext(blocks[0], ctx);
  vm.runInContext(blocks[1], ctx);
  const opened = []; ctx.window.open = u => { opened.push(u); return null; };
  function step(){
    q.sort((a, b) => a.t - b.t || a.id - b.id);
    const e = q.shift(); if (!e) return false;
    now = e.t;
    if (e.every) push(now + e.every, e.fn, e.every);
    e.fn();
    return true;
  }
  return { ctx, rng, step, now: () => now, push, opened, UI: ctx.__NK_UI__, L: ctx.__NK__, $: id => ctx.document.getElementById(id) };
}

/* プレイヤーモデル
   think: 1問の回答にかかる秒（平均、対数正規）
   good: 良い答えを選ぶ確率（人間は文面から大体わかる）
   policy: 'human' | 'good' | 'neutral' | 'worst' | 'random' | 'smart'
   azSigma: 相づちタイミングの誤差（秒）、azLag: 画面表示の遅れ分の押し遅れ（秒）
   slapAt: 眠気がこの値以上ならほっぺた */
function playOne(stage, P, seed){
  const W = makeWorld(seed);
  const { UI, L, rng } = W, NK = UI.NK;
  const anomalies = [];
  const tune = process.env.TUNE ? JSON.parse(process.env.TUNE) : {};
  Object.assign(L.STAGES[stage], tune[stage] || {});
  NK.pickStage(stage);
  NK.start();
  let pendingQ = -1, pendingAz = false;
  const log = { slaps: 0, azHit: 0, azMiss: 0, waves: 0, answers: { good: 0, mid: 0, bad: 0 } };
  let guard = 0;
  while (W.step()){
    if (++guard > 200000){ anomalies.push('stuck: no end after 200k events'); break; }
    const S = UI.state(), st = S.st;
    if (S.phase === 'end') break;
    if (W.now() > 20 * 60 * 1000){ anomalies.push('stuck: >20min call'); break; }
    /* 不変条件チェック */
    if (st.sleep > 100 || st.sleep < 0 || st.susp > 100 || st.susp < 0) anomalies.push('gauge out of range');
    const hb = W.$('honneBtn');
    if (hb.style.display === 'block' && S.phase !== 'question') anomalies.push('honne visible outside question');
    /* ほっぺた */
    if ((S.phase === 'question' || S.phase === 'aizuchi') && st.slapsLeft > 0 && st.sleep >= P.slapAt && st.susp < 90){
      NK.slap(); log.slaps++;
    }
    /* 回答予約 */
    if (S.phase === 'question' && pendingQ !== st.qi){
      pendingQ = st.qi;
      const t = Math.max(0.8, P.think * Math.exp(0.45 * gauss(rng)));
      const qi = st.qi;
      W.push(W.now() + t * 1000, () => {
        const S2 = UI.state(); if (S2.phase !== 'question' || S2.st.qi !== qi) return;
        const cur = S2.st.qs[qi];
        const idx = [0, 1, 2].sort((a, b) => cur.opts[a].d - cur.opts[b].d); /* 良→悪 */
        let pick;
        switch (P.policy){
          case 'good': pick = idx[0]; break;
          case 'neutral': pick = idx[1]; break;
          case 'worst': pick = idx[2]; break;
          case 'random': pick = Math.floor(rng() * 3); break;
          case 'breaker': { /* 甘えモードが続いたら無難な答えで切る */
            const s2 = S2.st; pick = (s2.streak >= P.breakAt && s2.susp < 45) ? idx[1] : idx[0]; break; }
          case 'smart': { /* 眠気が危ないなら悪い答えで目を覚ます */
            const s2 = S2.st; pick = (s2.sleep > 80 && s2.susp < 55) ? idx[2] : ((s2.sleep > 65 || s2.streak >= 3) && s2.susp < 60 ? idx[1] : idx[0]); break; }
          default: { const r = rng(); pick = r < P.good ? idx[0] : (r < P.good + (1 - P.good) * 0.7 ? idx[1] : idx[2]); }
        }
        const k = idx.indexOf(pick); log.answers[['good', 'mid', 'bad'][k]]++;
        NK.answer(pick);
      }, 0);
    }
    if (S.phase !== 'question') pendingQ = (S.phase === 'reaction' ? pendingQ : -1);
    /* 相づち予約：ゾーン中央を狙って誤差つきで押す */
    if (S.phase === 'aizuchi' && !pendingAz){
      pendingAz = true;
      const az = S.az, center = (az.a + az.b) / 2 * az.dur;
      const t = Math.max(0.05, center + P.azLag + P.azSigma * gauss(rng));
      W.push(az.t0 * 1000 + t * 1000, () => {
        const S2 = UI.state(); if (S2.phase !== 'aizuchi') return;
        NK.un();
        const ch = W.$('log').children; (ch[ch.length - 1].textContent.includes('成功')) ? log.azHit++ : log.azMiss++;
      }, 0);
    }
    if (S.phase !== 'aizuchi') pendingAz = false;
    if (S.waveOn && !log._w){ log.waves++; log._w = true; } if (!S.waveOn) log._w = false;
  }
  /* 進めきる（endGame の遅延 on 表示まで） */
  for (let i = 0; i < 50 && W.step(); i++){}
  const S = UI.state(), st = S.st;
  if (L.CLEAR_KINDS.includes(st.end) && st.sleep >= 100) anomalies.push('clear with sleep 100');
  if (L.CLEAR_KINDS.includes(st.end) && st.susp >= 100) anomalies.push('clear with susp 100');
  /* 到達表示の整合：結果画面とシェア文 */
  const stats = W.$('endStats').innerHTML;
  const m = stats.match(/到達：(\d+)問目/);
  NK.shareX();
  const tw = decodeURIComponent((W.opened[0] || '').split('text=')[1] || '');
  const m2 = tw.match(/、(\d+)問目で力尽き/);
  if (m && m2 && m[1] !== m2[1]) anomalies.push('reached mismatch: endStats ' + m[1] + ' vs share ' + m2[1] + ' (' + st.end + ')');
  return { title: S.title, fu: st.fuPass + st.fuFail, end: st.end, qi: st.qi, sleep: st.sleep, susp: st.susp, time: W.now() / 1000, log, anomalies, slapsLeft: st.slapsLeft };
}

function summarize(label, runs){
  const n = runs.length, c = {};
  const fam = { herSleep: 'clear', brink: 'clear', slapped: 'breakup' };
  runs.forEach(r => { const k = fam[r.end] || r.end; c[k] = (c[k] || 0) + 1; });
  const pct = k => ((c[k] || 0) / n * 100).toFixed(0).padStart(3) + '%';
  const avg = f => (runs.reduce((a, r) => a + f(r), 0) / n);
  const azT = avg(r => r.log.azHit + r.log.azMiss) || 1;
  const anoms = {}; runs.forEach(r => r.anomalies.forEach(a => { const k = a.replace(/\d+/g, '#'); anoms[k] = (anoms[k] || 0) + 1; }));
  console.log(label.padEnd(44) + ' clear' + pct('clear') + ' sleep' + pct('sleep') + ' breakup' + pct('breakup') + ' honne' + pct('honne') +
    ' | Q到達' + avg(r => r.qi).toFixed(1).padStart(5) + ' 通話' + avg(r => r.time).toFixed(0).padStart(4) + 's 相づち成功' + (avg(r => r.log.azHit) / azT * 100).toFixed(0) + '%' +
    (Object.keys(anoms).length ? '  ⚠ ' + JSON.stringify(anoms) : ''));
  return c;
}

const N = +(process.argv[2] || 400);
const ONLY = process.env.STAGE ? process.env.STAGE.split(',').map(Number) : [0, 1, 2];
const DETAIL = !!process.env.DETAIL;
const HUMAN = { policy: 'human', good: 0.8, think: 4, azSigma: 0.09, azLag: 0, slapAt: 85 };
const profiles = [
  ['上手い人（3秒・良答90%・ほっぺた85）', { ...HUMAN, think: 3, good: 0.9 }],
  ['普通の人（4秒・良答80%）', HUMAN],
  ['普通の人＋表示遅れ分押し遅れ(50ms)', { ...HUMAN, azLag: 0.05 }],
  ['じっくり読む人（7秒・良答90%）', { ...HUMAN, think: 7, good: 0.9 }],
  ['悩む人（10秒・良答90%）', { ...HUMAN, think: 10, good: 0.9 }],
  ['適当連打（1.2秒・ランダム）', { ...HUMAN, think: 1.2, policy: 'random' }],
  ['全問良答（3秒）', { ...HUMAN, think: 3, policy: 'good' }],
  ['全問無難（3秒）', { ...HUMAN, think: 3, policy: 'neutral' }],
  ['全問ワースト（3秒）', { ...HUMAN, think: 3, policy: 'worst' }],
  ['コンボ切り（4秒・3連続で無難）', { ...HUMAN, think: 4, policy: 'breaker', breakAt: 3 }],
  ['戦略家（3秒・眠い時は悪答で覚醒）', { ...HUMAN, think: 3, policy: 'smart' }],
  ['神（1.5秒・全問良答・相づち完璧）', { ...HUMAN, think: 1.5, policy: 'good', azSigma: 0.02, slapAt: 80 }],
];
for (const s of ONLY){
  console.log('\n===== ステージ' + (s + 1) + ' =====');
  for (const [name, P] of profiles){
    const runs = []; for (let i = 0; i < N; i++) runs.push(playOne(s, P, 1000 * s + i + 7));
    summarize(name, runs);
    if (DETAIL){
      const e = {}, t = {}; runs.forEach(r => { e[r.end] = (e[r.end] || 0) + 1; t[r.title] = (t[r.title] || 0) + 1; });
      console.log('    endings ' + JSON.stringify(e) + '  追及/回 ' + (runs.reduce((a, r) => a + r.fu, 0) / runs.length).toFixed(2));
      console.log('    titles  ' + JSON.stringify(t));
    }
  }
}
