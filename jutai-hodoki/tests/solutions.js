// 各ステージの想定解。pass: true は「予算内で目標を達成できる」ことを検証する解
// ctx.line(折れ線) / ctx.fly(x,y) / ctx.tool(name,x,y) は費用を ctx.used に積む
module.exports = {
  s1: {
    southEast: { pass: true, fn: c => c.line([[15, 14], [29, 14]]) },
  },
  s2: {
    northBridge: { pass: true, fn: c => c.line([[5, 5], [22, 5]]) },
  },
  s3: {
    flyWest: { fn: c => { c.fly(8, 9); c.fly(8, 10); } },
    flyWestCutEast: { pass: true, fn: c => { c.fly(8, 9); c.fly(8, 10); c.tool('remove', 22, 9); c.tool('remove', 22, 10); } },
  },
  s4: {
    flyCenter: { pass: true, fn: c => c.fly(15, 10) },
  },
  s5: {
    bridgeOnly: { fn: c => { c.line([[17, 3], [17, 12]]); c.fly(21, 12); } },
    bridgeAndStation: { pass: true, fn: c => { c.line([[17, 3], [17, 12]]); c.fly(21, 12); c.line([[12, 11], [9, 11], [9, 19]]); } },
  },
};
