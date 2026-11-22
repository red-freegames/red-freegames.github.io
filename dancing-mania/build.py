#!/usr/bin/env python3
"""『ダンシングマニア(仮)』組み立てスクリプト。

部品ファイルを連結して index.html を生成する。
部品が正本。index.html を直接編集せず、部品を直してからこれを実行すること。

  shell-head.html  … HTML/CSS/画面DOM
  three-block.js   … Three.js r128 (minified, 抽出済み・改変禁止)
  dance-core.js    … ゲームロジック (THREE/DOM非依存)
  dance-ui.js      … 描画/UI (THREE依存)

使い方: python3 build.py
"""
import pathlib

HERE = pathlib.Path(__file__).resolve().parent


def main() -> None:
    head = (HERE / "shell-head.html").read_text(encoding="utf-8")
    three = (HERE / "three-block.js").read_text(encoding="utf-8")
    core = (HERE / "dance-core.js").read_text(encoding="utf-8")
    ui = (HERE / "dance-ui.js").read_text(encoding="utf-8")
    for name, s in [("three", three), ("core", core), ("ui", ui)]:
        assert "</script" not in s.lower(), f"{name} に </script> が含まれています"
    out = (
        head
        + "\n<script>\n" + three
        + "\n</script>\n<script>\n" + core
        + "\n</script>\n<script>\n" + ui
        + "\n</script>\n</body>\n</html>\n"
    )
    (HERE / "index.html").write_text(out, encoding="utf-8")
    print(f"assembled index.html: {len(out)} bytes")


if __name__ == "__main__":
    main()
