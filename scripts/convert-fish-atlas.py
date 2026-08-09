#!/usr/bin/env python3
"""把原版 TexturePacker plist 图集转成游戏用的 atlas JSON（一次性）。
用法: python3 scripts/convert-fish-atlas.py
输入: public/fish/*.plist + *.png（来自 Java 版 fish/ 目录）
输出: src/game/atlas.json —— 每鱼的帧坐标表，运行时 Canvas 直接裁切绘制
"""
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "public" / "fish"
OUT = Path(__file__).resolve().parent.parent / "src" / "game" / "atlas.json"

ATLASES = ["fish.plist", "fish2.plist", "fish3.plist", "seamaid.plist"]


def parse_plist(path: Path):
    """解析 TexturePacker plist（不引第三方库，按 key 顺序抽取）"""
    text = path.read_text(encoding="utf-8", errors="ignore")
    # frames 段
    frames_block = re.search(r"<key>frames</key>\s*<dict>(.*?)</dict>\s*</dict>\s*</plist>", text, re.S)
    if not frames_block:
        raise ValueError(f"{path}: 找不到 frames")
    body = frames_block.group(1)
    frames = {}
    for m in re.finditer(r"<key>([\w.]+\.png)</key>\s*<dict>(.*?)</dict>", body, re.S):
        name, block = m.group(1), m.group(2)

        def g(key):
            mm = re.search(rf"<key>{key}</key>\s*<(?:integer|real)>\s*(-?[\d.]+)", block)
            return float(mm.group(1)) if mm else None

        frames[name] = {
            "x": int(g("x")),
            "y": int(g("y")),
            "w": int(g("width")),
            "h": int(g("height")),
            "ox": g("offsetX"),
            "oy": g("offsetY"),
            "ow": int(g("originalWidth")),
            "oh": int(g("originalHeight")),
        }
    return frames


def main():
    atlas = {"atlasFiles": {}, "fish": {}}
    for plist_name in ATLASES:
        plist_path = BASE / plist_name
        if not plist_path.exists():
            continue
        png = plist_name.replace(".plist", ".png")
        atlas["atlasFiles"][png] = f"/fish/{png}"
        frames = parse_plist(plist_path)
        for frame_name, rect in frames.items():
            fish_name = re.sub(r"_\d+\.png$", "", frame_name)
            frame_idx = int(re.search(r"_(\d+)\.png$", frame_name).group(1))
            atlas["fish"].setdefault(fish_name, []).append(
                {"atlas": png, "frame": frame_idx, **rect}
            )

    # 帧按序号排序
    for fish_name in atlas["fish"]:
        atlas["fish"][fish_name].sort(key=lambda f: f["frame"])

    OUT.write_text(json.dumps(atlas, ensure_ascii=False, indent=1), encoding="utf-8")
    total_frames = sum(len(v) for v in atlas["fish"].values())
    print(f"✅ {OUT} — {len(atlas['fish'])} 种鱼, {total_frames} 帧")


if __name__ == "__main__":
    sys.exit(main())
