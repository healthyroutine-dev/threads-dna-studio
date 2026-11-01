# 대표 원 테두리 (v7, 채원 대표 카톡 프로필 레퍼런스): 흰 4px 60% 전체 + 강조색 호 2구간 (왼쪽 아래 1/4, 오른쪽 위 1/6)
# usage: pip_ring.py OUT.png [지름=400]  → 캔버스 = 지름 + 24 (원 바깥 12px 여유, 원 영상은 (12,12)에 놓임)
import sys, math
from PIL import Image, ImageDraw
POINT = (0xDB, 0x3D, 0x5A)   # 우리 강조색 (EDIT_RULES 2장) — 엔딩 카드와 같은 색
PAD = 12

def ring(dia=400, ss=4):
    W = (dia + 2 * PAD) * ss; c = W / 2; R = dia / 2 * ss
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    w = 4 * ss; r = R - 1 * ss   # 흰 선: 원 가장자리를 덮음
    d.ellipse([c - r - w / 2, c - r - w / 2, c + r + w / 2, c + r + w / 2], outline=(255, 255, 255, 153), width=w)
    aw = 11 * ss; ar = R + 1.5 * ss   # 강조 호: 가장자리 걸쳐 바깥으로 살짝
    for a0, a1 in ((90, 180), (285, 345)):   # 화면 좌표(0°=오른쪽, 90°=아래): 왼쪽 아래 1/4 · 오른쪽 위 1/6
        d.arc([c - ar - aw / 2, c - ar - aw / 2, c + ar + aw / 2, c + ar + aw / 2], a0, a1, fill=POINT + (255,), width=aw)
        for a in (a0, a1):   # 둥근 끝
            x, y = c + ar * math.cos(math.radians(a)), c + ar * math.sin(math.radians(a))
            d.ellipse([x - aw / 2, y - aw / 2, x + aw / 2, y + aw / 2], fill=POINT + (255,))
    return im.resize((W // ss, W // ss), Image.LANCZOS)

if __name__ == '__main__':
    ring(int(sys.argv[2]) if len(sys.argv) > 2 else 400).save(sys.argv[1])
