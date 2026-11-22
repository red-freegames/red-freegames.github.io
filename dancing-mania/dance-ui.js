// 『ダンシングマニア』描画/UI: THREE r128 + dance-core.js の上に構築
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
function seq(notes, gap, type, vol, dur) { for (let i = 0; i < notes.length; i++) (function (f, d) { setTimeout(function () { beep(f, dur || 0.22, type || 'triangle', vol || 0.12); }, d); })(notes[i], i * gap); }
function sTrain() { seq([784, 659], 260, 'sine', 0.13, 0.35); }
function sBurst() { seq([523, 659, 784, 1047, 1319], 55, 'square', 0.09, 0.16); }
function sBell() { seq([659, 523, 587, 392], 420, 'sine', 0.14, 0.5); }
function sDrum() { beep(90, 0.22, 'sine', 0.3, 55); setTimeout(function () { beep(90, 0.22, 'sine', 0.3, 55); }, 160); }
function sRain() { seq([440, 392, 349], 120, 'sine', 0.08, 0.3); }
function sEscape() { beep(260, 0.25, 'triangle', 0.1, 180); }
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
const hemi = new THREE.HemisphereLight(0xffffff, 0x445577, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(18, 32, 12);
scene.add(sun);

// STAGES と同じ順。足すときは1件ずつ。
const THEMES = [
  { sky: 0x9fd4ff, ground: 0x7d8aa0, arena: 0xb9c2cf, accent: 0xff5da2, prop: 'plaza' },     // 駅前広場
  { sky: 0xffd9e4, ground: 0xd9b98c, arena: 0xf7ead0, accent: 0xd94f70, prop: 'wedding' },   // 披露宴
  { sky: 0x1d2445, ground: 0x2f2c3d, arena: 0x9c8c72, accent: 0xff6a3d, prop: 'festival' },  // 夏祭り(夜)
  { sky: 0xb4bfcc, ground: 0x6d7682, arena: 0xa3acb6, accent: 0x3fa7e0, prop: 'shops' },     // 雨の商店街
  { sky: 0xd6ecff, ground: 0xb7c2cf, arena: 0xeef1f5, accent: 0x3f7fe0, prop: 'airport' },   // 空港ロビー
  { sky: 0xa9c3e6, ground: 0x4d5c6e, arena: 0x71808f, accent: 0xffcf3f, prop: 'office' },    // オフィス街
  { sky: 0xf2b27c, ground: 0x6e5a48, arena: 0xb09c7e, accent: 0x8b2b2b, prop: 'oldtown' },   // 1518年 大聖堂前
];
let curTheme = THEMES[0];
const worldG = new THREE.Group();
let trainG = null, lastTrainAt = -99, walkFx = [];
scene.add(worldG);

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); worldG.add(m); return m;
}
function buildWorld(idx) {
  lastTrainAt = -99;
  while (worldG.children.length) worldG.remove(worldG.children[0]);
  const th = THEMES[idx % THEMES.length];
  curTheme = th; walkFx = [];
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
  const lanternM = new THREE.MeshBasicMaterial({ color: 0xffa34d });
  const shopM = [0xe8a87c, 0x9fc7a8, 0xd9c27a, 0xb8a3d6, 0xe0e0d6].map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); });
  const glassM = new THREE.MeshLambertMaterial({ color: 0x9cc6ea });
  const roofM = new THREE.MeshLambertMaterial({ color: 0x8b3a2b });
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
    } else if (th.prop === 'festival') { // 木と提灯の柱
      if (i % 2) {
        box(0.45, 1.1, 0.45, trunk, x, 0.55, z);
        const c = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.6, 8), new THREE.MeshLambertMaterial({ color: 0x24563a })); c.position.set(x, 3.3, z); worldG.add(c);
      } else {
        box(0.25, 4.5, 0.25, trunk, x, 2.25, z);
        box(0.7, 0.9, 0.7, lanternM, x, 4.2, z);
      }
    } else if (th.prop === 'shops') { // 色とりどりの低い店
      const h = 4 + rnd() * 3;
      box(6 + rnd() * 3, h, 5, shopM[i % shopM.length], x, h / 2, z);
    } else if (th.prop === 'airport') { // ガラス張りのターミナル
      const h = 6 + rnd() * 4;
      box(7 + rnd() * 3, h, 6, glassM, x, h / 2, z);
    } else if (th.prop === 'oldtown') { // 中世の家(三角屋根)
      const h = 4 + rnd() * 3, w = 5 + rnd() * 2;
      box(w, h, 5, shopM[(i + 2) % shopM.length], x, h / 2, z);
      const r = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, 2.6, 4), roofM); r.position.set(x, h + 1.3, z); r.rotation.y = Math.PI / 4; worldG.add(r);
    } else {
      box(0.45, 1.1, 0.45, trunk, x, 0.55, z);
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.6, 8), leaf);
      c.position.set(x, 2.9, z); worldG.add(c);
      box(2.4, 0.5, 0.8, trunk, x + 2.6, 0.25, z);
    }
  }
  // ステージの仕掛けの舞台装置
  const gm = G && STAGES[idx].gimmick;
  if (gm === 'train') { // 駅舎・改札・線路
    box(20, 7, 5, build, 0, 3.5, -37.5);
    box(20.6, 0.5, 5.6, accMat, 0, 7.2, -37.5);
    box(56, 0.12, 2.6, new THREE.MeshLambertMaterial({ color: 0x5a4a3a }), 0, 0.06, -31);
    box(0.35, 2.2, 0.35, tableM, CFG.gate[0] - 3, 1.1, -28.6); box(0.35, 2.2, 0.35, tableM, CFG.gate[0] + 3, 1.1, -28.6);
    box(6.6, 0.5, 0.4, accMat, CFG.gate[0], 2.3, -28.6);
  } else if (gm === 'couple') { // 高砂席(新郎新婦の席)とアーチ
    const tx = CFG.coupleTable[0], tz = CFG.coupleTable[1] - 1.3;
    box(4.4, 1.0, 1.3, tableM, tx, 0.5, tz);
    box(4.6, 0.12, 1.5, accMat, tx, 1.05, tz);
    box(0.3, 3.6, 0.3, tableM, tx - 2.6, 1.8, tz - 0.9); box(0.3, 3.6, 0.3, tableM, tx + 2.6, 1.8, tz - 0.9);
    box(5.6, 0.45, 0.45, accMat, tx, 3.7, tz - 0.9);
  } else if (gm === 'bell') { // オフィスの入口
    const doorM = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    for (const d of CFG.doors) {
      box(7, 10, 3, build2, d[0], 5, -31.5);
      box(2.6, 3.2, 0.3, doorM, d[0], 1.6, -29.9);
    }
  }
  else if (gm === 'yagura') { // やぐら(中央)と提灯のロープ
    const redM = new THREE.MeshLambertMaterial({ color: 0xc8322b });
    for (const sx of [-1.6, 1.6]) for (const sz of [-1.6, 1.6]) box(0.3, 4.2, 0.3, trunk, sx, 2.1, sz);
    box(4.2, 0.4, 4.2, tableM, 0, 2.6, 0);
    box(4.4, 0.8, 4.4, redM, 0, 2.0, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4), redM); roof.position.set(0, 5.0, 0); roof.rotation.y = Math.PI / 4; worldG.add(roof);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.1, 14), new THREE.MeshLambertMaterial({ color: 0x7a3b1f })); drum.position.set(0, 3.4, 0); drum.rotation.x = Math.PI / 2; worldG.add(drum);
    for (const c of [[-26, -26], [26, -26], [-26, 26], [26, 26]]) for (let k = 1; k <= 5; k++) {
      const f = k / 6; box(0.55, 0.7, 0.55, lanternM, c[0] * f, 5.2 - Math.sin(f * Math.PI) * 1.2, c[1] * f);
    }
  } else if (gm === 'rain') { // アーケード(雨宿りの屋根)
    const st = STAGES[idx];
    const stripe = [accMat, tableM];
    for (const sh of st.shelters) {
      const out = sh[0] > 0 ? 1 : -1;
      box(0.25, 3.2, 0.25, trunk, sh[0] - out * 2, 1.6, sh[1] - 3); box(0.25, 3.2, 0.25, trunk, sh[0] - out * 2, 1.6, sh[1] + 3);
      for (let k = 0; k < 6; k++) { const m = box(4.6, 0.18, 1.05, stripe[k % 2], sh[0] + out * 0.3, 3.3, sh[1] - 2.6 + k * 1.05); m.rotation.z = -out * 0.18; }
    }
  } else if (gm === 'walkway') { // 動く歩道(矢印が流れる)
    const beltM = new THREE.MeshLambertMaterial({ color: 0x39414d }), arrowM = new THREE.MeshBasicMaterial({ color: 0x7fd0ff });
    for (const w of STAGES[idx].walkways) {
      box(w.x1 - w.x0, 0.12, w.w, beltM, (w.x0 + w.x1) / 2, 0.06, w.z);
      box(w.x1 - w.x0, 0.6, 0.18, accMat, (w.x0 + w.x1) / 2, 0.3, w.z - w.w / 2 - 0.1);
      box(w.x1 - w.x0, 0.6, 0.18, accMat, (w.x0 + w.x1) / 2, 0.3, w.z + w.w / 2 + 0.1);
      for (let k = 0; k < 9; k++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 3), arrowM);
        m.rotation.x = -Math.PI / 2; m.rotation.z = w.v > 0 ? -Math.PI / 2 : Math.PI / 2; m.scale.set(1, 1, 0.15);
        m.position.set(w.x0 + (k + 0.5) * (w.x1 - w.x0) / 9, 0.16, w.z); worldG.add(m);
        walkFx.push({ m: m, w: w });
      }
    }
    box(40, 9, 1, glassM, 0, 4.5, -33); // ガラスの壁
  } else if (gm === 'band') { // 大聖堂と噴水
    const stone = new THREE.MeshLambertMaterial({ color: 0xc9b89a }), stone2 = new THREE.MeshLambertMaterial({ color: 0xa8977a });
    box(16, 12, 8, stone, 0, 6, -38);
    box(4.5, 22, 4.5, stone2, -6, 11, -36); box(4.5, 22, 4.5, stone2, 6, 11, -36);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(2.6, 9, 4), roofM); sp.position.set(6, 26.5, -36); sp.rotation.y = Math.PI / 4; worldG.add(sp);
    const sp2 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 4), roofM); sp2.position.set(-6, 24.5, -36); sp2.rotation.y = Math.PI / 4; worldG.add(sp2);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.8, 18), stone2); basin.position.set(0, 0.4, 0); worldG.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.1, 18), new THREE.MeshBasicMaterial({ color: 0x6fb6d9 })); water.position.set(0, 0.82, 0); worldG.add(water);
    box(0.5, 2.2, 0.5, stone, 0, 1.1, 0);
  }
  // 電車(駅のみ。位置は毎フレーム updateTrain で動かす)
  trainG = null;
  if (gm === 'train') {
    trainG = new THREE.Group();
    const body = new THREE.MeshLambertMaterial({ color: 0xe8edf2 }), line = new THREE.MeshLambertMaterial({ color: 0x2f9e5a });
    for (let c = 0; c < 3; c++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(11.4, 2.6, 2.4), body); car.position.set(c * 11.8 - 11.8, 1.45, 0); trainG.add(car);
      const st = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.35, 2.45), line); st.position.set(c * 11.8 - 11.8, 1.2, 0); trainG.add(st);
    }
    trainG.position.set(-200, 0, -31); worldG.add(trainG);
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
  djShirt: new THREE.MeshLambertMaterial({ color: 0x39ff6a }),
  bandShirt: new THREE.MeshLambertMaterial({ color: 0xa3232f }),
  gold: new THREE.MeshLambertMaterial({ color: 0xe0b23a }),
  phones: new THREE.MeshLambertMaterial({ color: 0x15151c }),
  bride: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  groom: new THREE.MeshLambertMaterial({ color: 0x23232e }),
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
  // 特別な通行人用の小物(普段は非表示): DJのヘッドホン、新婦のドレス
  const phones = new THREE.Group();
  phones.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.12), MAT.phones)); phones.children[0].position.y = 0.43;
  const cupL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), MAT.phones); cupL.position.set(-0.22, 0.24, 0); phones.add(cupL);
  const cupR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), MAT.phones); cupR.position.set(0.22, 0.24, 0); phones.add(cupR);
  phones.visible = false; headG.add(phones);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.62, 0.8, 12), MAT.bride);
  skirt.position.y = 0.42; skirt.visible = false; root.add(skirt);
  let marker = null;
  if (o.marker) {
    marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, transparent: true, depthWrite: false }));
    marker.position.y = 2.45; marker.scale.set(0.7, 0.7, 1); root.add(marker);
  }
  scene.add(root);
  return { phones: phones, skirt: skirt, root: root, groundG: groundG, legL: legL, legR: legR, armL: armL, armR: armR, headG: headG, torso: torso, note: note, anger: anger, ring: ring, marker: marker, wp: Math.random() * 6 };
}
const playerPerson = makePerson({ shirt: MAT.playerShirt, pants: MAT.playerPants, skin: MAT.skin[0], ring: 'player', marker: true });
const npcPersons = [];
for (let i = 0; i < 52; i++) npcPersons.push(makePerson({ shirt: MAT.shirt[i % 8], pants: MAT.pants[i % 4], skin: MAT.skin[i % 3], ring: 'dancer' }));
const bandPersons = [];
for (let i = 0; i < 3; i++) {
  const bp = makePerson({ shirt: MAT.bandShirt, pants: MAT.guardPants, skin: MAT.skin[(i + 1) % 3] });
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.42, 10), MAT.phones); hat.position.y = 0.6; bp.headG.add(hat);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 10), MAT.gold); horn.rotation.x = Math.PI / 2; horn.position.set(0, 1.45, 0.55); bp.root.add(horn);
  bp.root.visible = false; bp.groundG.visible = false;
  bandPersons.push(bp);
}
const guardPersons = [];
for (let i = 0; i < 4; i++) guardPersons.push(makePerson({ shirt: MAT.guardShirt, pants: MAT.guardPants, skin: MAT.skin[i % 3], cap: true, band: true }));

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
// 踊りの型。どの型でも全員が同じ位相 p = t*9.0 で踊る(シンクロが本作のキモ)。
// 1拍目の決めポーズと8拍目のフリーズは全型共通、16拍に1回の回転も共通。
let danceStyle = 'basic';
const GROOVES = {
  basic: function (P, p, b, cyc) {
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
    if (cyc >= 4 && cyc < 6) { // 左腕は風車ぐるぐる、右腕は鳥の羽ばたき
      P.armL.rotation.x = p * 2.2; P.armL.rotation.z = 0.15;
      P.armR.rotation.x = -0.9;
      P.armR.rotation.z = -0.9 - Math.abs(Math.sin(p * 3)) * 0.7;
    }
  },
  robot: function (P, p, b, cyc) { // 半拍ごとにカクッと切り替わる
    const st = Math.floor(cyc * 2) % 4, side = Math.floor(cyc) % 2 ? 1 : -1;
    P.root.position.y = 0; P.root.rotation.z = 0;
    const L = [-1.57, 0, -1.57, -3.0][st], R = [0, -1.57, -1.57, 0][st];
    P.armL.rotation.x = L; P.armL.rotation.z = st === 3 ? 0.2 : 0.05;
    P.armR.rotation.x = R; P.armR.rotation.z = -0.05;
    P.legL.rotation.x = st === 1 ? -0.35 : 0; P.legR.rotation.x = st === 3 ? -0.35 : 0;
    P.torso.rotation.x = 0; P.torso.rotation.z = 0; P.torso.rotation.y = side * 0.35;
    P.headG.rotation.x = 0; P.headG.rotation.z = 0; P.headG.rotation.y = -side * 0.5;
  },
  bon: function (P, p, b, cyc) { // 半分のテンポで、両手を同じ向きへ流す
    const q = p * 0.5, s = Math.sin(q);
    P.root.position.y = Math.abs(s) * 0.05; P.root.rotation.z = 0;
    P.armL.rotation.x = 2.3 + s * 0.25; P.armR.rotation.x = 2.3 - s * 0.25;
    P.armL.rotation.z = 0.3 + s * 0.6; P.armR.rotation.z = -0.3 + s * 0.6;
    P.legL.rotation.x = Math.max(0, s) * -0.5; P.legR.rotation.x = Math.max(0, -s) * -0.5;
    P.torso.rotation.x = 0; P.torso.rotation.z = s * 0.15; P.torso.rotation.y = s * 0.25;
    P.headG.rotation.x = 0.1; P.headG.rotation.z = s * 0.2;
  },
  twist: function (P, p, b, cyc) { // 腰を落として上半身と頭を逆にひねる
    const s = Math.sin(p);
    P.root.position.y = b * 0.05 - 0.1; P.root.rotation.z = 0;
    P.armL.rotation.x = -s * 0.7; P.armR.rotation.x = s * 0.7;
    P.armL.rotation.z = 1.1 + s * 0.2; P.armR.rotation.z = -1.1 + s * 0.2;
    P.legL.rotation.x = -0.3 + s * 0.25; P.legR.rotation.x = -0.3 - s * 0.25;
    P.torso.rotation.x = 0.12; P.torso.rotation.z = 0; P.torso.rotation.y = s * 0.8;
    P.headG.rotation.x = 0; P.headG.rotation.z = 0; P.headG.rotation.y = -s * 0.5;
  },
  mania: function (P, p, b, cyc) { // 両腕逆回転の風車・ヘドバン・大ジャンプ
    P.root.position.y = b * 0.24 - 0.03; P.root.rotation.z = Math.sin(p) * 0.12;
    P.armL.rotation.x = p * 2.4; P.armR.rotation.x = -p * 2.4 + Math.PI;
    P.armL.rotation.z = 0.35; P.armR.rotation.z = -0.35;
    P.legL.rotation.x = Math.sin(p) * 0.9; P.legR.rotation.x = -Math.sin(p) * 0.9;
    P.torso.rotation.x = Math.sin(p * 2) * 0.2; P.torso.rotation.z = 0; P.torso.rotation.y = Math.sin(p * 0.5) * 0.6;
    P.headG.rotation.x = Math.sin(p * 2) * 0.5; P.headG.rotation.z = 0;
  },
};
function dancePose(P, t) {
  const p = t * 9.0;
  const b = Math.abs(Math.sin(p));
  const cyc = (t * 9.0 / Math.PI) % 8;
  P.headG.rotation.y = 0;
  (GROOVES[danceStyle] || GROOVES.basic)(P, p, b, cyc);
  if (cyc < 1) { // 決めポーズ: 両手を上げる(全員同時)
    P.armL.rotation.x = 2.9 + Math.sin(p * 3) * 0.12; P.armL.rotation.z = 0.22;
    P.armR.rotation.x = 2.9 - Math.sin(p * 3) * 0.12; P.armR.rotation.z = -0.22;
  } else if (cyc >= 7) { // 全員フリーズ(変なポーズで完全静止)
    P.armL.rotation.x = 2.7; P.armL.rotation.z = 0.9;
    P.armR.rotation.x = -1.3; P.armR.rotation.z = -1.1;
    P.legL.rotation.x = 0.35; P.legR.rotation.x = -0.25;
    P.torso.rotation.y = 0.55; P.torso.rotation.z = 0.2; P.torso.rotation.x = 0;
    P.headG.rotation.z = 0.42; P.headG.rotation.x = 0.15; P.headG.rotation.y = 0;
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
  P.headG.rotation.z = 0; P.headG.rotation.x = 0; P.headG.rotation.y = 0; P.root.rotation.z = 0;
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
  feverFx: $('feverFx'), feverPop: $('feverPop'), gimmick: $('hudGimmick'),
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
  setText('gim', el.gimmick, gimmickText());
  el.gimmick.style.display = hudCache.gim ? 'block' : 'none';
  const fv = G.fever > 0 ? 'on' : '';
  if (hudCache.fever !== fv) { hudCache.fever = fv; el.feverFx.className = fv; }
}
function gimmickText() {
  if (G.phase !== 'play') return '';
  const gm = STAGES[G.stageIdx].gimmick;
  if (gm === 'train') {
    const t = G.nextTrainIn();
    return t >= 0 ? '🚃 次の電車まで ' + Math.ceil(t) + '秒（あと' + G.arrivals.length + '本）　改札から人が増える' : '';
  }
  if (gm === 'couple') {
    const left = G.npcs.some(function (n) { return (n.kind === 'bride' || n.kind === 'groom') && !n.burstUsed; });
    return left ? '💒 奥の新郎新婦を踊らせると、周りの客が一斉に踊る' : '';
  }
  if (gm === 'yagura') {
    if (G.drum > 0) return '🥁 ドドン！ 太鼓の間は感染範囲が広がる';
    return '🥁 次の太鼓まで ' + Math.ceil(G.nextDrumIn()) + '秒　やぐらの周りを回る人を狙え';
  }
  if (gm === 'rain') {
    if (G.rain > 0) return '☔ 雨宿り中！ アーケードの下に人が集まってる（あと' + Math.ceil(G.rain) + '秒）';
    return '☔ 次の雨まで ' + Math.ceil(G.nextRainIn()) + '秒　雨が降ると左右のアーケードに人が集まる';
  }
  if (gm === 'walkway') return '🛬 動く歩道に乗ると流される（警備員も）';
  if (gm === 'band') return '🎺 楽団のそばの人は勝手に踊り出す';
  if (gm === 'bell') {
    const b = G.bellIn();
    if (b >= 0) return '🔔 昼休み終了まで ' + Math.ceil(b) + '秒';
    return '🏢 入口に戻られると −' + CFG.escapePenalty + '秒' + (G.escaped ? '（' + G.escaped + '人戻った）' : '') + '　入口で待ち伏せろ！';
  }
  return '';
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
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
let bestScore = parseInt(lsGet('dm_best') || '0', 10) || 0;
let reach = Math.min(STAGES.length - 1, parseInt(lsGet('dm_reach') || '0', 10) || 0); // 到達した最大ステージ(0始まり)
let startIdx = 0;
function noteReach(idx) { if (idx > reach) { reach = idx; lsSet('dm_reach', '' + reach); renderStages(); } }
function renderStages() {
  const wrap = $('stageSel'); if (!wrap) return;
  wrap.style.display = reach > 0 ? 'block' : 'none';
  if (startIdx > reach) startIdx = 0;
  $('stageList').innerHTML = STAGES.map(function (st, i) {
    return '<button class="dBtn sBtn' + (i === startIdx ? ' on' : '') + (i > reach ? ' lock' : '') + '" data-stage="' + i + '" title="' + st.name + '">' + (i + 1) + '</button>';
  }).join('');
  $('stageName').textContent = 'STAGE ' + (startIdx + 1) + '　' + STAGES[startIdx].name + (startIdx > 0 ? '（スコアはここから）' : '');
}
function onStageClick(e) {
  const b = e.target && e.target.closest ? e.target.closest('[data-stage]') : null;
  if (!b) return;
  const i = parseInt(b.getAttribute('data-stage'), 10);
  if (i > reach) { $('stageName').textContent = '🔒 STAGE ' + i + ' まで進むと選べる'; return; }
  startIdx = i; renderStages();
}
if ($('stageList')) $('stageList').addEventListener('click', onStageClick);
let selDance = lsGet('dm_dance') || 'basic';
if (bestScore < DM.danceById(selDance).unlock) selDance = 'basic';
function newGame() { return DM.createGame((Math.random() * 1e9) | 0, { dance: selDance }); }
function renderDances() {
  const html = DM.DANCES.map(function (d) {
    const locked = bestScore < d.unlock;
    return '<button class="dBtn' + (d.id === selDance ? ' on' : '') + (locked ? ' lock' : '') + '" data-dance="' + d.id + '">' + (locked ? '🔒 ' : '') + d.name + '</button>';
  }).join('');
  const d = DM.danceById(selDance);
  ['danceList', 'danceList2'].forEach(function (id) { const e = $(id); if (e) e.innerHTML = html; });
  ['danceDesc', 'danceDesc2'].forEach(function (id) { const e = $(id); if (e) e.textContent = '「' + d.name + '」' + d.desc; });
}
function onDanceClick(e) {
  const b = e.target && e.target.closest ? e.target.closest('[data-dance]') : null;
  if (!b) return;
  const d = DM.danceById(b.getAttribute('data-dance'));
  if (bestScore < d.unlock) {
    const msg = '🔒 ベストスコア ' + d.unlock.toLocaleString() + ' で解放（称号「' + DM.rankFor(d.unlock) + '」）';
    ['danceDesc', 'danceDesc2'].forEach(function (id) { const x = $(id); if (x) x.textContent = msg; });
    return;
  }
  selDance = d.id; lsSet('dm_dance', selDance);
  renderDances();
  if (!inProgress()) danceStyle = selDance; // タイトル背景のプレビューにも反映。プレイ途中なら次にはじめる時から
}
['danceList', 'danceList2'].forEach(function (id) { const e = $(id); if (e) e.addEventListener('click', onDanceClick); });
renderDances();
renderStages();
// 遊び方: 縦に余裕のある画面では最初から開く(小さいスマホではボタンを優先して畳む)
if ($('howto') && window.innerHeight >= 760 && window.innerWidth >= 421) $('howto').open = true;
let G = newGame();
let started = false;
let camShake = 0;
let snapshotURL = null;
let endTimer = -1;

// STAGES と同じ順
const STAGE_HINT = ['電車が着くたびに人が増える！', '新郎新婦を踊らせろ！', '太鼓に合わせて広げろ！', 'にわか雨は好機！', '動く歩道を使いこなせ！', '昼休みが終わる前に！', '楽団が呼ばれた。踊りは止まらない'];
function stageToast() { showToast('STAGE ' + (G.stageIdx + 1) + '　' + STAGES[G.stageIdx].name + ' ― ' + STAGE_HINT[G.stageIdx]); }
function setupStage() {
  buildWorld(G.stageIdx);
  for (let i = 0; i < npcPersons.length; i++) {
    const P = npcPersons[i], n = G.npcs[i];
    if (!n) { P.root.visible = false; P.groundG.visible = false; continue; }
    const vis = n.state !== 'away' && n.state !== 'gone';
    P.root.visible = vis; P.groundG.visible = vis;
    P.torso.material = n.kind === 'dj' ? MAT.djShirt : n.kind === 'bride' ? MAT.bride : n.kind === 'groom' ? MAT.groom
      : n.stubborn ? MAT.stubborn : MAT.shirt[n.colorIdx];
    P.armL.children[0].material = P.armR.children[0].material = P.torso.material;
    const sc = n.kind === 'kid' ? 0.68 : 1;
    P.root.scale.set(sc, sc, sc);
    P.phones.visible = n.kind === 'dj';
    P.skirt.visible = n.kind === 'bride';
    if (P.ring) P.ring.visible = false;
  }
  for (let i = 0; i < guardPersons.length; i++) { guardPersons[i].root.visible = !!G.guards[i]; guardPersons[i].groundG.visible = !!G.guards[i]; }
  playerPerson.root.visible = true;
  danceStyle = G.dance.id;
  shownDJ = false; shownKid = false; shownDrum = false;
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
      if (ev.kind === 'dj' && !shownDJ) { shownDJ = true; showToast('🎧 DJが踊り出した！ 感染範囲が広い'); }
      else if (ev.kind === 'kid' && !shownKid) { shownKid = true; showToast('🧒 子どもが踊りながら走り回る！'); }
    } else if (ev.type === 'train') {
      lastTrainAt = G.elapsed; sTrain(); spawnFx(ev.x, ev.z, 0x9fd4ff);
      showToast('🚃 電車が着いた！ 改札から' + ev.n + '人');
      updateHUD();
    } else if (ev.type === 'burst') {
      sBurst(); camShake = 0.35; buzz([30, 30, 30]);
      for (let k = 0; k < 3; k++) spawnFx(ev.x + (k - 1) * 1.5, ev.z + 1, 0xff5da2);
      showToast('💒 ' + (ev.kind === 'bride' ? '新婦' : '新郎') + 'が踊り出した！ 周りの' + ev.n + '人も一斉に！');
      updateHUD();
    } else if (ev.type === 'drum') {
      sDrum(); camShake = Math.max(camShake, 0.2);
      for (let k = 0; k < 3; k++) spawnFx(Math.sin(k * 2.1) * 3.2, Math.cos(k * 2.1) * 3.2, 0xff6a3d);
      if (!shownDrum) { shownDrum = true; showToast('🥁 太鼓が鳴った！ 少しの間、感染範囲が広がる'); }
      updateHUD();
    } else if (ev.type === 'rain') {
      if (ev.on) { sRain(); showToast('☔ にわか雨！ みんなアーケードの下へ'); }
      else showToast('☀ 雨が上がった。みんな散っていく');
      updateHUD();
    } else if (ev.type === 'bell') {
      sBell(); buzz(80);
      showToast('🔔 昼休み終了！ みんなオフィスに戻り始めた');
      updateHUD();
    } else if (ev.type === 'escape') {
      sEscape(); spawnFx(ev.x, ev.z, 0x9fb6cc);
      showToast('1人オフィスに戻った…（−' + CFG.escapePenalty + '秒）');
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
let shownDJ = false, shownKid = false, shownDrum = false;
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
    cx.fillText('ダンシングマニア', 48, 452);
    cx.fillStyle = '#ffffff'; cx.font = '700 40px sans-serif';
    cx.fillText('スコア ' + G.score + '　最大 ' + G.maxChain + ' 連鎖', 48, 516);
    cx.fillStyle = '#ff5da2'; cx.font = '900 44px sans-serif';
    cx.fillText('称号「' + DM.rankFor(G.score) + '」', 48, 578);
    done(cv.toDataURL('image/png'));
  };
  img.onerror = function () { done(null); };
  img.src = snapshotURL;
}
const GAME_URL = 'https://red-freegames.github.io/dancing-mania/';
function showResult(goal, reason) {
  $('resultTitle').textContent = goal ? '🎉 全ステージ制覇！' : (reason === 'caught' ? '警備員に捕まった…' : '時間切れ…');
  $('resultStats').innerHTML =
    '到達： STAGE ' + (G.stageIdx + 1) + ' / ' + STAGES.length + (G.startIdx ? '（STAGE ' + (G.startIdx + 1) + ' から）' : '') + '<br>' +
    'スコア <span class="big">' + G.score + '</span><br>' +
    '最大 ' + G.maxChain + ' 連鎖　感染させた人数 のべ ' + G.totalInfectedEver + ' 人';
  $('resultRank').textContent = '「' + DM.rankFor(G.score) + '」';
  const prevBest = bestScore;
  if (G.score > bestScore) { bestScore = G.score; lsSet('dm_best', '' + bestScore); }
  const newly = DM.DANCES.filter(function (d) { return d.unlock > prevBest && d.unlock <= bestScore; });
  $('unlockMsg').innerHTML = newly.length ? '🎉 新しい踊り「' + newly.map(function (d) { return d.name; }).join('」「') + '」を解放！' : '';
  $('unlockMsg').style.display = newly.length ? 'block' : 'none';
  $('bestLine').textContent = 'ベスト ' + bestScore + (G.score >= bestScore && G.score > prevBest ? '（更新！）' : '');
  renderDances();
  buildResultImage(function (url) {
    const im = $('resultImg');
    if (url) { im.src = url; im.style.display = 'block'; $('btnSaveImg').href = url; }
    else im.style.display = 'none';
  });
  const txt = goal
    ? '『ダンシングマニア』全' + STAGES.length + 'ステージ制覇！全員踊らせた💃 スコア' + G.score + ' 最大' + G.maxChain + '連鎖 称号「' + DM.rankFor(G.score) + '」 #ダンシングマニア #ブラウザゲーム'
    : '『ダンシングマニア』STAGE' + (G.stageIdx + 1) + 'まで到達 スコア' + G.score + ' 最大' + G.maxChain + '連鎖 称号「' + DM.rankFor(G.score) + '」だった。変な踊りは感染する💃 #ダンシングマニア #ブラウザゲーム';
  $('btnShareX').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt) + '&url=' + encodeURIComponent(GAME_URL);
  $('resultPanel').style.display = 'flex';
}

