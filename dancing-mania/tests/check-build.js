// index.html が部品から組み立て直されているか(build.py と同じ連結結果か)を確かめる。
// 部品を直したのに python3 build.py を忘れると、試遊ページや公開版に変更が入らない。
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const expected = read('shell-head.html')
  + '\n<script>\n' + read('three-block.js')
  + '\n</script>\n<script>\n' + read('dance-core.js')
  + '\n</script>\n<script>\n' + read('dance-ui.js')
  + '\n</script>\n</body>\n</html>\n';
if (read('index.html') === expected) console.log('BUILD UP TO DATE');
else { console.log('FAIL: index.html is stale. Run: python3 build.py'); process.exitCode = 1; }
