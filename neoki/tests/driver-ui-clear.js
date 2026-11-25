
/* ===== UIスモーク（ステージ2・クリアルート＋選択肢シャッフル）: stub+b0+b1 の後ろに連結 ===== */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0;
  const ck = (name, cond, extra) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra !== undefined ? ' => ' + extra : '')); if (!cond) fails++; };
  try {
    const UI = globalThis.__NK_UI__;
    const NK = UI.NK, S = UI.state();
    ck('start phase', S.phase === 'start', S.phase);
    ck('stage list shows final stage', document.getElementById('stageList').innerHTML.includes('もう疲れた'));
    ck('default stage is s2', S.selStage === 1, S.selStage);
    NK.start();
    ck('question phase', S.phase === 'question', S.phase);
    ck('first question shown', document.getElementById('qcount').textContent.includes('1 / 15'), document.getElementById('qcount').textContent);
    ck('15 questions drawn', S.st.qs.length === 15 && new Set(S.st.qs).size === 15, S.st.qs.length);
    let aizuchiSeen = 0, shuffledSeen = 0;
    const t0 = Date.now();
    while (S.phase !== 'end' && Date.now() - t0 < 120000){
      if (S.phase === 'question'){
        await wait(120);
        if (S.curOrder.join(',') !== '0,1,2') shuffledSeen++;
        const q = S.st.qs[S.st.qi];
        let bi = 0;
        q.opts.forEach((o, i) => { if (o.d < q.opts[bi].d) bi = i; });
        NK.answer(bi);
      } else if (S.phase === 'aizuchi'){
        aizuchiSeen++;
        const az = S.az;
        const targetMs = ((az.a + az.b) / 2) * az.dur * 1000;
        const elapsedMs = (performance.now() / 1000 - az.t0) * 1000;
        await wait(Math.max(0, targetMs - elapsedMs));
        NK.un();
      } else {
        await wait(100);
      }
    }
    ck('reached end', S.phase === 'end', S.phase);
    ck('ending is clear', S.lastEnding === 'clear', S.lastEnding);
    ck('option order shuffled at least once', shuffledSeen >= 1, shuffledSeen);
    ck('aizuchi appeared 5 times', aizuchiSeen === 5, aizuchiSeen);
    ck('all 15 answered', S.st.qi === 15, S.st.qi);
    ck('end screen title', document.getElementById('endTitle').textContent.includes('寝ていいよ'), document.getElementById('endTitle').textContent);
    ck('ending saved to zukan', !!JSON.parse(localStorage.getItem('nk_endings_v1') || '{}').clear);
    ck('stage clear recorded', !!JSON.parse(localStorage.getItem('nk_clears_v1') || '{}').s2);
    NK.shareImage();
    ck('share image did not throw', true);
  } catch (e) {
    console.log('FAIL exception: ' + (e && e.stack || e)); fails++;
  }
  console.log(fails === 0 ? 'ALL_UI_CLEAR_PASS' : 'UI_CLEAR_FAILS=' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