// ================= HOME =================
// HOME はゲームの上に重ねて出す。プレイ中に開くと一時停止し、「続きから」で再開する。
let paused = false;
function inProgress() { return started && (G.phase === 'play' || G.phase === 'clear'); }
function showHome() {
  paused = true; releaseAll();
  const has = inProgress(), c = $('homeCont'), n = $('btnStart');
  c.style.display = has ? 'inline-block' : 'none';
  if (has) c.innerHTML = '▶ 続きから<small>STAGE ' + (G.stageIdx + 1) + '　' + STAGES[G.stageIdx].name + '・スコア ' + G.score + '</small>';
  n.textContent = has ? '最初からはじめる' : '▶ はじめる';
  n.className = has ? 'btn sub' : 'btn';
  renderDances(); renderStages();
  if (has) $('home').classList.add('inrun'); else $('home').classList.remove('inrun');
  $('home').style.display = 'flex';
  $('home').scrollTop = 0;
}
function hideHome() { $('home').style.display = 'none'; paused = false; }
function startNew() {
  unlockAudio();
  ['home', 'stagePanel', 'resultPanel', 'confirmPanel'].forEach(function (id) { $(id).style.display = 'none'; });
  el.hud.style.display = 'block';
  el.btnSound.style.display = 'block';
  $('btnHome').style.display = 'block';
  started = true; paused = false;
  endTimer = -1; pendingEnd = null;
  G = newGame();
  G.startIdx = startIdx;
  G.startStage(startIdx);
  setupStage();
  stageToast();
}
$('btnStart').addEventListener('click', function () {
  if (!inProgress()) { startNew(); return; }
  $('confirmText').textContent = 'STAGE ' + (G.stageIdx + 1) + '・スコア ' + G.score + ' のプレイは終わりになります。';
  $('confirmPanel').style.display = 'flex';
});
$('confirmNo').addEventListener('click', function () { $('confirmPanel').style.display = 'none'; });
$('confirmYes').addEventListener('click', startNew);
$('homeCont').addEventListener('click', function () { unlockAudio(); hideHome(); });
$('btnHome').addEventListener('click', showHome);
$('btnHomeStage').addEventListener('click', showHome);
$('btnHomeResult').addEventListener('click', showHome);
$('btnNext').addEventListener('click', function () {
  unlockAudio();
  $('stagePanel').style.display = 'none';
  G.startStage(G.stageIdx + 1);
  noteReach(G.stageIdx);
  setupStage();
  stageToast();
});
$('btnRetry').addEventListener('click', function () {
  unlockAudio();
  $('resultPanel').style.display = 'none';
  startIdx = G.startIdx || 0;
  startNew();
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
  const rs = (G.fever > 0 ? CFG.feverRadiusMul : 1) * (G.drum > 0 ? STAGES[G.stageIdx].drumMul : 1);
  PP.root.position.x = P.x; PP.root.position.z = P.z;
  PP.groundG.position.x = P.x; PP.groundG.position.z = P.z;
  PP.root.rotation.y = P.face + danceSpinOffset(t);
  dancePose(PP, t);
  const prs = rs * (G.dance.fx.playerRMul || 1);
  if (PP.ring) PP.ring.scale.set(prs, 1, prs);
  PP.root.visible = P.invuln > 0 ? (Math.floor(t * 12) % 2 === 0) : true;
  MAT.ringP.opacity = 0.52 + Math.sin(t * 4) * 0.16;
  if (PP.marker) PP.marker.position.y = 2.45 + Math.sin(t * 3) * 0.08;
  for (let i = 0; i < G.npcs.length; i++) {
    const n = G.npcs[i], Q = npcPersons[i];
    if (!Q) continue;
    const vis = n.state !== 'away' && n.state !== 'gone';
    Q.root.visible = vis; Q.groundG.visible = vis;
    if (!vis) continue;
    Q.root.position.x = n.x; Q.root.position.z = n.z;
    Q.groundG.position.x = n.x; Q.groundG.position.z = n.z;
    if (n.state === 'dancer') {
      Q.root.rotation.y = n.dir + danceSpinOffset(t);
      dancePose(Q, t);
      if (Q.ring) { const rr = rs * G.radiusOf(n); Q.ring.visible = true; Q.ring.scale.set(rr, 1, rr); }
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
  for (let i = 0; i < bandPersons.length; i++) {
    const b = G.band[i], Q = bandPersons[i];
    Q.root.visible = Q.groundG.visible = !!b;
    if (!b) continue;
    Q.root.position.x = Q.groundG.position.x = b.x; Q.root.position.z = Q.groundG.position.z = b.z;
    Q.root.rotation.y = b.face;
    walkPose(Q, dt, false);
    Q.armL.rotation.x = -1.35 + Math.sin(t * 9) * 0.08; Q.armR.rotation.x = -1.35 - Math.sin(t * 9) * 0.08; // 楽器を構える
    Q.armL.rotation.z = -0.25; Q.armR.rotation.z = 0.25;
    Q.note.material.opacity = 0.9; Q.note.position.y = 2.3 + Math.sin(t * 6 + i) * 0.15;
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
  if (!(started && G.phase === 'play') || paused || pixelRatio <= 1) { qT = 0; qN = 0; return; }
  qT += dt; qN++;
  if (qT < 2) return;
  const avg = qT / qN; qT = 0; qN = 0;
  if (avg > 1 / 45) {
    pixelRatio = Math.max(1, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
// 雨(商店街のみ): プレイヤーの周りに線を降らせ、空を暗くする
const RAIN_N = 360;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 6);
for (let i = 0; i < RAIN_N; i++) { rainPos[i * 6] = (Math.random() - 0.5) * 60; rainPos[i * 6 + 1] = Math.random() * 22; rainPos[i * 6 + 2] = (Math.random() - 0.5) * 60; }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainLines = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.55 }));
rainLines.visible = false; rainLines.frustumCulled = false; scene.add(rainLines);
const tmpCol = new THREE.Color(), wetCol = new THREE.Color(0x707a88);
let wetK = 0;
function updateWeather(dt) {
  const wet = G.phase === 'play' && G.rain > 0;
  wetK += ((wet ? 1 : 0) - wetK) * Math.min(1, dt * 2.5);
  rainLines.visible = wetK > 0.05;
  if (rainLines.visible) {
    for (let i = 0; i < RAIN_N; i++) {
      let y = rainPos[i * 6 + 1] - dt * 38;
      if (y < 0) { y += 22; rainPos[i * 6] = (Math.random() - 0.5) * 60; rainPos[i * 6 + 2] = (Math.random() - 0.5) * 60; }
      rainPos[i * 6 + 1] = y;
      rainPos[i * 6 + 3] = rainPos[i * 6] + 0.12; rainPos[i * 6 + 4] = y + 1.1; rainPos[i * 6 + 5] = rainPos[i * 6 + 2];
    }
    rainGeo.attributes.position.needsUpdate = true;
    rainLines.position.set(G.player.x, 0, G.player.z - 6);
    rainLines.material.opacity = 0.55 * wetK;
  }
  hemi.intensity = 0.95 - 0.3 * wetK;
  if (scene.background && scene.background.copy) {
    tmpCol.setHex(curTheme.sky).lerp(wetCol, wetK);
    scene.background.copy(tmpCol); if (scene.fog) scene.fog.color.copy(tmpCol);
  }
  for (const f of walkFx) { // 動く歩道の矢印を流す
    const len = f.w.x1 - f.w.x0;
    let x = f.m.position.x + f.w.v * dt;
    if (x > f.w.x1) x -= len; if (x < f.w.x0) x += len;
    f.m.position.x = x;
  }
}
function updateTrain() { // 着く2秒前に滑り込み、2.5秒停車して去る
  if (!trainG) return;
  const tIn = G.phase === 'play' ? G.nextTrainIn() : -1, since = G.elapsed - lastTrainAt;
  let x = -200;
  if (tIn >= 0 && tIn < 2) x = -70 * Math.pow(tIn / 2, 2);
  else if (since >= 0 && since < 2.5) x = 0;
  else if (since >= 2.5 && since < 4) x = 70 * Math.pow((since - 2.5) / 1.5, 2);
  trainG.position.x = x;
}
const camPos = new THREE.Vector3(0, 33 * camDist, 22 + 25 * camDist);
let lastT = performance.now() / 1000;
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() / 1000;
  let dt = now - lastT; lastT = now;
  if (dt > 0.06) dt = 0.06;
  if (started && G.phase === 'play' && !paused) {
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
  updateTrain();
  updateWeather(dt);
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

globalThis.__DM_UI__ = { get paused() { return paused; }, get G() { return G; }, setGame: function (g) { G = g; }, setupStage: setupStage, get danceStyle() { return danceStyle; } };
})();
