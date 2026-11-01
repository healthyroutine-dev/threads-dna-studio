# 잔머리·붕뜬 머리 정돈 (v7 시안): 머리 윤곽 밖으로 삐져나온 가는 머리·뜬 부분을 배경으로 자연스럽게 메움
# usage: hair_tidy.py IN.png OUT.png [R=0.045]   (이미지 1장 테스트용) / import tidy(frame, seg, state)
import sys, cv2, numpy as np, mediapipe as mp
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'

def segmenter():
    return mp.tasks.vision.ImageSegmenter.create_from_options(mp.tasks.vision.ImageSegmenterOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=S + '/models/selfie_multiclass.tflite'), output_confidence_masks=True))

def tidy(img, seg, R=0.12, prev=None):
    H, W = img.shape[:2]
    r = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    cm = [m.numpy_view().squeeze() for m in r.confidence_masks]
    bgp = cm[0]; hair = cm[1]
    person = 1 - bgp
    if prev is not None: person = 0.6 * person + 0.4 * prev   # 프레임 사이 떨림 줄이기
    pm = (person > 0.5).astype(np.uint8)
    k = int(R * W) | 1
    core = cv2.morphologyEx(pm, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    # 배경 판: 사람 아닌 곳만으로 정규화 블러 → 벽색 자연스럽게
    bm = (bgp > 0.85).astype(np.float32); sig = 0.03 * W
    num = cv2.GaussianBlur(img.astype(np.float32) * bm[..., None], (0, 0), sig); den = cv2.GaussianBlur(bm, (0, 0), sig)[..., None] + 1e-4
    plate = num / den
    # 지울 곳: 매끈한 윤곽(core) 밖에서 사람(머리) 확률이 조금이라도 있거나 벽보다 어두운 곳 → 테두리 잔상까지
    diff = np.abs(img.astype(np.float32) - plate).max(2)
    outside = 1 - cv2.dilate(core, np.ones((3, 3), np.uint8)).astype(np.float32)
    rm = (((person > 0.08) | (diff > 14)) * outside).astype(np.uint8)
    rm = cv2.dilate(rm, np.ones((5, 5), np.uint8)).astype(np.float32) * outside
    rm = cv2.GaussianBlur(rm, (0, 0), 1.5); rm = np.clip(rm * 1.5, 0, 1)
    plate = plate + (np.random.default_rng(0).normal(0, 1.2, img.shape)).astype(np.float32)   # 벽 질감 약간
    out = img * (1 - rm[..., None]) + plate * rm[..., None]
    return np.clip(out, 0, 255).astype(np.uint8), person

if __name__ == '__main__':
    img = cv2.imread(sys.argv[1]); out, _ = tidy(img, segmenter(), float(sys.argv[3]) if len(sys.argv) > 3 else 0.12)
    cv2.imwrite(sys.argv[2], out)
