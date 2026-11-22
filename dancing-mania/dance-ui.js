// 『ダンシングマニア(仮)』描画/UI: THREE r128 + dance-core.js の上に構築
(function () {
'use strict';
const DM = globalThis.__DM__;
const CFG = DM.CFG, STAGES = DM.STAGES;
const $ = function (id) { return document.getElementById(id); };

// ================= 音 =================
let audioCtx = null;
let soundOn = true;
try { soundOn = localStorage.getItem('dm_sound') !== '0'; } catch (e) {}
function beep(freq, dur, type, vol, slideTo) {
  if (!soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur);
  } catch (e) {}
}
function unlockAudio() { // iOS Safari: ユーザー操作の中で生成・resumeしないと鳴らない
  if (!soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const b = audioCtx.createBuffer(1, 1, 22050), s = audioCtx.createBufferSource();
    s.buffer = b; s.connect(audioCtx.destination); s.start(0);
  } catch (e) {}
}
function buzz(ms) { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
function sInfect(chain) { beep(500 + Math.min(chain, 24) * 32, 0.12, 'sine', 0.16); }
function sCure() { beep(320, 0.16, 'square', 0.07, 150); }
function sCatch() { beep(150, 0.32, 'sawtooth', 0.18, 65); }
function sClear() { const n = [523, 659, 784, 1047]; for (let i = 0; i < n.length; i++) (function (f, d) { setTimeout(function () { beep(f, 0.2, 'triangle', 0.15); }, d); })(n[i], i * 110); }
function sFever() { const n = [659, 880, 1109, 1319]; for (let i = 0; i < n.length; i++) (function (f, d) { setTimeout(function () { beep(f, 0.16, 'square', 0.1); }, d); })(n[i], i * 70); }

// ================= THREE セットアップ =================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
const IS_TOUCH = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
let pixelRatio = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.75 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
$('game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x445577, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(18, 32, 12);
scene.add(sun);

const THEMES = [
  { sky: 0x9fd4ff, ground: 0x7d8aa0, arena: 0xb9c2cf, accent: 0xff5da2, prop: 'plaza' },
  { sky: 0xffd9e4, ground: 0xd9b98c, arena: 0xf7ead0, accent: 0xd94f70, prop: 'wedding' },
  { sky: 0xa9c3e6, ground: 0x4d5c6e, arena: 0x71808f, accent: 0xffcf3f, prop: 'office' },
];
const worldG = new THREE.Group();
scene.add(worldG);

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); worldG.add(m); return m;
}
function buildWorld(idx) {
  while (worldG.children.length) worldG.remove(worldG.children[0]);
  const th = THEMES[idx % THEMES.length];
  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.sky, 80, 160);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshLambertMaterial({ color: th.ground }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; worldG.add(ground);
  const arena = new THREE.Mesh(new THREE.PlaneGeometry(56.5, 56.5), new THREE.MeshLambertMaterial({ color: th.arena }));
  arena.rotation.x = -Math.PI / 2; arena.position.y = 0; worldG.add(arena);
  const accMat = new THREE.MeshLambertMaterial({ color: th.accent });
  box(57.5, 0.35, 0.7, accMat, 0, 0.17, -28.4); box(57.5, 0.35, 0.7, accMat, 0, 0.17, 28.4);
  box(0.7, 0.35, 57.5, accMat, -28.4, 0.17, 0); box(0.7, 0.35, 57.5, accMat, 28.4, 0.17, 0);
  const leaf = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  const trunk = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const build = new THREE.MeshLambertMaterial({ color: 0x8fa3bd });
  const build2 = new THREE.MeshLambertMaterial({ color: 0x6d8099 });
  const tableM = new THREE.MeshLambertMaterial({ color: 0xffffff });
  let seed = idx * 77 + 13;
  const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + rnd() * 0.3;
    const rad = 36 + rnd() * 10;
    const x = Math.sin(ang) * rad, z = Math.cos(ang) * rad;
    if (th.prop === 'office') {
      const h = 8 + rnd() * 14;
      box(6 + rnd() * 4, h, 6 + rnd() * 4, rnd() > 0.5 ? build : build2, x, h / 2, z);
    } else if (th.prop === 'wedding') {
      if (i % 2 === 0) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.18, 14), tableM);
        t.position.set(x, 1.05, z); worldG.add(t);
        box(0.3, 1.0, 0.3, trunk, x, 0.5, z);
      } else {
        box(0.5, 3.4, 0.5, tableM, x, 1.7, z);
        box(1.6, 0.4, 1.6, accMat, x, 3.6, z);
      }
    } else {
      box(0.45, 1.1, 0.45, trunk, x, 0.55, z);
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.6, 8), leaf);
      c.position.set(x, 2.9, z); worldG.add(c);
      box(2.4, 0.5, 0.8, trunk, x + 2.6, 0.25, z);
    }
  }
  // 人だかりの目印: 屋台
  if (G && G.clusters) {
    const stallM = new THREE.MeshLambertMaterial({ color: 0xa9743f });
    for (const c of G.clusters) {
      box(2.4, 1.0, 1.3, stallM, c.x, 0.5, c.z);
      box(2.9, 0.14, 1.9, accMat, c.x, 2.05, c.z);
      box(0.12, 2.0, 0.12, stallM, c.x - 1.25, 1.0, c.z);
      box(0.12, 2.0, 0.12, stallM, c.x + 1.25, 1.0, c.z);
      box(0.7, 0.5, 0.7, accMat, c.x, 1.25, c.z);
    }
  }
}

