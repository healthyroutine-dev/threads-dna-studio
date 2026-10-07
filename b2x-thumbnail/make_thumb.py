#!/usr/bin/env python3
"""B2X · K-Beauty Influencer Academy 릴스 썸네일 생성기 (THUMBNAIL_SPEC.md v12).

배경 이미지 + 카테고리 + 회차 + 제목만 넣으면 1080x1920 커버를 같은 레이아웃으로 만든다.
렌더링은 Chromium(playwright)으로 한다.
"""
import argparse, base64, json, os, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
COLORS = {"F": "#E6E6E6", "C1": "#9B6BFF", "C2": "#FF8A4C", "C3": "#FF4F9A", "C4": "#2FD4A8"}
W, H = 1080, 1920

HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:Pretendard;src:local("Pretendard"),local("Pretendard Bold")}}
html,body{{margin:0;padding:0}}
body{{width:{W}px;height:{H}px;overflow:hidden;background:#000;
  font-family:Pretendard,"NanumSquareRound","NanumGothic",sans-serif;color:#fff}}
.bg{{position:absolute;inset:0;background:url({bg}) center top/cover no-repeat}}
.ov{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 45%)}}
.academy{{position:absolute;left:0;right:0;top:278px;transform:translateY(-100%);text-align:center;
  font-weight:700;font-size:39px;letter-spacing:8px;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.8)}}
.card{{position:absolute;left:76px;width:928px;top:326px;box-sizing:border-box;background:#0D0D0D;border-radius:26px;
  padding:40px 46px 42px;box-shadow:0 12px 36px rgba(0,0,0,.45)}}
.bar{{position:absolute;left:0;top:0;bottom:0;width:13px;border-radius:26px 0 0 26px;background:{color}}}
.label{{font-weight:700;font-size:36px;letter-spacing:6px;color:#BDBDBD;text-transform:uppercase}}
.title{{font-weight:700;font-size:85px;line-height:1.08;margin-top:10px;display:-webkit-box;-webkit-line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden}}
.sub{{font-weight:400;font-size:39px;color:#9A9A9A;margin-top:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.pip{{position:absolute;right:43px;bottom:336px;width:346px;height:346px;border-radius:50%;border:16px solid #fff;
  box-sizing:border-box;background:url({pip}) center/cover;box-shadow:0 12px 32px rgba(0,0,0,.5)}}
.brand{{position:absolute;left:0;right:0;top:1824px;transform:translateY(-50%);text-align:center;
  font-weight:700;font-size:43px;letter-spacing:9px;text-shadow:0 2px 12px rgba(0,0,0,.8)}}
</style></head><body>
<div class="bg"></div><div class="ov"></div>
<div class="academy">{academy}</div>
<div class="card"><div class="bar"></div><div class="label">{label}</div><div class="title">{title}</div><div class="sub">{sub}</div></div>
{pip_div}
<div class="brand">{brand}</div>
</body></html>"""


def data_uri(path: Path) -> str:
    ext = path.suffix.lower().lstrip(".")
    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp"}.get(ext, "jpeg")
    return f"data:image/{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render(spec: dict, browser) -> Path:
    cat = spec["cat"].upper()
    if cat not in COLORS:
        sys.exit(f"알 수 없는 카테고리 {cat}. 사용 가능: {', '.join(COLORS)}")
    bg = Path(spec["bg"]).expanduser()
    if not bg.exists():
        sys.exit(f"배경 이미지 없음: {bg}")
    use_pip = cat != "F" and not spec.get("no_pip", False)
    pip_path = Path(spec.get("pip") or HERE / "assets" / "ceo_circle.png")
    label = f"{spec['label']} · EP.{int(spec['ep']):02d}"
    html = HTML.format(
        W=W, H=H, bg=data_uri(bg), color=COLORS[cat], academy=esc(spec.get("academy_text", "K-Beauty Influencer Academy")),
        label=esc(label), title=esc(spec["title"]), sub=esc(spec.get("sub", "")),
        pip=data_uri(pip_path) if use_pip else "", pip_div='<div class="pip"></div>' if use_pip else "",
        brand=esc(spec.get("brand_text", "B2X")))
    out = Path(spec["out"]).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html); tmp = f.name
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    page.goto(f"file://{tmp}"); page.wait_for_timeout(250)
    page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": W, "height": H})
    if spec.get("grid_preview"):
        from PIL import Image
        im = Image.open(out); cut = int(H * 0.15)
        im.crop((0, cut, W, H - cut)).save(out.with_name(out.stem + "_grid.png"))
    page.close(); os.unlink(tmp)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--batch", help="episodes.json (항목 배열)")
    ap.add_argument("--bg"); ap.add_argument("--cat"); ap.add_argument("--label"); ap.add_argument("--ep", type=int)
    ap.add_argument("--title"); ap.add_argument("--sub", default=""); ap.add_argument("--out")
    ap.add_argument("--pip"); ap.add_argument("--no-pip", action="store_true")
    ap.add_argument("--academy-text"); ap.add_argument("--brand-text")
    ap.add_argument("--grid-preview", action="store_true")
    ap.add_argument("--chromium", default=os.environ.get("CHROMIUM_PATH", "/opt/pw-browsers/chromium"))
    a = ap.parse_args()

    if a.batch:
        specs = json.loads(Path(a.batch).read_text(encoding="utf-8"))
        base = Path(a.batch).resolve().parent
        for s in specs:
            for k in ("bg", "out", "pip"):
                if s.get(k) and not Path(s[k]).is_absolute():
                    s[k] = str(base / s[k])
    else:
        need = [k for k in ("bg", "cat", "label", "ep", "title", "out") if getattr(a, k) is None]
        if need:
            sys.exit("필수 옵션 누락: " + ", ".join("--" + k for k in need))
        specs = [dict(bg=a.bg, cat=a.cat, label=a.label, ep=a.ep, title=a.title, sub=a.sub, out=a.out,
                      pip=a.pip, no_pip=a.no_pip, academy_text=a.academy_text, brand_text=a.brand_text,
                      grid_preview=a.grid_preview)]
        specs[0] = {k: v for k, v in specs[0].items() if v is not None}

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        launch = {"args": ["--no-sandbox"]}
        if a.chromium and Path(a.chromium).exists():
            launch["executable_path"] = a.chromium
        browser = p.chromium.launch(**launch)
        for s in specs:
            print("saved", render(s, browser))
        browser.close()


if __name__ == "__main__":
    main()
