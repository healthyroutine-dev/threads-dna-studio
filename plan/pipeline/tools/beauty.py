# K-beauty 보정: 피부 결 정리 + 화사한 톤 + 턱선 살짝 정리 (프레임 단위, 랜드마크 시간 평활)
# usage: beauty.py in.mp4 out.mp4 [start end]   (출력 1080x1920, 무음 영상)
import sys, subprocess, numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

import os
M = os.path.dirname(os.path.dirname(os.path.abspath(sys.argv[0]))) + '/models/'
W, H = 1080, 1920
# BEAUTY_CROP="w,h,x,y": 원형 화면에 쓰는 영역만 처리 (속도 약 2.5배). 출력도 그 크기
CROPPED = bool(os.environ.get('BEAUTY_CROP'))
if CROPPED: W, H, CX, CY = map(int, os.environ['BEAUTY_CROP'].split(','))
CHIN = 152; NOSE = 1

lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=M + 'face_landmarker.task'), running_mode=vision.RunningMode.VIDEO, num_faces=1))
seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
    base_options=mpt.BaseOptions(model_asset_path=M + 'selfie_multiclass.tflite'), running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True))

def reshape(img, p):
    """광대 아래~턱을 한 번에 부드럽게 모으고(V라인), 눈을 아주 살짝 키우는 하나의 연속 워프"""
    cx = (p[234][0] + p[454][0]) / 2; fw = p[454][0] - p[234][0]
    ye = (p[159][1] + p[386][1]) / 2; yn = p[NOSE][1]; ym = (p[13][1] + p[14][1]) / 2; yc = p[CHIN][1]
    x0 = int(max(0, cx - 0.9 * fw)); x1 = int(min(W, cx + 0.9 * fw)); y0 = int(max(0, ye - 0.35 * fw)); y1 = int(min(H, yc + 0.35 * fw))
    sub = img[y0:y1, x0:x1]
    gx, gy = np.meshgrid(np.arange(x0, x1, dtype=np.float32), np.arange(y0, y1, dtype=np.float32))
    mx, my = gx.copy(), gy.copy()
    # V라인: 세로 가중치(코 아래에서 커져서 입~턱에서 최대, 턱 아래로 사라짐) x 가로 가중치(얼굴 폭 밖에서 사라짐)
    wy = np.clip((gy - yn) / (ym - yn + 1e-3), 0, 1) ** 1.5 * np.clip(1 - (gy - yc) / (0.3 * fw), 0, 1)
    rx = np.abs(gx - cx) / (0.5 * fw)
    wx = np.exp(-np.clip(rx - 0.55, 0, None) ** 2 / 0.18) * np.clip(rx / 0.55, 0, 1)
    mx += (gx - cx) * 0.05 * wy * wx
    my -= 0.012 * fw * wy * np.clip(1 - rx, 0, 1)                    # 턱끝 살짝 올림
    # 눈: 중심에서 반경 안쪽을 살짝 확대
    for a_, b_ in ((33, 133), (362, 263)):
        ex, ey = (p[a_] + p[b_]) / 2; r = np.linalg.norm(p[a_] - p[b_]) * 0.85
        d2 = ((gx - ex) ** 2 + (gy - ey) ** 2) / (r * r); w = np.clip(1 - d2, 0, 1) ** 2 * 0.09
        mx -= (gx - ex) * w; my -= (gy - ey) * w
    img = img.copy()
    img[y0:y1, x0:x1] = cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return img

def grade(img, skin, hair, hair_raw):
    m = np.maximum(skin, hair)
    ys, xs = np.where(m > 0.03)
    out = img.copy()
    if len(ys):
        pad = 40
        y0, y1 = max(0, ys.min() - pad), min(img.shape[0], ys.max() + pad)
        x0, x1 = max(0, xs.min() - pad), min(img.shape[1], xs.max() + pad)
        out[y0:y1, x0:x1] = _grade_roi(img[y0:y1, x0:x1], skin[y0:y1, x0:x1], hair[y0:y1, x0:x1], hair_raw[y0:y1, x0:x1])
    return _global(out)

