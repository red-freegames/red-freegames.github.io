#!/bin/bash
# 『渋滞ほどき』検証一括実行（bash tests/run.sh）
set -e
cd "$(dirname "$0")"
echo '--- logic / balance ---'
node check.js
echo '--- ui smoke (playwright) ---'
node ui-smoke.js
echo 'ALL SUITES DONE'
