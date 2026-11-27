// node tests/heat.js s3 [solutionName]  （調整用）  … 停止車の滞在時間をマスごとにASCII表示
const fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);
const J = globalThis.__JH__; const { idx } = J;
function line(net, pts) { const tiles = []; for (let s = 0; s + 1 < pts.length; s++) { let [x, y] = pts[s]; const [x1, y1] = pts[s + 1]; if (!tiles.length) tiles.push(idx(x, y)); while (x !== x1 || y !== y1) { if (x < x1) x++; else if (x > x1) x--; else if (y < y1) y++; else y--; tiles.push(idx(x, y)); } } const r = J.commitPath(net, tiles); if (r.ok !== tiles.length) console.log('  !! cut', r.ok, '/', tiles.length); return r.cost; }
const st = J.STAGES.find(s => s.id === process.argv[2]);
const net = J.makeNet(st);
const sol = process.argv[3];
if (sol) { const c = { line: pts => line(net, pts), tool: (n, x, y) => J.applyTool(net, n, idx(x, y)), fly: (x, y) => J.applyTool(net, 'fly', idx(x, y)) }; require('./solutions.js')[st.id][sol].fn(c); }
const S = J.createSim(st, net, { mode: 'test', seed: 777 });
const heat = new Float64Array(J.N);
while (!J.testDone(S)) { J.step(S, 1 / 30); for (const c of S.cars) if (c.v < 0.3) heat[c.path[c.k]] += 1 / 30; }
console.log(J.testScore(S), 'backlog', S.backlog);
const ch = '.:-=+*#%@';
for (let y = 0; y < J.H; y++) { let s = ''; for (let x = 0; x < J.W; x++) { const i = idx(x, y); if (!net.road[i]) { s += net.terr[i] === 1 ? '~' : net.terr[i] === 2 ? '|' : ' '; continue; } const h = heat[i]; s += h < 1 ? (J.isInter(net, i) ? '+' : 'o') : ch[Math.min(8, Math.floor(Math.log2(h)))]; } console.log(s); }
