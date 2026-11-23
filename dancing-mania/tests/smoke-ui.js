const fs = require('fs');
// ---------- DOM stubs ----------
function ctxStub() {
  return { font: '', textAlign: '', textBaseline: '', lineWidth: 1, strokeStyle: '', fillStyle: '',
    strokeText() {}, fillText() {}, fillRect() {}, drawImage() {},
    createLinearGradient() { return { addColorStop() {} }; } };
}
function elStub(id) {
  return { id: id, style: {}, classList: { add() {}, remove() {} }, textContent: '', innerHTML: '',
    href: '', src: '', offsetWidth: 0, width: 0, height: 0, _handlers: {},
    addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); },
    appendChild() {}, getContext() { return ctxStub(); }, toDataURL() { return 'data:image/png;base64,stub'; } };
}
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = elStub(id)); },
  createElement(tag) { return elStub(tag); },
};
let rafCb = null;
let fakeNow = 0;
global.window = {
  innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, _handlers: {},
  addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); },
};
global.requestAnimationFrame = function (cb) { rafCb = cb; };
global.performance = { now: function () { return fakeNow; } };
global.localStorage = { getItem() { return null; }, setItem() {} };
global.Image = class { set src(v) { const self = this; setTimeout(function () { if (self.onload) self.onload(); }, 0); } };
// ---------- THREE stubs ----------
function vec() { return { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } }; }
function obj3d() {
  return { children: [], position: vec(), rotation: vec(), scale: { set() {} }, visible: true,
    add(c) { this.children.push(c); }, remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); } };
}
class Color { setHex() {} }
global.THREE = {
  Scene: class extends Object { constructor() { super(); Object.assign(this, obj3d()); } },
  PerspectiveCamera: class { constructor() { this.position = vec(); } lookAt() {} updateProjectionMatrix() {} },
  WebGLRenderer: class { constructor() { this.domElement = elStub('canvas'); } setPixelRatio() {} setSize() {} render() {} },
  HemisphereLight: class {}, DirectionalLight: class { constructor() { this.position = vec(); } },
  Group: class { constructor() { Object.assign(this, obj3d()); } },
  Mesh: class { constructor(g, m) { Object.assign(this, obj3d()); this.material = m || { opacity: 0, color: new Color() }; } },
  Sprite: class { constructor(m) { Object.assign(this, obj3d()); this.material = m || { opacity: 0 }; } },
  PlaneGeometry: class {}, BoxGeometry: class { translate() {} }, CircleGeometry: class {},
  RingGeometry: class {}, CylinderGeometry: class {}, ConeGeometry: class {},
  MeshLambertMaterial: class {}, MeshBasicMaterial: class {},
  SpriteMaterial: class { constructor(o) { this.opacity = o && o.opacity !== undefined ? o.opacity : 1; } },
  CanvasTexture: class {}, Color: Color, Fog: class {}, Vector3: class { constructor() { this.x = 0; this.y = 0; this.z = 0; } },
  DoubleSide: 2, sRGBEncoding: 1,
};
// ---------- load three (real), core, ui ----------
eval(fs.readFileSync(require('path').join(__dirname, '..', 'dance-core.js'), 'utf8'));
// Use REAL three.js (its UMD assigns to module.exports under Node eval);
// stub only WebGLRenderer, which would need a real GL context.
delete global.THREE;
eval(fs.readFileSync(require('path').join(__dirname, '..', 'three-block.js'), 'utf8'));
global.THREE = module.exports;
global.THREE.WebGLRenderer = class { constructor() { this.domElement = elStub('canvas'); } setPixelRatio() {} setSize() {} render() {} };
eval(fs.readFileSync(require('path').join(__dirname, '..', 'dance-ui.js'), 'utf8'));

const UI = globalThis.__DM_UI__;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FAIL:', m); } }
ok(UI && UI.G, 'UI booted, game object exposed');
ok(rafCb, 'animate loop registered');

// click START
const startBtn = elCache['btnStart'];
ok(startBtn && startBtn._handlers.click, 'start button handler bound');
startBtn._handlers.click[0]();
ok(UI.G.phase === 'play', 'game in play after start, phase=' + UI.G.phase);

