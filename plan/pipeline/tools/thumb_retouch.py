# 썸네일 대표 얼굴 보정 (v7, 2026-11-01): 턱선 갸름하게 + 눈 약 8% 크게 — 어색하지 않게 부드러운 국소 워프
# usage: thumb_retouch.py IN.png OUT.png [EYE=0.14] [SLIM=0.08]  (턱선 약 8% 좁힘, 눈 윤곽 기준 약 10% — 은근하게, 2026-11-01 확정)
import sys, cv2, numpy as np, mediapipe as mp
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
# 얼굴 윤곽(광대 아래~턱): 왼쪽/오른쪽, 아래로 갈수록 세게 (턱 끝 152는 그대로)
JAW_L = [(93, .35), (132, .7), (58, 1.0), (172, 1.0), (136, .85), (150, .6), (149, .35)]
JAW_R = [(323, .35), (361, .7), (288, 1.0), (397, 1.0), (365, .85), (379, .6), (378, .35)]
EYE_L, EYE_R = [33, 133, 159, 145], [362, 263, 386, 374]

def retouch(img, eye=0.14, slim=0.08):
    H, W = img.shape[:2]
    lm = mp.tasks.vision.FaceLandmarker.create_from_options(mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=S + '/models/face_landmarker.task'), running_mode=mp.tasks.vision.RunningMode.IMAGE))
    r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    if not r.face_landmarks: return img
    P = np.array([[p.x * W, p.y * H] for p in r.face_landmarks[0]])
    fw = P[454, 0] - P[234, 0]; cx = P[1, 0]   # 얼굴 폭, 코 중심선
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # 1) 갸름하게: 광대 아래~턱을 코 중심선 쪽으로 부드럽게 좁힘 (점별로 당기지 않고 아래로 갈수록 서서히 → 윤곽 모양 유지, 찌그러짐 없음)
    y0, y1 = P[[234, 454], 1].mean(), P[152, 1]          # 광대 높이 → 턱 끝
    t = np.clip((yy - y0) / (y1 - y0), 0, 1.4); sm = t * t * (3 - 2 * np.clip(t, 0, 1))   # smoothstep, 턱 아래로 갈수록 유지
    fade = np.clip(1 - (yy - y1) / (0.5 * (y1 - y0)), 0, 1)   # 목 아래로는 서서히 원래대로
    u = np.abs(xx - cx) / (fw / 2); g = np.clip((1.7 - u) / 0.7, 0, 1); g = g * g * (3 - 2 * g)   # 얼굴 바깥 1.7배 너머(머리카락·배경)는 그대로
    k = slim * np.minimum(sm, 1) * fade * g
    sx = cx + (xx - cx) * (1 + k); sy = yy.copy()
    # 2) 눈: 눈 가운데 기준 아주 부드럽게 확대
    for idx in (EYE_L, EYE_R):
        c = P[idx].mean(0); ew = np.linalg.norm(P[idx[0]] - P[idx[1]]); Re = ew * 1.3
        rx, ry = xx - c[0], yy - c[1]; rr = np.clip(np.sqrt(rx ** 2 + ry ** 2) / Re, 0, 1)
        f = 1 - eye * (1 - rr ** 2) ** 2
        sx += rx * (f - 1); sy += ry * (f - 1)
    out = cv2.remap(img, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    return neck_soft(out, P, fw, cx)

def neck_soft(img, P, fw, cx, amt=0.9):
    """목주름 흐리게: 턱 아래 목 피부만 결을 살린 채 부드럽게 (가로 주름 위주)"""
    H, W = img.shape[:2]; y0 = int(P[152, 1] - 0.05 * fw); y1 = min(H, int(P[152, 1] + 0.32 * fw))   # 목걸이 위까지만
    m = np.zeros((H, W), np.float32)
    cv2.ellipse(m, (int(cx), int((y0 + y1) / 2)), (int(0.34 * fw), int((y1 - y0) / 2)), 0, 0, 360, 1, -1)
    ycc = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb); skin = ((ycc[..., 1] > 133) & (ycc[..., 1] < 180) & (ycc[..., 2] > 80) & (ycc[..., 2] < 135)).astype(np.float32)
    jaw = np.zeros((H, W), np.uint8); cv2.fillConvexPoly(jaw, cv2.convexHull(P.astype(np.int32)), 1)   # 얼굴(턱 포함)은 건드리지 않음
    m = m * skin * (1 - jaw); m = cv2.GaussianBlur(m * cv2.erode(skin, np.ones((15, 15), np.uint8)), (0, 0), 0.025 * fw) * amt   # 머리카락 가장자리 피함
    soft = cv2.bilateralFilter(img, 0, 22, 0.035 * fw)
    soft = cv2.GaussianBlur(soft, (0, 0), sigmaX=0.006 * fw, sigmaY=0.045 * fw)   # 세로로 더 흐려 가로 주름을 지움
    noise = (img.astype(np.float32) - cv2.GaussianBlur(img, (0, 0), 1.2).astype(np.float32)) * 0.35   # 미세 결은 조금 남김
    res = soft.astype(np.float32) + noise
    return np.clip(img * (1 - m[..., None]) + res * m[..., None], 0, 255).astype(np.uint8)

if __name__ == '__main__':
    a = sys.argv; img = cv2.imread(a[1])
    cv2.imwrite(a[2], retouch(img, float(a[3]) if len(a) > 3 else 0.14, float(a[4]) if len(a) > 4 else 0.08))
