# 편 마무리: 썸네일 · 업로드 문구 · plan/final/NNN 복사 (plan/EDIT_RULES.md 7)
# usage: ep_final.py NNN
import sys, os, json, subprocess, shutil
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
REPO = '/home/user/threads-dna-studio'
MODE_KO = os.environ.get('KO') == '1'
no = sys.argv[1]; D = f'{S}/ep/{no}'
p = json.load(open(f'{D}/plan_base.json')); ov = json.load(open(f'{D}/override.json'))
sys.path.insert(0, S + '/tools'); from ep import data
E, LB, SH = data(no)
run = lambda c: subprocess.run(c, check=True)
F = f'{REPO}/plan/final/{no}'; os.makedirs(F, exist_ok=True)

# 썸네일: 배경 = 원본에서 포인트 02 장면, 원형 = 보정한 대표 얼굴
t_bg = [s.get('still', s['at']) for s in p['segs'] if s['t'] == 'freeze'][2]
run(['ffmpeg', '-v', 'error', '-y', '-ss', str(max(0, t_bg - 0.3)), '-i', f'{D}/src.mp4', '-frames:v', '1', '-vf', 'scale=1080:1920:flags=lanczos,unsharp=5:5:0.5', f'{D}/thumb_bg.jpg'])
import cv2
_g = cv2.Canny(cv2.cvtColor(cv2.resize(cv2.imread(f'{D}/thumb_bg.jpg'), (1080, 1920)), cv2.COLOR_BGR2GRAY), 80, 200)[180:330] / 255
auto_blur = (cv2.blur(_g, (41, 15)) > 0.16).mean() > 0.1   # 헤더 자리(ACADEMY 줄)에 원본 글자가 있으면 자동
if ov.get('thumb_blur_top') or auto_blur:   # 원본에 박힌 상단 글자가 헤더와 겹치면 그 띠만 흐리게
    hb = int(ov.get('thumb_blur_top', 420)); run(['ffmpeg', '-v', 'error', '-y', '-i', f'{D}/thumb_bg.jpg', '-filter_complex', f'[0]split[a][b];[b]crop=1080:{hb}:0:0,boxblur=24:3,eq=brightness=-0.15[t];[a][t]overlay=0:0', f'{D}/thumb_bg.jpg'])
bv = f'{D}/beauty.mp4'; from facecrop import face_crop; fc, fx, fy = face_crop(D)   # 영상 원과 같은 크롭 (얼굴 가운데) + 좌우반전
run(['python3', f'{S}/tools/face_pick.py', bv, f'{fc},{fx},{fy}', f'{D}/face_pick', '1']); run(['python3', f'{S}/tools/thumb_retouch.py', f'{D}/face_pick/cand_1.png', f'{D}/ceo_face.png'])   # v7: 표정 좋은 프레임 자동 선택 → 자연스럽게 갸름하게(턱선 8%)·눈 12% (썸네일만)
ep_i = int(no)
px, py = '60', '1130'   # 원형 위치는 모든 편 동일 (왼쪽 아래, 영상과 같은 쪽) — 프로필 그리드(3:4) 안 · 오른쪽 버튼 데드존 피함
run(['python3', f'{REPO}/plan/reel001/template/make_thumb.py', '--bg', f'{D}/thumb_bg.jpg', '--cat', 'C1', '--label', 'CLASS 1 · VIRAL', '--ep', str(ep_i),
     '--title', '|'.join(x.replace('\n', '|') for x in p['title_es']), '--sub', ov.get('thumb_sub_es', '¿Qué hizo diferente?'), '--pip', f'{D}/ceo_face.png', '--pip-x', px, '--pip-y', py, '--brand-text', '', '--out', f'{F}/{no}_썸네일.png'])

# 영상
shutil.copy(f'{D}/b2x_kbeauty_que_vende_{no}_es.mp4', f'{F}/{no}_ES_최종.mp4')
if os.path.exists(f'{D}/b2x_kbeauty_que_vende_{no}_ko.mp4') and MODE_KO: shutil.copy(f'{D}/b2x_kbeauty_que_vende_{no}_ko.mp4', f'{F}/{no}_KO_대표원음.mp4')   # v7: KO 버전 안 만듦

# 업로드 문구
cta = [s for s in p['segs'] if s.get('endcard')][0]
cta_ko = ov.get('cta_ko', cta['ko'])
url = f"https://www.tiktok.com/@{E['handle']}/video/{E['id']}"
t_es = ' '.join(x.replace('\n', ' ') for x in p['title_es']); t_ko = ' '.join(p['title_ko'])
cap = f"""{t_es} 🤯
{ov.get('cap_es', '3 claves de este video de K-beauty, y cómo usarlas para vender.')}

🎁 {cta['sub'].split('Te lo mando')[0].strip()} Comenta cualquier emoji y te lo mando por mensaje.

#kbeauty #skincarecoreano #tiktokshop #creadoradecontenido #ugc"""
md = f"""# {no} 업로드 문구 (인스타 릴스 · 틱톡 공통)

## 제목 / 커버
- ES: **{t_es}**
- KO: {t_ko}
- 커버 부제 ES: {ov.get('thumb_sub_es', '¿Qué hizo diferente?')} / KO: {ov.get('thumb_sub_ko', '뭐가 달랐을까?')}

## 캡션 (복붙용 · 스페인어)
```
{cap}
```

## 캡션 한국어 뜻 (확인용)
{t_ko} 🤯
{ov.get('cap_ko', '이 K뷰티 영상의 핵심 3가지, 그리고 팔 때 써먹는 법.')}
🎁 {cta_ko.split('🎁')[0].strip().rstrip(',')}. 받고 싶으면 아무 이모티콘이나 댓글로 남겨주세요. DM으로 보내드려요.

## 올리기 전 체크
- [ ] 원작자 호출 금지: 캡션·댓글에 원본 @계정·링크 넣지 않음 (출처는 영상 안에 표기)
- [ ] DM 자동응답: "모든 댓글"에 반응 (키워드 없음) → 약속한 자료 + 왓츠앱 링크
- [ ] 스페인어 원어민 검수 1회 (자막·캡션)
""" + (''.join(f'- 메모: {n}\n' for n in ov.get('notes', [])))
open(f'{F}/{no}_업로드문구.md', 'w').write(md)
print(F); print(md)