def _grade_roi(img, skin, hair, hair_raw):
    f = img.astype(np.float32) / 255
    # 잔머리: 머리 덩어리(core) 바깥의 가는 머리카락을 배경색으로 정리 (얼굴 근처는 건드리지 않음)
    hb_ = (hair_raw > 0.25).astype(np.uint8)
    core_b = cv2.morphologyEx(hb_, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
    core = cv2.GaussianBlur(core_b.astype(np.float32), (0, 0), 2.0)
    band = cv2.dilate(core_b, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35))).astype(np.float32) - core_b   # 머리 덩어리 바로 바깥 띠
    near_face = cv2.GaussianBlur(cv2.dilate((skin > 0.3).astype(np.uint8), np.ones((41, 41), np.uint8)).astype(np.float32), (0, 0), 8)
    fringe = np.clip(cv2.GaussianBlur(hair_raw, (0, 0), 1.5) * 2.0, 0, 1) * cv2.GaussianBlur(band, (0, 0), 3) * (1 - core) * (1 - near_face)
    wbg = 1 - cv2.dilate((hair_raw > 0.15).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
    bg = cv2.GaussianBlur(f * wbg[..., None], (0, 0), 22) / (cv2.GaussianBlur(wbg, (0, 0), 22)[..., None] + 1e-4)
    fr = (fringe * 0.92)[..., None]
    f = f * (1 - fr) + bg * fr
    # 머릿결: 푸석한 결 정리 (강하게) 
    u8 = (np.clip(f, 0, 1) * 255).astype(np.uint8)
    hs = cv2.bilateralFilter(cv2.bilateralFilter(u8, 0, 30, 6), 0, 24, 4).astype(np.float32) / 255
    ha = (hair * core)[..., None] * 0.85
    f = f * (1 - ha) + hs * ha
    # 피부 결: edge-preserving 스무딩 + 결 조금 남기기
    sm = cv2.bilateralFilter(img, 0, 26, 8).astype(np.float32) / 255
    sm = cv2.GaussianBlur(sm, (0, 0), 1.0)
    hf = f - cv2.GaussianBlur(f, (0, 0), 3)
    a = skin[..., None] * 0.7
    f = f * (1 - a) + (sm + hf * 0.4) * a
    lab = cv2.cvtColor((np.clip(f, 0, 1) * 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    # 피부: 밝고 맑게, 번들거림(하이라이트) 눌러서 물광 정도로, 혈색은 살짝 핑크
    base = cv2.GaussianBlur(L, (0, 0), 12)
    shine = np.clip(L - base - 6, 0, None)
    L = L + skin * (6 - shine * 0.45)
    A = A + skin * 1.0
    B = B - skin * 1.2
    # 머리: 하이라이트 살리고 전체는 살짝 깊게
    hb = cv2.GaussianBlur(L, (0, 0), 9)
    hl = np.clip(L - hb, 0, 45)
    L = L + hair * (cv2.GaussianBlur(hl, (0, 0), 2) * 1.5 - 4)          # 윤기 하이라이트 강조, 바탕은 깊게
    A = A + hair * 0.5; B = B + hair * 1.0                              # 살짝 따뜻한 갈색 윤기
    lab = np.stack([np.clip(L, 0, 255), np.clip(A, 0, 255), np.clip(B, 0, 255)], -1).astype(np.uint8)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

def _global(img):
    # 전체: 살짝 밝고 부드럽게 + 약한 글로우 (화사한 K-뷰티 톤)
    f = img.astype(np.float32) / 255
    f = 0.5 + (f - 0.5) * 0.95 + 0.02
    small = cv2.resize(f, (f.shape[1] // 4, f.shape[0] // 4))
    glow = cv2.resize(cv2.GaussianBlur(small, (0, 0), 5), (f.shape[1], f.shape[0]))
    f = 1 - (1 - f) * (1 - glow * 0.1)
    return (np.clip(f, 0, 1) * 255).astype(np.uint8)

def main():
    src, dst = sys.argv[1], sys.argv[2]
    ss = ['-ss', sys.argv[3], '-to', sys.argv[4]] if len(sys.argv) > 4 else []
    fps = 28.75
    vf = f'scale=1080:1920:flags=lanczos' + (f',crop={W}:{H}:{CX}:{CY}' if CROPPED else '')
    dec = subprocess.Popen(['ffmpeg', '-v', 'error'] + ss + ['-i', src, '-vf', vf, '-pix_fmt', 'bgr24', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                            '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', dst], stdin=subprocess.PIPE)
    prev = None; prev_skin = None; prev_hair = None; prev_hraw = None; k = 0
    while True:
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3: break
        img = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        ts = int(k * 1000 / fps)
        rgb = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        r = lm.detect_for_video(rgb, ts)
        cm = seg.segment_for_video(rgb, ts).confidence_masks
        skin = np.clip(cm[3].numpy_view() + cm[2].numpy_view() * 0.6, 0, 1).astype(np.float32)   # 3 얼굴피부, 2 몸피부
        skin = cv2.GaussianBlur(cv2.resize(skin, (W, H)), (0, 0), 6)
        prev_skin = skin if prev_skin is None else prev_skin * 0.5 + skin * 0.5
        hair_raw = cv2.resize(cm[1].numpy_view().astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR)
        prev_hraw = hair_raw if prev_hraw is None else prev_hraw * 0.5 + hair_raw * 0.5
        hair = cv2.GaussianBlur(hair_raw, (0, 0), 4)
        prev_hair = hair if prev_hair is None else prev_hair * 0.5 + hair * 0.5
        if r.face_landmarks:
            p = np.array([[q.x * W, q.y * H] for q in r.face_landmarks[0]], np.float32)
            prev = p if prev is None else prev * 0.6 + p * 0.4
        if prev is not None:
            img = reshape(img, prev)
        out = grade(img, prev_skin, prev_hair, prev_hraw)
        enc.stdin.write(out.tobytes()); k += 1
        if k % 100 == 0: print(k, flush=True)
    enc.stdin.close(); enc.wait(); print('frames', k)

main()
