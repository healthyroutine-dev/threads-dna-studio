# 썸네일 원형(대표 얼굴) 위치 자동 선택: 원본 인물 눈·입·화면 글자를 피하고, 프로필 그리드(4:5) 안, 위쪽 우선
# usage: pip_pick.py thumb_bg.jpg  → "x y"
import sys, os; os.environ.setdefault("GLOG_minloglevel", "2")
import cv2, numpy as np
import mediapipe as mp
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
img = cv2.resize(cv2.imread(sys.argv[1]), (1080, 1920)); D = 346
TOP, GRID_B = 735, 1632 - 10           # 제목 박스 아래 ~ 그리드 아래선
cost = np.zeros((1920, 1080), np.float32)
# 1) 화면 글자·디테일: 가는 에지 밀도
g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); e = cv2.Canny(g, 80, 200).astype(np.float32) / 255
cost += cv2.blur(e, (25, 25)) * 1.0
# 화면 글자: 에지가 촘촘한 가로 띠 → 크게 벌점
dens = cv2.blur(e, (41, 15))
txt = cv2.dilate((dens > 0.16).astype(np.uint8), np.ones((31, 61), np.uint8)).astype(np.float32)
cost += txt * 2.5
# 2) 얼굴 눈·입 (크게 벌점)
lm = mp.tasks.vision.FaceLandmarker.create_from_options(mp.tasks.vision.FaceLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=os.path.abspath(S + '/models/face_landmarker.task')), num_faces=3))
res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
for f in res.face_landmarks:
    P = np.array([[p.x * 1080, p.y * 1920] for p in f])
    hull = cv2.convexHull(P.astype(np.int32)); fm = np.zeros((1920, 1080), np.uint8); cv2.fillConvexPoly(fm, hull, 1)
    cost += fm.astype(np.float32) * 1.2   # 얼굴 전체
    for idx in ([33, 133, 159, 145, 160, 144], [362, 263, 386, 374, 385, 380], [61, 291, 13, 14, 0, 17]):
        x0, y0 = P[idx].min(0) - 60; x1, y1 = P[idx].max(0) + 60
        cost[int(max(0, y0)):int(min(1920, y1)), int(max(0, x0)):int(min(1080, x1))] += 3.0
mask = np.zeros((D, D), np.uint8); cv2.circle(mask, (D // 2, D // 2), D // 2, 1, -1); m = mask.astype(bool)
best = None
for x in (691, 43):
    for y in range(TOP, GRID_B - D + 1, 20):
        c = cost[y:y + D, x:x + D][m].mean() + (0.02 if x == 43 else 0) + 0.04 * (y - TOP) / (GRID_B - D - TOP)
        if best is None or c < best[0]: best = (c, x, y)
print(best[1], best[2]); lm.close()