// ================= 人物ファクトリ =================
const geoBody = new THREE.BoxGeometry(0.62, 0.78, 0.34);
const geoHead = new THREE.BoxGeometry(0.36, 0.38, 0.36);
const geoArm = new THREE.BoxGeometry(0.16, 0.62, 0.16); geoArm.translate(0, -0.27, 0);
const geoLeg = new THREE.BoxGeometry(0.2, 0.56, 0.2); geoLeg.translate(0, -0.25, 0);
const geoCap = new THREE.CylinderGeometry(0.24, 0.26, 0.13, 10);
const geoShadow = new THREE.CircleGeometry(0.55, 18);
const geoRing = new THREE.RingGeometry(CFG.infectR - 0.38, CFG.infectR, 42);
const geoRingD = new THREE.RingGeometry(CFG.infectR - 0.18, CFG.infectR, 42);
const geoDisc = new THREE.CircleGeometry(CFG.infectR, 42);
const MAT = {
  skin: [0xf2c49b, 0xd9a066, 0xa9743f].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); }),
  shirt: [0x4f9dde, 0x63b06a, 0xe8e3d8, 0x9a7fd4, 0xef8354, 0x53c2c2, 0xd46a9a, 0x7d8aa0].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); }),
  stubborn: new THREE.MeshLambertMaterial({ color: 0x3c3c46 }),
  pants: [0x3a4a63, 0x5b4a3a, 0x2e2e38, 0x707a68].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); }),
  guardShirt: new THREE.MeshLambertMaterial({ color: 0xffd400 }),
  guardPants: new THREE.MeshLambertMaterial({ color: 0x17171f }),
  cap: new THREE.MeshLambertMaterial({ color: 0xffd400 }),
  band: new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }),
  playerShirt: new THREE.MeshLambertMaterial({ color: 0xff3355 }),
  playerPants: new THREE.MeshLambertMaterial({ color: 0xffcf3f }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  ringP: new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
  ringD: new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  ringFillP: new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  ringFillD: new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.03, side: THREE.DoubleSide, depthWrite: false }),
};
function textTex(text, color, fontPx) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const cx = cv.getContext('2d');
  cx.font = '900 ' + (fontPx || 92) + 'px sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.lineWidth = 10; cx.strokeStyle = 'rgba(20,10,30,0.85)';
  cx.strokeText(text, 64, 68); cx.fillStyle = color; cx.fillText(text, 64, 68);
  return new THREE.CanvasTexture(cv);
}
const noteTex = textTex('♪', '#ffcf3f');
const angerTex = textTex('💢', '#ffffff', 80);
const markTex = textTex('▼', '#ffcf3f', 84);

