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
  console.log(fails === 0 ? 'SMOKE TEST PASS' : fails + ' FAILURES');
})();
