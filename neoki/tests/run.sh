#!/bin/bash
# 『ねえ、起きてる？』検証ハーネス一括実行
# index.html から <script> ブロックを抽出し、Node の DOM スタブ上でロジックと UI を検証する。
# 使い方: bash tests/run.sh （neoki ディレクトリのどこからでも可）
set -e
cd "$(dirname "$0")"
python3 - <<'EOF'
import re
src = open('../index.html', encoding='utf-8').read()
blocks = re.findall(r'<script>(.*?)</script>', src, re.S)
assert len(blocks) == 2, 'script blocks must be exactly 2 (logic, UI)'
for i, b in enumerate(blocks):
    open(f'b{i}.js', 'w', encoding='utf-8').write(b)
print('extracted 2 script blocks')
EOF
trap 'rm -f b0.js b1.js run-*.js' EXIT
node --check b0.js
node --check b1.js
echo '--- logic ---'
cat b0.js driver-logic.js > run-logic.js && node run-logic.js
echo '--- ui clear (stage2) ---'
cat stub.js b0.js b1.js driver-ui-clear.js > run-ui-clear.js && node run-ui-clear.js
echo '--- ui honne ---'
cat stub.js b0.js b1.js driver-ui-honne.js > run-ui-honne.js && node run-ui-honne.js
echo '--- ui rage (stage3) ---'
cat stub.js b0.js b1.js driver-ui-rage.js > run-ui-rage.js && node run-ui-rage.js
echo 'ALL HARNESS SUITES DONE'