function makePerson(o) {
  const root = new THREE.Group();
  const groundG = new THREE.Group(); // 影と円は地面専用グループ: 踊りの傾き・跳ねに一切影響させない
  scene.add(groundG);
  const shadow = new THREE.Mesh(geoShadow, MAT.shadow);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; groundG.add(shadow);
  let ring = null;
  if (o.ring) {
    ring = new THREE.Group();
    const rim = new THREE.Mesh(o.ring === 'player' ? geoRing : geoRingD, o.ring === 'player' ? MAT.ringP : MAT.ringD);
    rim.rotation.x = -Math.PI / 2; rim.position.y = 0.05; ring.add(rim);
    const fill = new THREE.Mesh(geoDisc, o.ring === 'player' ? MAT.ringFillP : MAT.ringFillD);
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.04; ring.add(fill);
    groundG.add(ring);
  }
  const legL = new THREE.Group(); legL.position.set(-0.16, 0.6, 0);
  const legR = new THREE.Group(); legR.position.set(0.16, 0.6, 0);
  const lm1 = new THREE.Mesh(geoLeg, o.pants); legL.add(lm1);
  const lm2 = new THREE.Mesh(geoLeg, o.pants); legR.add(lm2);
  root.add(legL); root.add(legR);
  const torso = new THREE.Mesh(geoBody, o.shirt); torso.position.y = 0.99; root.add(torso);
  const armL = new THREE.Group(); armL.position.set(-0.41, 1.3, 0);
  const armR = new THREE.Group(); armR.position.set(0.41, 1.3, 0);
  armL.add(new THREE.Mesh(geoArm, o.shirt)); armR.add(new THREE.Mesh(geoArm, o.shirt));
  root.add(armL); root.add(armR);
  const headG = new THREE.Group(); headG.position.y = 1.38;
  const head = new THREE.Mesh(geoHead, o.skin); head.position.y = 0.2; headG.add(head);
  if (o.cap) { const cap = new THREE.Mesh(geoCap, MAT.cap); cap.position.y = 0.45; headG.add(cap); }
  root.add(headG);
  if (o.band) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.13, 0.38), MAT.band); band.position.y = 1.06; root.add(band); }
  const note = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, opacity: 0, depthWrite: false }));
  note.position.y = 2.2; note.scale.set(0.8, 0.8, 1); root.add(note);
  const anger = new THREE.Sprite(new THREE.SpriteMaterial({ map: angerTex, transparent: true, opacity: 0, depthWrite: false }));
  anger.position.y = 2.2; anger.scale.set(0.8, 0.8, 1); root.add(anger);
  let marker = null;
  if (o.marker) {
    marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, transparent: true, depthWrite: false }));
    marker.position.y = 2.45; marker.scale.set(0.7, 0.7, 1); root.add(marker);
  }
  scene.add(root);
  return { root: root, groundG: groundG, legL: legL, legR: legR, armL: armL, armR: armR, headG: headG, torso: torso, note: note, anger: anger, ring: ring, marker: marker, wp: Math.random() * 6 };
}
const playerPerson = makePerson({ shirt: MAT.playerShirt, pants: MAT.playerPants, skin: MAT.skin[0], ring: 'player', marker: true });
const npcPersons = [];
for (let i = 0; i < 52; i++) npcPersons.push(makePerson({ shirt: MAT.shirt[i % 8], pants: MAT.pants[i % 4], skin: MAT.skin[i % 3], ring: 'dancer' }));
const guardPersons = [];
for (let i = 0; i < 3; i++) guardPersons.push(makePerson({ shirt: MAT.guardShirt, pants: MAT.guardPants, skin: MAT.skin[i % 3], cap: true, band: true }));

// ================= エフェクト =================
const fxPool = [];
for (let i = 0; i < 20; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.5, 26),
    new THREE.MeshBasicMaterial({ color: 0xffcf3f, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.visible = false; scene.add(m);
  fxPool.push({ mesh: m, t: 1e9 });
}
const noteFxPool = [];
for (let i = 0; i < 16; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, opacity: 0, depthWrite: false }));
  s.visible = false; scene.add(s);
  noteFxPool.push({ spr: s, t: 1e9, x: 0, z: 0 });
}
function spawnFx(x, z, color) {
  for (const f of fxPool) if (f.t > 0.6) { f.t = 0; f.mesh.visible = true; f.mesh.position.x = x; f.mesh.position.z = z; f.mesh.material.color.setHex(color); return; }
}
function spawnNoteFx(x, z) {
  for (const f of noteFxPool) if (f.t > 1) { f.t = 0; f.x = x; f.z = z; f.spr.visible = true; return; }
}
function updateFx(dt) {
  for (const f of fxPool) {
    if (f.t > 0.6) { f.mesh.visible = false; continue; }
    f.t += dt;
    const k = f.t / 0.6, s = 0.6 + k * 5.2;
    f.mesh.scale.set(s, s, 1);
    f.mesh.material.opacity = 0.85 * (1 - k);
  }
  for (const f of noteFxPool) {
    if (f.t > 1) { f.spr.visible = false; continue; }
    f.t += dt;
    f.spr.position.set(f.x, 1.9 + f.t * 1.6, f.z);
    const s = 0.7 + f.t * 0.4;
    f.spr.scale.set(s, s, 1);
    f.spr.material.opacity = 1 - f.t;
  }
}

