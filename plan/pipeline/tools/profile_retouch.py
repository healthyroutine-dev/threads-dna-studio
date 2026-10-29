# 프로필 사진 보정: 1:1 · 얼굴 가운데 · 피부 결 정돈(질감 유지) · 밝고 따뜻한 톤 · 배경 깔끔한 웜톤 그라데이션
import cv2, numpy as np, mediapipe as mp, sys
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
src, out, bg_mode = sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'warm'
img = cv2.imread(src); H, W = img.shape[:2]
lm = mp.tasks.vision.FaceLandmarker.create_from_options(mp.tasks.vision.FaceLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=S + '/models/face_landmarker.task')))
pts = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB))).face_landmarks[0]
xs = np.array([p.x * W for p in pts]); ys = np.array([p.y * H for p in pts])
fh = ys.max() - ys.min(); cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
c = int(min(W, fh * 2.6)); x0 = int(np.clip(cx - c / 2, 0, W - c)); y0 = int(np.clip(cy - 0.08 * fh - c * 0.42, 0, H - c))
img = img[y0:y0 + c, x0:x0 + c]; img = cv2.resize(img, (1080, 1080), interpolation=cv2.INTER_AREA)[20:860, 120:960]; img = cv2.resize(img, (1080, 1080), interpolation=cv2.INTER_CUBIC)   # 아래쪽 핀마이크가 안 나오게 살짝 확대
import os
if os.environ.get('RAW'): cv2.imwrite(out, img); sys.exit()
pts = [(((p.x * W - x0) * 1080 / c - 120) * 1080 / 840, ((p.y * H - y0) * 1080 / c - 20) * 1080 / 840) for p in pts]
# 분할: 0 배경 1 머리 2 몸피부 3 얼굴피부 4 옷 5 기타
seg = mp.tasks.vision.ImageSegmenter.create_from_options(mp.tasks.vision.ImageSegmenterOptions(base_options=mp.tasks.BaseOptions(model_asset_path=S + '/models/selfie_multiclass.tflite'), output_category_mask=True))
cat = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB))).category_mask.numpy_view().squeeze()
g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
f = img.astype(np.float32) / 255
skin = cv2.GaussianBlur(((cat == 2) | (cat == 3)).astype(np.float32), (0, 0), 6)[..., None]
person = cv2.GaussianBlur(cv2.morphologyEx((cat != 0).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)).astype(np.float32), (0, 0), 2.5)[..., None]
# 피부: 저주파만 부드럽게, 고주파(결) 일부 유지
low = cv2.bilateralFilter((f * 255).astype(np.uint8), 15, 40, 15).astype(np.float32) / 255
hi = f - cv2.GaussianBlur(f, (0, 0), 3)
smooth = np.clip(low + hi * 0.35, 0, 1)
f = f * (1 - skin * 0.75) + smooth * skin * 0.75
sk = skin[..., 0] > 0.5
for k in range(3):
    ch = f[..., k]; hi_ = ch > 0.70; ch[hi_ & sk] = 0.70 + (ch[hi_ & sk] - 0.70) * 0.35
# 톤: 밝게 · 따뜻하게 · 그림자 살짝 올림
f = np.clip(f * 1.06 + 0.02, 0, 1); f = f ** 0.93
f[..., 2] = np.clip(f[..., 2] * 1.025, 0, 1); f[..., 0] = np.clip(f[..., 0] * 0.985, 0, 1)
# 은은한 광(글로우)
glow = cv2.GaussianBlur(f, (0, 0), 18); f = 1 - (1 - f) * (1 - glow * 0.12)
# 눈 선명하게
eye = np.zeros((1080, 1080), np.float32)
for i in [33, 133, 159, 145, 362, 263, 386, 374]: cv2.circle(eye, (int(pts[i][0]), int(pts[i][1])), 28, 1, -1)
eye = cv2.GaussianBlur(eye, (0, 0), 10)[..., None]
sharp = np.clip(f + (f - cv2.GaussianBlur(f, (0, 0), 2)) * 0.8, 0, 1); f = f * (1 - eye) + sharp * eye
# 배경: 잘라 붙이지 않고 원래 벽의 색만 따뜻한 톤으로 (머리카락 가장자리 테두리 생기지 않게)
bgm = cv2.GaussianBlur((cat == 0).astype(np.float32), (0, 0), 12)[..., None]
lab = cv2.cvtColor((np.clip(f, 0, 1) * 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
T = {'warm': (247, 131, 136), 'pink': (243, 136, 131), 'gray': (245, 128, 130)}[bg_mode]
lab2 = lab.copy(); lab2[..., 0] = np.clip(lab[..., 0] * 0.35 + T[0] * 0.65, 0, 255); lab2[..., 1] = T[1]; lab2[..., 2] = T[2]
tinted = cv2.cvtColor(lab2.astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32) / 255
f = f * (1 - bgm) + tinted * bgm
cv2.imwrite(out, (np.clip(f, 0, 1) * 255).astype(np.uint8))
