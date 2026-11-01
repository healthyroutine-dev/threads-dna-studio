# 잔머리 정돈 (v3, 2026-11-01): 머리 윤곽 밖으로 "가늘게 삐져나온 머리카락"만 지움. 머리 덩어리·뜬 부분·컬·윤곽선은 손대지 않음.
# usage: hair_tidy.py IN.png OUT.png
import sys, cv2, numpy as np, mediapipe as mp
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'

def segmenter():
    return mp.tasks.vision.ImageSegmenter.create_from_options(mp.tasks.vision.ImageSegmenterOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=S + '/models/selfie_multiclass.tflite'), output_confidence_masks=True))

def tidy(img, seg):
    H, W = img.shape[:2]
    r = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    bgp = r.confidence_masks[0].numpy_view().squeeze()
    # 배경 판 (벽색)
    bm = (bgp > 0.9).astype(np.float32); sig = 0.02 * W
    plate = cv2.GaussianBlur(img.astype(np.float32) * bm[..., None], (0, 0), sig) / (cv2.GaussianBlur(bm, (0, 0), sig)[..., None] + 1e-4)
    # 벽보다 어두운 선 = 머리카락 후보
    dark = (plate.mean(2) - img.astype(np.float32).mean(2)) > 10
    body = (bgp < 0.5).astype(np.uint8)                      # 사람(머리 포함) 덩어리
    # 가는 것만: 폭 7px 이하 구조 = 원래 - 열기(7px)
    k = max(5, int(0.009 * W) | 1)
    thick = cv2.morphologyEx((dark | (body > 0)).astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    thin = (dark & (thick == 0)).astype(np.uint8)
    # 머리 덩어리 바깥(배경 쪽)에 있는 가는 선만 → 머리 안쪽 결·윤곽은 그대로
    outside = 1 - cv2.dilate(thick, np.ones((3, 3), np.uint8))
    rm = (thin * outside).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(rm, 8)   # 점 같은 잡티는 무시, 선만
    keep = np.zeros_like(rm)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 6: keep[lab == i] = 1
    m = cv2.GaussianBlur(cv2.dilate(keep, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 0.7)
    m = np.clip(m * 1.4, 0, 1)
    out = img * (1 - m[..., None]) + plate * m[..., None]
    return np.clip(out, 0, 255).astype(np.uint8), m

if __name__ == '__main__':
    img = cv2.imread(sys.argv[1]); out, m = tidy(img, segmenter()); cv2.imwrite(sys.argv[2], out)
    if len(sys.argv) > 3: cv2.imwrite(sys.argv[3], (m * 255).astype(np.uint8))