// ================= ポーズ =================
function danceSpinOffset(t) {
  const cyc = (t * 9.0 / Math.PI) % 16;
  if (cyc >= 12 && cyc < 13) return (cyc - 12) * Math.PI * 2; // 16拍に1回、全員同時に1回転
  return 0;
}
function dancePose(P, t) {
  const p = t * 9.0;
  const b = Math.abs(Math.sin(p));
  const cyc = (t * 9.0 / Math.PI) % 8;
  P.root.position.y = b * 0.12 - 0.03;
  P.root.rotation.z = Math.sin(p * 0.5) * 0.09;
  // 基本グルーヴ: 左右非対称にして「変」にする
  P.armL.rotation.x = Math.sin(p) * 1.6;
  P.armL.rotation.z = 0.55 + Math.cos(p * 2) * 0.35;
  P.armR.rotation.x = Math.sin(p + Math.PI) * 1.1 - 0.5;
  P.armR.rotation.z = -0.35 - Math.cos(p) * 0.5;
  P.legL.rotation.x = Math.sin(p) * 0.55;
  P.legR.rotation.x = -Math.sin(p + 0.7) * 0.55;
  P.torso.rotation.z = Math.sin(p) * 0.13;
  P.torso.rotation.x = Math.sin(p * 2) * 0.1;
  P.torso.rotation.y = Math.sin(p * 0.5) * 0.42;
  P.headG.rotation.z = Math.sin(p + 0.6) * 0.26;
  P.headG.rotation.x = Math.sin(p * 2) * 0.3;
  if (cyc < 1) { // 決めポーズ: 両手を上げる(全員同時)
    P.armL.rotation.x = 2.9 + Math.sin(p * 3) * 0.12; P.armL.rotation.z = 0.22;
    P.armR.rotation.x = 2.9 - Math.sin(p * 3) * 0.12; P.armR.rotation.z = -0.22;
  } else if (cyc >= 4 && cyc < 6) { // 左腕は風車ぐるぐる、右腕は鳥の羽ばたき
    P.armL.rotation.x = p * 2.2; P.armL.rotation.z = 0.15;
    P.armR.rotation.x = -0.9;
    P.armR.rotation.z = -0.9 - Math.abs(Math.sin(p * 3)) * 0.7;
  } else if (cyc >= 7) { // 全員フリーズ(変なポーズで完全静止)
    P.armL.rotation.x = 2.7; P.armL.rotation.z = 0.9;
    P.armR.rotation.x = -1.3; P.armR.rotation.z = -1.1;
    P.legL.rotation.x = 0.35; P.legR.rotation.x = -0.25;
    P.torso.rotation.y = 0.55; P.torso.rotation.z = 0.2; P.torso.rotation.x = 0;
    P.headG.rotation.z = 0.42; P.headG.rotation.x = 0.15;
    P.root.position.y = 0.04; P.root.rotation.z = 0.06;
  }
}
function walkPose(P, dt, fast) {
  P.wp += dt * (fast ? 11 : 6.5);
  const s = Math.sin(P.wp);
  P.root.position.y = Math.abs(Math.cos(P.wp)) * 0.03;
  P.legL.rotation.x = s * 0.5; P.legR.rotation.x = -s * 0.5;
  P.armL.rotation.x = -s * 0.35; P.armR.rotation.x = s * 0.35;
  P.armL.rotation.z = 0.08; P.armR.rotation.z = -0.08;
  P.torso.rotation.z = 0; P.torso.rotation.y = 0; P.torso.rotation.x = 0;
  P.headG.rotation.z = 0; P.headG.rotation.x = 0; P.root.rotation.z = 0;
}
function idlePose(P, t, id) { // 人だかりで待つ人: きょろきょろしながら屋台を眺める
  P.root.position.y = 0; P.root.rotation.z = 0;
  P.legL.rotation.x = 0; P.legR.rotation.x = 0;
  P.armL.rotation.x = Math.sin(t * 1.3 + id) * 0.07; P.armR.rotation.x = Math.sin(t * 1.1 + id * 2) * 0.07;
  P.armL.rotation.z = 0.08; P.armR.rotation.z = -0.08;
  P.torso.rotation.z = Math.sin(t * 0.9 + id) * 0.03; P.torso.rotation.x = 0;
  P.torso.rotation.y = Math.sin(t * 0.6 + id * 1.7) * 0.4;
  P.headG.rotation.z = 0; P.headG.rotation.x = 0;
  P.headG.rotation.y = Math.sin(t * 0.45 + id) * 0.5;
}
function scoldPose(P, t) {
  P.root.position.y = 0;
  P.armL.rotation.x = -1.15 + Math.sin(t * 24) * 0.09;
  P.armR.rotation.x = -1.15 - Math.sin(t * 24) * 0.09;
  P.armL.rotation.z = 0.15; P.armR.rotation.z = -0.15;
  P.legL.rotation.x = 0; P.legR.rotation.x = 0;
  P.headG.rotation.z = Math.sin(t * 9) * 0.07;
}

