# 원형 크롭 자동: 보정 영상에서 얼굴을 찾아 원 가운데에 오게 정사각 크롭 (크기, x, y) 계산 · 편 폴더에 facecrop.json 캐시
# usage: facecrop.py EP_DIR  (또는 import 해서 face_crop(dir))
import json, os, sys, subprocess
import cv2, numpy as np, mediapipe as mp
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
FACE_RATIO = 2.8   # v7: 크롭 한 변 = 얼굴(이마~턱) 높이 × 2.8 → 얼굴+어깨
UP = 0.12          # 머리카락 몫만큼 원 중심을 얼굴 중심보다 살짝 위로 (얼굴 높이 비율)

def face_crop(d):
    cache = f'{d}/facecrop.json'
    if os.path.exists(cache): return tuple(json.load(open(cache)))
    v = f'{d}/beauty.mp4'; cap = cv2.VideoCapture(v); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); W = int(cap.get(3)); H = int(cap.get(4))
    lm = mp.tasks.vision.FaceLandmarker.create_from_options(mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=S + '/models/face_landmarker.task'), running_mode=mp.tasks.vision.RunningMode.IMAGE))
    boxes = []
    for i in np.linspace(n * 0.05, n * 0.95, 24).astype(int):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i)); ok, f = cap.read()
        if not ok: continue
        r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(f, cv2.COLOR_BGR2RGB)))
        if not r.face_landmarks: continue
        xs = [p.x * W for p in r.face_landmarks[0]]; ys = [p.y * H for p in r.face_landmarks[0]]
        boxes.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, max(ys) - min(ys)))
    cx, cy, fh = np.median(np.array(boxes), axis=0)
    c = int(min(W, H, fh * FACE_RATIO)) // 2 * 2
    x = int(np.clip(cx - c / 2, 0, W - c)); y = int(np.clip(cy - UP * fh - c / 2, 0, H - c))
    json.dump([c, x, y], open(cache, 'w')); return c, x, y

if __name__ == '__main__': print(face_crop(sys.argv[1]))