function frame() { fakeNow += 33.3; const cb = rafCb; rafCb = null; cb(); }
function click(id) { const e = elCache[id]; ok(e && e._handlers.click, id + ' handler bound'); e._handlers.click[0]({}); }
// --- HOME: プレイ中に開くと一時停止、続きからで再開、最初からは確認を挟む ---
{
  for (let i = 0; i < 10; i++) frame();
  click('btnHome');
  ok(UI.paused && elCache['home'].style.display === 'flex', 'HOME opens and pauses');
  ok(elCache['homeCont'].style.display !== 'none', 'continue shown while in progress');
  const t0 = UI.G.elapsed;
  for (let i = 0; i < 20; i++) frame();
  ok(UI.G.elapsed === t0, 'time frozen while on HOME');
  click('homeCont');
  ok(!UI.paused && elCache['home'].style.display === 'none', 'continue resumes');
  for (let i = 0; i < 5; i++) frame();
  ok(UI.G.elapsed > t0, 'time runs again after continue');
  click('btnHome');
  const g0 = UI.G;
  click('btnStart');
  ok(elCache['confirmPanel'].style.display === 'flex' && UI.G === g0, 'restart asks for confirmation');
  click('confirmNo');
  ok(elCache['confirmPanel'].style.display === 'none' && UI.G === g0, 'cancel keeps the run');
  click('btnStart'); click('confirmYes');
  ok(UI.G !== g0 && UI.G.phase === 'play' && !UI.paused, 'confirm starts a new run');
}
// bot: steer with keys toward nearest walker
function botKeys() {
  const G = UI.G;
  for (const k of ['w', 'a', 's', 'd']) {
    const hs = global.window._handlers['keydown'] || [];
  }
  let tgt = null, best = Infinity;
  for (const n of G.npcs) { if (n.state !== 'walk' || n.immune > 0) continue; const d = (n.x - G.player.x) ** 2 + (n.z - G.player.z) ** 2; if (d < best) { best = d; tgt = n; } }
  // set keys object via dispatched events
  function key(k, down) {
    const ev = down ? 'keydown' : 'keyup';
    for (const fn of (global.window._handlers[ev] || [])) fn({ key: k });
  }
  for (const k of ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']) key(k, false);
  if (tgt) {
    const dx = tgt.x - G.player.x, dz = tgt.z - G.player.z;
    if (Math.abs(dx) > 0.8) key(dx > 0 ? 'd' : 'a', true);
    if (Math.abs(dz) > 0.8) key(dz > 0 ? 's' : 'w', true);
    // flee guards
    for (const g of G.guards) { const d = Math.hypot(g.x - G.player.x, g.z - G.player.z); if (d < 5) { key(G.player.x > g.x ? 'd' : 'a', true); key(G.player.z > g.z ? 's' : 'w', true); } }
  }
}
let sawInfect = false, frames = 0;
(async function () {
  while (frames < 60 * 240 && UI.G.phase === 'play') {
    botKeys();
    frame();
    frames++;
    if (UI.G.score > 0) sawInfect = true;
    if (UI.G.phase !== 'play') break;
  }
  console.log('after bot play: phase=' + UI.G.phase, 'score=' + UI.G.score, 'infected=' + UI.G.infectedCount() + '/' + UI.G.totalNpc, 'frames=' + frames);
  ok(sawInfect, 'bot infected at least one NPC through the real UI loop');
  // run more frames to exercise end-panel timers if ended
  for (let i = 0; i < 90; i++) frame();
  await new Promise(r => setTimeout(r, 10));
  for (let i = 0; i < 30; i++) frame();

  // 全ステージの仕掛けと全部の踊りを、実際の描画ループで回す
  const DM = globalThis.__DM__;
  const seen = {};
  for (const d of DM.DANCES) {
    for (let s = 0; s < DM.STAGES.length; s++) {
      const g = DM.createGame(100 + s, { dance: d.id, wave: (s + DM.DANCES.indexOf(d)) % 2 === 1 }); // 波モードも半分回す
      g.startStage(s);
      UI.setGame(g); UI.setupStage();
      ok(UI.danceStyle === d.id, 'dance style applied: ' + d.id);
      const st = DM.STAGES[s];
      if (st.gimmick === 'bell') g.elapsed = st.bellAt - 0.5;
      if (st.gimmick === 'rain') g.elapsed = st.rainFirst - 0.5;
      if (st.gimmick === 'yagura') g.elapsed = st.drumFirst - 0.5;
      for (let i = 0; i < 30 * 20 && g.phase === 'play'; i++) {
        botKeys(); frame();
        for (const n of g.npcs) if (n.state === 'walk' && i % 90 === 0 && n.kind !== 'normal') { n.x = g.player.x + 1; n.z = g.player.z; } // 特別な人も踊らせる
      }
      seen[st.gimmick] = (seen[st.gimmick] || 0) + 1;
      if (st.gimmick === 'train') ok(g.arrivals.length < st.arrivals.length || g.phase !== 'play', 'a train arrived during UI play');
      if (st.gimmick === 'bell') ok(g.bellRung, 'bell rang during UI play');
      if (st.gimmick === 'rain') ok(g.nextRainAt > st.rainFirst || g.phase !== 'play', 'rain fell during UI play');
      if (st.gimmick === 'band') ok(g.band.length === 3, 'band present in UI play');
    }
  }
  // 波モード: パルスが出て、クリア時の決めポーズ演出を経て結果へ進む
  {
    const g = DM.createGame(7, { wave: true }); g.startStage(1);
    UI.setGame(g); UI.setupStage();
    for (const n of g.npcs) { n.x = g.player.x + (Math.random() - 0.5) * 10; n.z = g.player.z + (Math.random() - 0.5) * 10; n.stand = true; }
    let frames2 = 0; while (g.phase === 'play' && frames2 < 30 * 30) { frame(); frames2++; }
    ok(g.stats.pulse > 0, 'wave pulses fired in UI: ' + g.stats.pulse);
    ok(g.maxWave >= 5, 'a wave formed in UI: ' + g.maxWave);
    for (let i = 0; i < 90; i++) frame();
  }
  ok(Object.keys(seen).length === DM.STAGES.length, 'all gimmicks exercised: ' + Object.keys(seen).join(','));
  for (let i = 0; i < 30; i++) frame();
  console.log(fails === 0 ? 'SMOKE TEST PASS' : fails + ' FAILURES');
})();