// ================= 入力 =================
const keys = {};
window.addEventListener('keydown', function (e) { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
// ドラッグ = 指を置いた所が中心の仮想スティック。指が半径より遠くへ行くと中心が追従するので、
// 逆方向へ切り返すときに指を大きく戻さなくてよい。
const STICK_R = 46, STICK_DEAD = 12;
let dragId = null, dragSX = 0, dragSY = 0, dragX = 0, dragY = 0;
const cvs = renderer.domElement;
const stickEl = $('stick'), knobEl = $('stickKnob');
function drawStick() {
  if (!stickEl) return;
  if (dragId === null) { stickEl.style.display = 'none'; return; }
  stickEl.style.display = 'block';
  stickEl.style.transform = 'translate(' + dragSX + 'px,' + dragSY + 'px)';
  knobEl.style.transform = 'translate(' + (dragX - dragSX) + 'px,' + (dragY - dragSY) + 'px)';
}
function endDrag(e) {
  if (dragId === null || (e && e.pointerId !== undefined && e.pointerId !== dragId)) return;
  dragId = null; drawStick();
}
cvs.addEventListener('pointerdown', function (e) {
  unlockAudio();
  if (dragId !== null) return; // 2本目の指は無視
  dragId = e.pointerId;
  dragSX = dragX = e.clientX; dragSY = dragY = e.clientY;
  try { cvs.setPointerCapture(e.pointerId); } catch (er) {}
  if (e.preventDefault) e.preventDefault();
  drawStick();
});
window.addEventListener('pointermove', function (e) {
  if (dragId === null || e.pointerId !== dragId) return;
  dragX = e.clientX; dragY = e.clientY;
  const dx = dragX - dragSX, dy = dragY - dragSY, l = Math.hypot(dx, dy);
  if (l > STICK_R) { dragSX = dragX - dx / l * STICK_R; dragSY = dragY - dy / l * STICK_R; }
  drawStick();
});
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
function releaseAll() { dragId = null; drawStick(); for (const k in keys) keys[k] = false; }
window.addEventListener('blur', releaseAll);
if (typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
  // iOS Safari: user-scalable=no を無視するのでピンチ/ダブルタップ拡大を止める
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { if (e.target === cvs) e.preventDefault(); });
}
function readInput() {
  if (dragId !== null) {
    const dx = dragX - dragSX, dy = dragY - dragSY;
    const l = Math.hypot(dx, dy);
    if (l > STICK_DEAD) return { x: dx / l, z: dy / l };
    return { x: 0, z: 0 };
  }
  let x = 0, z = 0;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (keys['w'] || keys['arrowup']) z -= 1;
  if (keys['s'] || keys['arrowdown']) z += 1;
  return { x: x, z: z };
}

// ================= HUD =================
const el = {
  hud: $('hud'), stage: $('hudStage'), time: $('hudTime'), hearts: $('hudHearts'),
  score: $('hudScore'), fill: $('infectFill'), infText: $('infectText'),
  chain: $('chainPop'), toast: $('toast'), btnSound: $('btnSound'),
  chainWrap: $('chainWrap'), chainFill: $('chainFill'), chainText: $('chainText'),
  feverFx: $('feverFx'), feverPop: $('feverPop'),
};
let hudCache = {};
function setText(key, node, val) { if (hudCache[key] !== val) { hudCache[key] = val; node.textContent = val; } }
function updateHUD() {
  const st = STAGES[G.stageIdx];
  setText('stage', el.stage, '');
  el.stage.innerHTML = 'STAGE ' + (G.stageIdx + 1) + '　' + st.name + '<small>' + st.sub + '</small>';
  const t = Math.ceil(G.timeLeft);
  setText('time', el.time, '' + t);
  el.time.className = t <= 10 && G.phase === 'play' ? 'warn' : '';
  el.time.id = 'hudTime';
  setText('hearts', el.hearts, '❤'.repeat(Math.max(0, G.hearts)) + '🖤'.repeat(Math.max(0, 3 - G.hearts)));
  setText('score', el.score, '' + G.score);
  const inf = G.infectedCount();
  el.fill.style.width = (G.totalNpc ? (inf / G.totalNpc) * 100 : 0) + '%';
  setText('inf', el.infText, '感染 ' + inf + ' / ' + G.totalNpc);
  const cl = G.chainTimeLeft();
  if (G.chain >= 2 && cl > 0 && G.phase === 'play') {
    el.chainWrap.style.display = 'block';
    el.chainFill.style.width = (cl / CFG.chainWindow) * 100 + '%';
    setText('chainT', el.chainText, G.chain + '連鎖キープ中…あと ' + cl.toFixed(1) + '秒で途切れる');
  } else {
    el.chainWrap.style.display = 'none';
  }
  const fv = G.fever > 0 ? 'on' : '';
  if (hudCache.fever !== fv) { hudCache.fever = fv; el.feverFx.className = fv; }
}
let toastTimer = 0;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2300);
}
function showChain(n) {
  el.chain.textContent = n + '連鎖！';
  el.chain.classList.remove('show');
  void el.chain.offsetWidth;
  el.chain.classList.add('show');
}
function showFeverPop() {
  el.feverPop.textContent = '🔥 FEVER!! 🔥';
  el.feverPop.classList.remove('show');
  void el.feverPop.offsetWidth;
  el.feverPop.classList.add('show');
}

