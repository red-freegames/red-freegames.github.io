
/* ===== UIスモーク（本音ルート＆ほっぺた）: stub+b0+b1 の後ろに連結 ===== */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0;
  const ck = (name, cond, extra) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra !== undefined ? ' => ' + extra : '')); if (!cond) fails++; };
  try {
    const UI = globalThis.__NK_UI__;
    const NK = UI.NK, S = UI.state();
    NK.start();
    ck('question phase', S.phase === 'question');
    const fatal = S.st.qs[0].honne;
    ck('honne hidden at low sleep', document.getElementById('honneBtn').style.display === 'none', document.getElementById('honneBtn').style.display);
    UI.setSleep(50);
    NK.slap();
    ck('slap effect', Math.round(S.st.sleep) === 38 && S.st.susp === 5, S.st.sleep + '/' + S.st.susp);
    ck('slaps left 2', S.st.slapsLeft === 2, S.st.slapsLeft);
    UI.setSleep(80);
    await wait(250);
    ck('honne visible at sleep 80', document.getElementById('honneBtn').style.display === 'block', document.getElementById('honneBtn').style.display);
    ck('honne shows fatal line', document.getElementById('honneBtn').innerHTML.includes(fatal), document.getElementById('honneBtn').innerHTML.slice(0, 60));
    NK.honne();
    await wait(1200);
    ck('honne ending', S.lastEnding === 'honne', S.lastEnding);
    ck('fatal line recorded', S.st.fatalLine === fatal, S.st.fatalLine);
    ck('end line shown', document.getElementById('endLine').style.display === 'block');
    ck('honne saved to zukan', !!JSON.parse(localStorage.getItem('nk_endings_v1') || '{}').honne);
    NK.shareX();
    ck('shareX did not throw', true);
  } catch (e) {
    console.log('FAIL exception: ' + (e && e.stack || e)); fails++;
  }
  console.log(fails === 0 ? 'ALL_UI_HONNE_PASS' : 'UI_HONNE_FAILS=' + fails);
  process.exit(fails === 0 ? 0 : 1);
})();
