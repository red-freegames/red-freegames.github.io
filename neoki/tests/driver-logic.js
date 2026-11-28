
/* ===== ロジック検証（b0.js の後ろに連結） ===== */
{
  const N = globalThis.__NK__;
  let fails = 0;
  const ck = (name, cond, extra) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra !== undefined ? ' => ' + extra : '')); if (!cond) fails++; };
  function mulberry32(a){ return function(){ a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const best = q => q.opts.reduce((a, b) => (b.d < a.d ? b : a));
  const worst = q => q.opts.reduce((a, b) => (b.d > a.d ? b : a));
  const mid = q => q.opts.slice().sort((a, b) => a.d - b.d)[1];
  /* 上手いプレイ＝良い答え中心、甘えモードが3連続したら無難な答えで切る */
  const play = st => (st.streak >= 3 && st.susp < 45 ? mid : best)(st.qs[st.qi]);

  /* データ健全性 */
  ck('pools = 40 / 50 / 50', N.POOLS.map(p => p.length).join() === '40,50,50', N.POOLS.map(p => p.length).join());
  ck('pools are disjoint (no shared question text)', new Set(N.QUESTIONS.map(q => q.q)).size === N.QUESTIONS.length);
  ck('each pool >= its totalQ (stage3 incl. traps)', N.STAGES.every((sd, i) => N.POOLS[i].length + (sd.rage ? N.TRAPS.length : 0) > sd.totalQ));
  ck('every stage has followup seeds >= fuMax', N.STAGES.every((sd, i) => N.POOLS[i].filter(q => q.opts.some(o => o.mem)).length >= sd.fuMax));
  ck('traps = 3', N.TRAPS.length === 3, N.TRAPS.length);
  ck('all questions have honne + 3 opts', N.QUESTIONS.concat(N.TRAPS).every(q => q.honne && q.opts.length === 3 && q.opts.every(o => o.t && o.r)));
  ck('every normal question has a good opt (d<0)', N.QUESTIONS.every(q => q.opts.some(o => o.d < 0)));
  ck('every trap opt raises susp (d>0)', N.TRAPS.every(q => q.opts.every(o => o.d > 0)));
  ck('aizuchi = 6', N.AIZUCHI.length === 6, N.AIZUCHI.length);
  ck('stages = 3', N.STAGES.length === 3 && N.STAGES[2].short === 'もう疲れた');

  /* 抽選：ステージごとに必要数・重複なし・最終は地雷プール込み */
  {
    const d1 = N.drawQuestions(0, mulberry32(7));
    const d2 = N.drawQuestions(1, mulberry32(7));
    const d3 = N.drawQuestions(2, mulberry32(7));
    ck('draw s1 = 10 unique, no traps', d1.length === 10 && new Set(d1).size === 10 && d1.every(q => !q.trap));
    ck('draws come only from own stage pool', d1.every(q => N.POOLS[0].includes(q)) && d2.every(q => N.POOLS[1].includes(q)) && d3.every(q => N.POOLS[2].includes(q) || N.TRAPS.includes(q)));
    ck('draw s2 = 15 unique, no traps', d2.length === 15 && new Set(d2).size === 15 && d2.every(q => !q.trap));
    ck('draw s3 = 18 unique with exactly 2 traps', d3.length === 18 && new Set(d3).size === 18 && d3.filter(q => q.trap).length === 2);
    const d3b = N.drawQuestions(2, mulberry32(99));
    ck('draw varies by seed', d3[0].q !== d3b[0].q || d3[1].q !== d3b[1].q);
  }

  /* ステージ別パラメータ */
  {
    const s1 = N.newState(0, []), s2 = N.newState(1, []), s3 = N.newState(2, []);
    ck('s1 params', s1.totalQ === 10 && s1.tick === 0.32 && s1.slapsLeft === 4 && s1.susp === 0);
    ck('s2 params', s2.totalQ === 15 && s2.tick === 0.32 && s2.slapsLeft === 3 && s2.susp === 0);
    ck('s3 params (rage)', s3.totalQ === 18 && s3.susp === 30 && s3.slapsLeft === 2 && s3.rage === true && s3.creep > 0);
  }

  /* ステージ2：上手いプレイ → クリア */
  {
    const qs = N.drawQuestions(1, mulberry32(42));
    const st = N.newState(1, qs);
    let end = null, slapped = false;
    for (let n = 0; n < st.totalQ && !end; n++){
      end = N.advanceTime(st, 4);
      if (end) break;
      end = N.applyAnswer(st, play(st), 4).end;
      if (!slapped && st.qi === 8){ N.applySlap(st); slapped = true; }
      if (!end && st.aizuchiAfter.includes(st.qi)){
        end = N.advanceTime(st, 3);
        if (!end) end = N.applyAizuchi(st, true);
      }
    }
    ck('s2 good player: clears', end === null && st.qi === 15, 'end=' + end + ' qi=' + st.qi);
    ck('s2 good player: susp low', st.susp <= 10, st.susp);
    ck('s2 good player: sleep 45..99', st.sleep >= 45 && st.sleep < 100, Math.round(st.sleep));
  }

  /* ステージ2：放置で寝落ち */
  {
    const st = N.newState(1, N.drawQuestions(1, mulberry32(1)));
    ck('idle 310s no end', N.advanceTime(st, 310) === null, Math.round(st.sleep));
    ck('idle 315s sleep end', N.advanceTime(st, 5) === 'sleep');
  }

  /* ステージ2：全問ワーストで破局 */
  {
    const st = N.newState(1, N.drawQuestions(1, mulberry32(3)));
    let end = null;
    for (let n = 0; n < st.totalQ && !end; n++){
      N.advanceTime(st, 3);
      end = N.applyAnswer(st, worst(st.qs[st.qi]), 3).end;
    }
    ck('s2 bad player: breakup before Q12', end === 'breakup' && st.qi <= 12, 'end=' + end + ' qi=' + st.qi);
  }

  /* ステージ2：全問無難＋相づち成功で生存 */
  {
    const st = N.newState(1, N.drawQuestions(1, mulberry32(5)));
    let end = null;
    for (let n = 0; n < st.totalQ && !end; n++){
      N.advanceTime(st, 3);
      end = N.applyAnswer(st, st.qs[st.qi].opts[1], 3).end;
      if (!end && st.aizuchiAfter.includes(st.qi)){ N.advanceTime(st, 2); end = N.applyAizuchi(st, true); }
    }
    ck('s2 neutral player: survives', end === null && st.qi === 15, 'end=' + end + ' susp=' + st.susp);
  }

  /* ステージ2：遅い返事のペナルティ／ほっぺた／相づち */
  {
    const st = N.newState(1, N.drawQuestions(1, mulberry32(9)));
    const r = N.applyAnswer(st, st.qs[0].opts[1], 12);
    ck('slow flagged + penalty 4+6', r.slow === true && st.susp === 10, st.susp);
    const st2 = N.newState(1, []);
    st2.sleep = 50;
    ck('slap effect', N.applySlap(st2) === true && st2.sleep === 38 && st2.susp === 5);
    N.applySlap(st2); N.applySlap(st2);
    ck('slap exhausted at 3 (s2)', N.applySlap(st2) === false && st2.slapsLeft === 0);
    const st3 = N.newState(1, []); st3.susp = 20;
    N.applyAizuchi(st3, true);
    ck('aizuchi hit -4', st3.susp === 16, st3.susp);
    N.applyAizuchi(st3, false);
    ck('aizuchi miss +7', st3.susp === 23, st3.susp);
  }

  /* ステージ3：怒り仕様（回復半減・イライラ蓄積） */
  {
    const st = N.newState(2, N.drawQuestions(2, mulberry32(11)));
    st.susp = 50;
    const q = st.qs[0].trap ? N.QUESTIONS[0] : st.qs[0];
    N.applyAnswer(st, best(q), 3);
    ck('s3 good answer only -3 (halved)', st.susp === 47, st.susp);
    const st2 = N.newState(2, []);
    N.advanceTime(st2, 10);
    ck('s3 creep +2.2 susp / +5.6 sleep in 10s', Math.abs(st2.susp - 32.2) < 0.01 && Math.abs(st2.sleep - 5.6) < 0.01, st2.susp + '/' + st2.sleep);
  }

  /* ステージ3：速い上手いプレイ＋ほっぺた活用ならクリア可能（理不尽だが不可能ではない） */
  {
    const qs = N.drawQuestions(2, mulberry32(42));
    const st = N.newState(2, qs);
    let end = null;
    for (let n = 0; n < st.totalQ && !end; n++){
      end = N.advanceTime(st, 2);
      if (end) break;
      end = N.applyAnswer(st, best(st.qs[st.qi]), 2).end;
      if (!end && st.sleep > 62 && st.slapsLeft > 0) N.applySlap(st);
      end = end || N.advanceTime(st, 1.7);
      if (!end && st.aizuchiAfter.includes(st.qi)){
        end = N.advanceTime(st, 3);
        if (!end) end = N.applyAizuchi(st, true);
      }
    }
    ck('s3 skilled player: can clear', end === null && st.qi === 18, 'end=' + end + ' qi=' + st.qi + ' sleep=' + Math.round(st.sleep) + ' susp=' + Math.round(st.susp) + ' traps=' + qs.filter(q => q.trap).length);
  }

  /* ステージ1：ゆるい（無難な回答でもクリアできる） */
  {
    const st = N.newState(0, N.drawQuestions(0, mulberry32(13)));
    let end = null;
    for (let n = 0; n < st.totalQ && !end; n++){
      N.advanceTime(st, 5);
      end = N.applyAnswer(st, st.qs[st.qi].opts[1], 5).end;
      if (!end && st.aizuchiAfter.includes(st.qi)){ N.advanceTime(st, 3); end = N.applyAizuchi(st, true); }
    }
    ck('s1 neutral player: clears', end === null && st.qi === 10, 'end=' + end + ' susp=' + st.susp + ' sleep=' + Math.round(st.sleep));
  }

  /* ===== 複合難易度：眠気の加速・波・機嫌 ===== */
  {
    const st = N.newState(1, []);
    ck('rate base x1', Math.abs(N.sleepRate(st, { phase:'question', qElapsed:0, callElapsed:0, wave:false }).mul - 1) < 1e-9);
    ck('rate: grace 4s then thinking 10s more doubles (s2)', Math.abs(N.sleepRate(st, { phase:'question', qElapsed:14, callElapsed:0, wave:false }).mul - 2) < 1e-9);
    ck('rate: no accel within grace', Math.abs(N.sleepRate(st, { phase:'question', qElapsed:4, callElapsed:0, wave:false }).mul - 1) < 1e-9);
    ck('rate: long call 300s doubles', Math.abs(N.sleepRate(st, { phase:'aizuchi', qElapsed:0, callElapsed:300, wave:false }).mul - 2) < 1e-9);
    ck('rate: wave x1.8', Math.abs(N.sleepRate(st, { phase:'aizuchi', qElapsed:0, callElapsed:0, wave:true }).mul - 1.8) < 1e-9);
    ck('rate: no q-accel outside question', Math.abs(N.sleepRate(st, { phase:'reaction', qElapsed:10, callElapsed:0, wave:false }).mul - 1) < 1e-9);
    ck('wave schedule s2', N.isWave(st, 44) === false && N.isWave(st, 46) === true && N.isWave(st, 54) === false && N.isWave(st, 100) === true && N.isWave(st, 109) === false);
  }
  {
    const st = N.newState(1, []);
    st.susp = 30;
    ck('mood doubt at 30', N.moodOf(st) === 'doubt');
    N.applyAnswer(st, { t:'x', d:4, s:0, r:'x' }, 3);
    ck('doubt: neutral answer +2 extra (30+6)', st.susp === 36, st.susp);
    st.susp = 60;
    ck('mood bad at 60', N.moodOf(st) === 'bad');
    N.applyAnswer(st, { t:'x', d:-6, s:0, r:'x' }, 3);
    ck('bad: good answer halved (60-3)', st.susp === 57, st.susp);
    st.susp = 29;
    ck('mood normal at 29', N.moodOf(st) === 'normal');
  }
  /* ctx付きシミュレーション（0.5秒刻みで加速を積算） */
  function simAdv(st, tm, sec, phase){
    let left = sec, end = null;
    while (left > 0 && !end){
      const step = Math.min(0.5, left);
      end = N.advanceTime(st, step, { phase: phase, qElapsed: tm.q, callElapsed: tm.t, wave: N.isWave(st, tm.t) });
      tm.t += step; if (phase === 'question') tm.q += step;
      left -= step;
    }
    return end;
  }
  {
    /* ステージ2：上手いプレイ（4秒回答）でも、加速込みだと眠気は旧フラット版より重い。それでもクリア可能 */
    const st = N.newState(1, N.drawQuestions(1, mulberry32(42)));
    const tm = { t: 0, q: 0 };
    let end = null, slapped = false;
    for (let n = 0; n < st.totalQ && !end; n++){
      tm.q = 0;
      end = simAdv(st, tm, 4, 'question');
      if (end) break;
      end = N.applyAnswer(st, play(st), 4).end;
      if (!slapped && st.qi === 8){ N.applySlap(st); slapped = true; }
      end = end || simAdv(st, tm, 1.7, 'reaction');
      if (!end && st.aizuchiAfter.includes(st.qi)){ end = simAdv(st, tm, 3, 'aizuchi'); if (!end) end = N.applyAizuchi(st, true); }
    }
    ck('s2 ctx good player: clears', end === null && st.qi === 15, 'end=' + end + ' qi=' + st.qi);
    ck('s2 ctx good player: sleep heavier than flat 52', st.sleep > 52 && st.sleep < 100, Math.round(st.sleep));
  }
  {
    /* ステージ2：悩むプレイ（10秒回答）は眠気加速で寝落ちする */
    const st = N.newState(1, N.drawQuestions(1, mulberry32(42)));
    const tm = { t: 0, q: 0 };
    let end = null;
    for (let n = 0; n < st.totalQ && !end; n++){
      tm.q = 0;
      end = simAdv(st, tm, 10, 'question');
      if (end) break;
      end = N.applyAnswer(st, best(st.qs[st.qi]), 10).end;
      end = end || simAdv(st, tm, 1.7, 'reaction');
      if (!end && st.aizuchiAfter.includes(st.qi)){ end = simAdv(st, tm, 3, 'aizuchi'); if (!end) end = N.applyAizuchi(st, true); }
    }
    ck('s2 ctx slow thinker: falls asleep', end === 'sleep', 'end=' + end + ' qi=' + st.qi + ' sleep=' + Math.round(st.sleep));
  }
  {
    /* ステージ3：加速・波込みでも、速い上手いプレイ＋ほっぺたならクリア可能 */
    const st = N.newState(2, N.drawQuestions(2, mulberry32(42)));
    const tm = { t: 0, q: 0 };
    let end = null;
    for (let n = 0; n < st.totalQ && !end; n++){
      tm.q = 0;
      end = simAdv(st, tm, 2, 'question');
      if (end) break;
      end = N.applyAnswer(st, best(st.qs[st.qi]), 2).end;
      if (!end && st.sleep > 62 && st.slapsLeft > 0) N.applySlap(st);
      end = end || simAdv(st, tm, 1.7, 'reaction');
      if (!end && st.aizuchiAfter.includes(st.qi)){ end = simAdv(st, tm, 3, 'aizuchi'); if (!end) end = N.applyAizuchi(st, true); }
    }
    ck('s3 ctx skilled player: can clear', end === null && st.qi === 18, 'end=' + end + ' qi=' + st.qi + ' sleep=' + Math.round(st.sleep) + ' susp=' + Math.round(st.susp));
  }

  /* ===== 甘えモード・追及・エンディング出し分け・称号・本音図鑑 ===== */
  {
    const st = N.newState(1, N.QUESTIONS.slice(0, 15));
    const g = { t:'x', d:-6, s:2, r:'x' };
    const r1 = N.applyAnswer(st, g, 2), r2 = N.applyAnswer(st, g, 2), r3 = N.applyAnswer(st, g, 2);
    ck('combo: 1st none, 2nd +2, 3rd +4', r1.combo === 0 && r2.combo === 2 && r3.combo === 4, [r1.combo, r2.combo, r3.combo].join(','));
    for (let i = 0; i < 5; i++) N.applyAnswer(st, g, 2);
    ck('combo capped at 5.5', st.streak === 8 && N.applyAnswer(st, g, 2).combo === 5.5);
    N.applyAnswer(st, { t:'x', d:4, s:0, r:'x' }, 2);
    ck('neutral breaks streak', st.streak === 0 && st.maxStreak === 9, st.streak + '/' + st.maxStreak);
    const s3 = N.newState(2, N.QUESTIONS.slice(0, 18)); N.applyAnswer(s3, g, 2);
    ck('no amae mode in rage stage', N.applyAnswer(s3, g, 2).combo === 0);
  }
  {
    ck('followups = 22, all have honne + good opt', Object.keys(N.FOLLOWUPS).length === 22 && Object.values(N.FOLLOWUPS).every(f => f.honne && f.opts.length === 3 && f.opts.some(o => o.d < 0)));
    const memKeys = N.QUESTIONS.flatMap(q => q.opts.filter(o => o.mem).map(o => o.mem));
    ck('every followup has exactly one seed answer', Object.keys(N.FOLLOWUPS).every(k => memKeys.filter(m => m === k).length === 1) && memKeys.length === 22);
    const seedQ = N.QUESTIONS.find(q => q.opts.some(o => o.mem === 'plan'));
    const qs = [seedQ].concat(N.QUESTIONS.filter(q => q !== seedQ).slice(0, 14));
    const st = N.newState(1, qs);
    N.applyAnswer(st, seedQ.opts.find(o => o.mem), 2);
    ck('no followup before gap', N.injectFollowup(st) === null && (N.applyAnswer(st, mid(st.qs[st.qi]), 2), N.injectFollowup(st)) === null);
    N.applyAnswer(st, mid(st.qs[st.qi]), 2);
    const fu = N.injectFollowup(st);
    ck('followup injected 3 questions later', fu === N.FOLLOWUPS.plan && st.qs[3] === N.FOLLOWUPS.plan && st.fuLeft === 1);
    N.applyAnswer(st, best(fu), 2);
    ck('followup pass counted, not re-injected', st.fuPass === 1 && N.injectFollowup(st) === null);
    const t = N.newState(2, [N.TRAPS[0], N.TRAPS[1]]); t.mems.push({ key:'plan', at:-5, used:false });
    ck('followup never replaces a trap', N.injectFollowup(t) === null);
  }
  {
    const st = N.newState(1, []);
    st.susp = 3; st.maxStreak = 5; ck('herSleep: susp<=5 & streak>=5', N.finalEnding(st, 'clear') === 'herSleep');
    st.maxStreak = 4; ck('plain clear without long streak', N.finalEnding(st, 'clear') === 'clear');
    st.susp = 40; st.sleep = 95; ck('brink: sleep>=90', N.finalEnding(st, 'clear') === 'brink');
    ck('slapped breakup', N.finalEnding(st, 'breakup', 'slap') === 'slapped' && N.finalEnding(st, 'breakup') === 'breakup');
    ck('7 endings', Object.keys(N.ENDINGS).length === 7);
    ck('title for rage clear', N.titleOf(N.newState(2, []), 'brink', 18) === '修羅場の生還者');
    ck('title for early honne', N.titleOf(st, 'honne', 2) === '開始早々の本音');
    const all = N.allHonneQuestions();
    ck('honne zukan = 165 unique questions', all.length === 165 && new Set(all.map(q => q.q)).size === 165, all.length);
  }

  console.log(fails === 0 ? 'ALL_LOGIC_PASS' : 'LOGIC_FAILS=' + fails);
}