// ================= ゲームフロー =================
let G = DM.createGame((Math.random() * 1e9) | 0);
let started = false;
let camShake = 0;
let snapshotURL = null;
let endTimer = -1;

function setupStage() {
  buildWorld(G.stageIdx);
  for (let i = 0; i < npcPersons.length; i++) {
    const P = npcPersons[i], n = G.npcs[i];
    if (!n) { P.root.visible = false; P.groundG.visible = false; continue; }
    P.root.visible = true; P.groundG.visible = true;
    P.torso.material = n.stubborn ? MAT.stubborn : MAT.shirt[n.colorIdx];
    if (P.ring) P.ring.visible = false;
  }
  for (let i = 0; i < guardPersons.length; i++) { guardPersons[i].root.visible = !!G.guards[i]; guardPersons[i].groundG.visible = !!G.guards[i]; }
  playerPerson.root.visible = true;
  hudCache = {};
  updateHUD();
}
function snapshot() {
  try { snapshotURL = renderer.domElement.toDataURL('image/png'); } catch (e) { snapshotURL = null; }
}
function handleEvents(evs) {
  for (const ev of evs) {
    if (ev.type === 'infect') {
      spawnFx(ev.x, ev.z, 0xffcf3f); spawnNoteFx(ev.x, ev.z);
      sInfect(ev.chain);
      if (ev.chain >= 3) showChain(ev.chain);
      updateHUD();
    } else if (ev.type === 'fever') {
      sFever(); showFeverPop(); buzz([40, 40, 40]);
      showToast('フィーバー！ 警備員も踊り出した！');
      updateHUD();
    } else if (ev.type === 'cure') {
      spawnFx(ev.x, ev.z, 0x9fb6cc); sCure();
      showToast('警備員の説教…1人が正気に戻った');
      updateHUD();
    } else if (ev.type === 'catch') {
      sCatch(); camShake = 0.6; buzz(120);
      showToast(ev.hearts > 0 ? '捕まった！ 残り❤×' + ev.hearts : '捕まった…');
      updateHUD();
    } else if (ev.type === 'clear') {
      sClear(); snapshot();
      endTimer = 0.9;
      pendingEnd = function () { showStagePanel(ev.bonus); };
    } else if (ev.type === 'goal') {
      sClear(); snapshot();
      endTimer = 0.9;
      pendingEnd = function () { showResult(true, ''); };
    } else if (ev.type === 'over') {
      sCatch(); snapshot();
      endTimer = 0.9;
      pendingEnd = function () { showResult(false, ev.reason); };
    }
  }
}
let pendingEnd = null;
function showStagePanel(bonus) {
  $('stageStats').innerHTML =
    'クリアボーナス <span class="big">+' + bonus + '</span><br>' +
    'スコア <span class="big">' + G.score + '</span>　最大 ' + G.maxChain + ' 連鎖';
  $('stagePanel').style.display = 'flex';
}
function buildResultImage(done) {
  if (!snapshotURL) { done(null); return; }
  const img = new Image();
  img.onload = function () {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630;
    const cx = cv.getContext('2d');
    const sc = Math.max(1200 / img.width, 630 / img.height);
    const w = img.width * sc, h = img.height * sc;
    cx.drawImage(img, (1200 - w) / 2, (630 - h) / 2, w, h);
    const gr = cx.createLinearGradient(0, 330, 0, 630);
    gr.addColorStop(0, 'rgba(10,6,24,0)'); gr.addColorStop(1, 'rgba(10,6,24,0.88)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 1200, 630);
    cx.textAlign = 'left';
    cx.fillStyle = '#ffcf3f'; cx.font = '900 54px sans-serif';
    cx.fillText('ダンシングマニア（仮）', 48, 452);
    cx.fillStyle = '#ffffff'; cx.font = '700 40px sans-serif';
    cx.fillText('スコア ' + G.score + '　最大 ' + G.maxChain + ' 連鎖', 48, 516);
    cx.fillStyle = '#ff5da2'; cx.font = '900 44px sans-serif';
    cx.fillText('称号「' + DM.rankFor(G.score) + '」', 48, 578);
    done(cv.toDataURL('image/png'));
  };
  img.onerror = function () { done(null); };
  img.src = snapshotURL;
}
function showResult(goal, reason) {
  $('resultTitle').textContent = goal ? '🎉 全ステージ制覇！' : (reason === 'caught' ? '警備員に捕まった…' : '時間切れ…');
  $('resultStats').innerHTML =
    '到達： STAGE ' + (G.stageIdx + 1) + ' / ' + STAGES.length + '<br>' +
    'スコア <span class="big">' + G.score + '</span><br>' +
    '最大 ' + G.maxChain + ' 連鎖　感染させた人数 のべ ' + G.totalInfectedEver + ' 人';
  $('resultRank').textContent = '「' + DM.rankFor(G.score) + '」';
  buildResultImage(function (url) {
    const im = $('resultImg');
    if (url) { im.src = url; im.style.display = 'block'; $('btnSaveImg').href = url; }
    else im.style.display = 'none';
  });
  const txt = goal
    ? '『ダンシングマニア（仮）』全ステージ制覇！全員踊らせた💃 スコア' + G.score + ' 最大' + G.maxChain + '連鎖 称号「' + DM.rankFor(G.score) + '」 #ダンシングマニア #ブラウザゲーム'
    : '『ダンシングマニア（仮）』スコア' + G.score + ' 最大' + G.maxChain + '連鎖 称号「' + DM.rankFor(G.score) + '」だった。変な踊りは感染する💃 #ダンシングマニア #ブラウザゲーム';
  $('btnShareX').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt);
  $('resultPanel').style.display = 'flex';
}

