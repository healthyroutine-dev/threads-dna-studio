# 대표 입 움직임 측정 (프레임별 입 벌림 정도) → 소리는 나는데 입이 안 움직이는 구간 = 다른 사람 목소리(대사 불러주는 소리)
# usage: mouth.py NNNN(촬영본) out.json
import sys, os, json, cv2, numpy as np
os.environ.setdefault('GLOG_minloglevel', '2')
import mediapipe as mp
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
cap = cv2.VideoCapture(f'{S}/ceo_raw/{sys.argv[1]}.mp4'); fps = cap.get(cv2.CAP_PROP_FPS) or 30
lm = mp.tasks.vision.FaceLandmarker.create_from_options(mp.tasks.vision.FaceLandmarkerOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=S + '/models/face_landmarker.task'), running_mode=mp.tasks.vision.RunningMode.VIDEO))
out = []; i = 0; step = 2   # 15fps로 측정
while True:
    ok, fr = cap.read()
    if not ok: break
    if i % step == 0:
        h, w = fr.shape[:2]; sm = cv2.resize(fr, (w * 480 // h, 480))
        r = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(sm, cv2.COLOR_BGR2RGB)), int(i / fps * 1000))
        if r.face_landmarks:
            p = r.face_landmarks[0]; fh = abs(p[152].y - p[10].y) or 1
            out.append([round(i / fps, 3), round(abs(p[14].y - p[13].y) / fh, 4)])
        else: out.append([round(i / fps, 3), None])
    i += 1
json.dump(out, open(sys.argv[2], 'w')); lm.close(); print(sys.argv[1], len(out))
