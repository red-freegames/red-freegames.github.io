
/* ===== UIスモーク（最終ステージ「もう疲れた」）: stub+b0+b1 の後ろに連結 ===== */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0;
  const ck = (name, cond, extra) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra !== undefined ? ' => ' + extra : '')); if (!cond) fails++; };
  try {
    const UI = globalThis.__NK_UI__;
    const N = globalThis.__NK__;
    const NK = UI.NK, S = UI.state();
    const waitPhase = async (phase, timeout) => {
      const t0 = Date.now();
      while (Date.now() - t0 < (timeout || 8000)){
        if (S.phase === phase) return true;
        await wait(60);
      }
      return false;
    };
    NK.pickStage(2);
    ck('stage 3 selected', S.selStage === 2 && document.getElementById('stageList').innerHTML.includes('rage sel'), S.selStage);
    NK.start();
    ck('question phase', S.phase === 'question');
    ck('susp starts at 30', S.st.susp === 30, S.st.susp);
    ck('18 questions drawn', S.st.qs.length === 18 && new Set(S.st.qs).size === 18, S.st.qs.length);
    ck('qcount shows 18', document.getElementById('qcount').textContent.includes('/ 18'), document.getElementById('qcount').textContent);
    ck('slaps = 2', S.st.slapsLeft === 2, S.st.slapsLeft);
    /* 地雷でない質問まで進めて、正解でも不信感が半分しか下がらないことを確認 */
    let guard = 0;
    while (S.st.qs[S.st.qi].trap && guard++ < 5){
      const q = S.st.qs[S.st.qi];
      let bi = 0;
      q.opts.forEach((o, i) => { if (o.d < q.opts[bi].d) bi = i; });
      NK.answer(bi);
      await waitPhase('question', 6000);
    }
    UI.setSusp(50);
    const q = S.st.qs[S.st.qi];
    let bi = 0;
    q.opts.forEach((o, i) => { if (o.d < q.opts[bi].d) bi = i; });
    NK.answer(bi);
    ck('good answer halved in rage mode (-3)', S.st.susp === 47, S.st.susp);
    await wait(300);
    const reacts = document.getElementById('log').children.filter(c => c.className === 'bbl react');
    const lastReact = reacts.length ? reacts[reacts.length - 1].textContent : '';
    ck('rage reaction used for good answer', N.RAGE_GOOD_REACTS.includes(lastReact), lastReact.slice(0, 40));
  } catch (e) {
    console.log('FAIL exception: ' + (e && e.stack || e)); fails++;
  }
  console.log(fails === 0 ? 'ALL_UI_RAGE_PASS' : 'UI_RAGE_FAILS=' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