$('btnStart').addEventListener('click', function () {
  unlockAudio();
  $('titlePanel').style.display = 'none';
  el.hud.style.display = 'block';
  el.btnSound.style.display = 'block';
  started = true;
  G.startStage(0);
  setupStage();
  showToast('STAGE 1　' + STAGES[0].name + ' ― 全員踊らせろ！');
});
$('btnNext').addEventListener('click', function () {
  unlockAudio();
  $('stagePanel').style.display = 'none';
  G.startStage(G.stageIdx + 1);
  setupStage();
  showToast('STAGE ' + (G.stageIdx + 1) + '　' + STAGES[G.stageIdx].name + ' ― 全員踊らせろ！');
});
$('btnRetry').addEventListener('click', function () {
  unlockAudio();
  $('resultPanel').style.display = 'none';
  G = DM.createGame((Math.random() * 1e9) | 0);
  G.startStage(0);
  setupStage();
  showToast('STAGE 1　' + STAGES[0].name + ' ― 全員踊らせろ！');
});
el.btnSound.addEventListener('click', function () {
  soundOn = !soundOn;
  if (soundOn) unlockAudio();
  try { localStorage.setItem('dm_sound', soundOn ? '1' : '0'); } catch (e) {}
  el.btnSound.textContent = soundOn ? '🔊 音ON' : '🔇 音OFF';
});
el.btnSound.textContent = soundOn ? '🔊 音ON' : '🔇 音OFF';

