# 썸네일 대표 얼굴 후보: 보정 영상에서 프레임을 고르게 뽑아 표정 점수(눈 뜸·미소·입 다묾·정면)로 상위 N장
# usage: face_pick.py BEAUTY.mp4 CROP(c,x,y) OUTDIR [N=8]
import sys, os, json, cv2, numpy as np, mediapipe as mp
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
v, crop, out = sys.argv[1], [int(x) for x in sys.argv[2].split(',')], sys.argv[3]; N = int(sys.argv[4]) if len(sys.argv) > 4 else 8
os.makedirs(out, exist_ok=True); c, x0, y0 = crop
lm = mp.tasks.vision.FaceLandmarker.create_from_options(mp.tasks.vision.FaceLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=S + '/models/face_landmarker.task'), output_face_blendshapes=True, running_mode=mp.tasks.vision.RunningMode.IMAGE))
cap = cv2.VideoCapture(v); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); fps = cap.get(5); res = []
for i in np.linspace(0, n - 1, 240).astype(int):
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(i)); ok, f = cap.read()
    if not ok: continue
    f = f[y0:y0 + c, x0:x0 + c]; r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(f, cv2.COLOR_BGR2RGB)))
    if not r.face_blendshapes: continue
    b = {k.category_name: k.score for k in r.face_blendshapes[0]}
    L = np.array([[q.x * c, q.y * c] for q in r.face_landmarks[0]]); fw = L[454, 0] - L[234, 0]; cxn = L[1, 0]
    roll = abs(np.degrees(np.arctan2(L[263, 1] - L[33, 1], L[263, 0] - L[33, 0])))   # 고개 기울기
    ycc = cv2.cvtColor(f, cv2.COLOR_BGR2YCrCb); skin = ((ycc[..., 1] > 138) & (ycc[..., 1] < 178) & (ycc[..., 2] > 85) & (ycc[..., 2] < 130)).astype(np.uint8)
    m = np.zeros_like(skin); cv2.fillConvexPoly(m, cv2.convexHull(L.astype(np.int32)), 1); m = cv2.dilate(m, np.ones((41, 41), np.uint8))
    yb = int(L[152, 1]); m[yb:, int(cxn - 0.42 * fw):int(cxn + 0.42 * fw)] = 1; m[:int(L[159, 1])] = 1   # 얼굴·목/가슴 가운데·눈 위는 제외
    hand = (skin * (1 - m)).sum() / (c * c)   # 얼굴 밖 피부 = 손
    sharp = cv2.Laplacian(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
    sc = (b['mouthSmileLeft'] + b['mouthSmileRight']) * 1.2 - (b['eyeBlinkLeft'] + b['eyeBlinkRight']) * 4.0 - (b['eyeSquintLeft'] + b['eyeSquintRight']) * 1.5 + (b['eyeWideLeft'] + b['eyeWideRight']) * 1.0 - b['jawOpen'] * 2.5 - b['mouthFunnel'] - b['mouthPucker'] \
         - abs(b['eyeLookOutLeft'] - b['eyeLookInLeft']) - (b['browInnerUp'] * 0.5) + min(sharp, 300) / 600 - hand * 60 - max(0, roll - 3) * 0.15
    res.append((sc, i / fps, f))
res.sort(key=lambda r: -r[0]); picked = []
for sc, t, f in res:
    if all(abs(t - p[1]) > 2.0 for p in picked): picked.append((sc, t, f))
    if len(picked) == N: break
for k, (sc, t, f) in enumerate(picked):
    cv2.imwrite(f'{out}/cand_{k+1}.png', cv2.flip(cv2.resize(f, (800, 800), interpolation=cv2.INTER_AREA), 1))
json.dump([[k + 1, round(t, 2), round(sc, 3)] for k, (sc, t, f) in enumerate(picked)], open(f'{out}/cands.json', 'w'))
print(json.load(open(f'{out}/cands.json')))