// ================= メインループ =================
function syncPersons(t, dt) {
  const P = G.player, PP = playerPerson;
  const rs = G.fever > 0 ? CFG.feverRadiusMul : 1;
  PP.root.position.x = P.x; PP.root.position.z = P.z;
  PP.groundG.position.x = P.x; PP.groundG.position.z = P.z;
  PP.root.rotation.y = P.face + danceSpinOffset(t);
  dancePose(PP, t);
  if (PP.ring) PP.ring.scale.set(rs, 1, rs);
  PP.root.visible = P.invuln > 0 ? (Math.floor(t * 12) % 2 === 0) : true;
  MAT.ringP.opacity = 0.52 + Math.sin(t * 4) * 0.16;
  if (PP.marker) PP.marker.position.y = 2.45 + Math.sin(t * 3) * 0.08;
  for (let i = 0; i < G.npcs.length; i++) {
    const n = G.npcs[i], Q = npcPersons[i];
    if (!Q || !Q.root.visible) continue;
    Q.root.position.x = n.x; Q.root.position.z = n.z;
    Q.groundG.position.x = n.x; Q.groundG.position.z = n.z;
    if (n.state === 'dancer') {
      Q.root.rotation.y = n.dir + danceSpinOffset(t);
      dancePose(Q, t);
      if (Q.ring) { Q.ring.visible = true; Q.ring.scale.set(rs, 1, rs); }
      Q.note.material.opacity = 0;
      Q.anger.material.opacity = n.cureProg > 0 ? Math.min(1, n.cureProg + 0.2) : 0;
    } else {
      Q.root.rotation.y = n.dir;
      if (n.stand) idlePose(Q, t, n.id); else walkPose(Q, dt, false);
      if (Q.ring) Q.ring.visible = false;
      Q.anger.material.opacity = 0;
      if (n.exposure > 0.02) {
        Q.note.material.opacity = Math.min(1, n.exposure + 0.2);
        const s = 0.55 + n.exposure * 0.55;
        Q.note.scale.set(s, s, 1);
        Q.note.position.y = 2.2 + Math.sin(t * 6 + n.id) * 0.06;
      } else Q.note.material.opacity = 0;
    }
  }
  for (let i = 0; i < G.guards.length; i++) {
    const g = G.guards[i], Q = guardPersons[i];
    if (!Q) continue;
    Q.root.position.x = g.x; Q.root.position.z = g.z;
    Q.groundG.position.x = g.x; Q.groundG.position.z = g.z;
    Q.root.rotation.y = g.face;
    const curing = g.mode === 'cure' && g.cureT > 0;
    if (G.fever > 0) { Q.root.rotation.y = g.face + danceSpinOffset(t); dancePose(Q, t); }
    else if (curing) scoldPose(Q, t);
    else walkPose(Q, dt, g.mode === 'chase');
  }
}
// 縦持ち(縦長画面)では左右が見えなくなるので、画角を広げてカメラを少し引く。横長(PC)は従来どおり。
let camDist = 1;
function fitCamera() {
  const a = window.innerWidth / window.innerHeight;
  const k = a < 1 ? Math.min(1, (1 - a) / 0.5) : 0; // 正方形で0、縦横比1:2で1
  camera.fov = 50 + 14 * k;
  camDist = 1 + 0.28 * k;
  camera.aspect = a;
  camera.updateProjectionMatrix();
}
fitCamera();
// 描画が重い端末では解像度を段階的に下げる(下げるだけで戻さない)。プレイ中の平均フレーム時間で判定。
let qT = 0, qN = 0;
function adaptQuality(dt) {
  if (!(started && G.phase === 'play') || pixelRatio <= 1) { qT = 0; qN = 0; return; }
  qT += dt; qN++;
  if (qT < 2) return;
  const avg = qT / qN; qT = 0; qN = 0;
  if (avg > 1 / 45) {
    pixelRatio = Math.max(1, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
const camPos = new THREE.Vector3(0, 33 * camDist, 22 + 25 * camDist);
let lastT = performance.now() / 1000;
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() / 1000;
  let dt = now - lastT; lastT = now;
  if (dt > 0.06) dt = 0.06;
  if (started && G.phase === 'play') {
    G.update(dt, readInput());
    handleEvents(G.drainEvents());
    updateHUD();
  } else {
    G.drainEvents();
  }
  if (endTimer > 0) {
    endTimer -= dt;
    if (endTimer <= 0 && pendingEnd) { const f = pendingEnd; pendingEnd = null; f(); }
  }
  adaptQuality(dt);
  syncPersons(now, dt);
  updateFx(dt);
  if (camShake > 0) camShake = Math.max(0, camShake - dt);
  const shX = camShake > 0 ? (Math.random() - 0.5) * camShake * 1.6 : 0;
  const shY = camShake > 0 ? (Math.random() - 0.5) * camShake * 1.6 : 0;
  camPos.x += ((G.player.x) - camPos.x) * Math.min(1, dt * 3.2);
  camPos.z += ((G.player.z + 25 * camDist) - camPos.z) * Math.min(1, dt * 3.2);
  camera.position.set(camPos.x + shX, 33 * camDist + shY, camPos.z);
  camera.lookAt(G.player.x + shX, 0, G.player.z - 3);
  renderer.render(scene, camera);
}
function onResize() {
  fitCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', function () { setTimeout(onResize, 250); });

// タイトル画面の背景としてステージ1を配置
G.startStage(0);
G.phase = 'ready';
setupStage();
animate();

globalThis.__DM_UI__ = { get G() { return G; }, setupStage: setupStage };
})();
