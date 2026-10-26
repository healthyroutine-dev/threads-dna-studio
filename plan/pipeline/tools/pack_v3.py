# v2 수정본 묶기: 영어 파일명(_v3) + 수정내역(CHANGES.txt, 한국어) · 윈도우 호환(UTF-8 플래그, 무압축)
import zipfile, os
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
F = '/home/user/threads-dna-studio/plan/final'
COMMON = '공통(v3): 새 제목(뷰티 인플루언서용 후킹), 시작 원본 3초 → 후킹, 한국어 말 사이 짧게, 상단 제목 3줄 자동 맞춤 / 이전(v2): 대표 문장 이음새 자연스럽게(화면·소리 0.1초 겹침), 상단 "Duración"→"Video original", 엔드카드 영어 "sourcing"→"Productos de la semana"'
EP = {'002': '패드를 반으로 나누는 장면을 끝까지 보여준 뒤 멈춤', '005': '스페인어 자막 위로(원본 글자와 안 겹치게)',
      '007': '하얀 파운데이션이 피부색으로 바뀌는 장면 길게 재생', '008': '멈춤 화면 COSRX → 뷰티 오브 조선 ❌ 장면',
      '009': '스페인어 자막 위로', '010': '펌프·거품 소리 구간 길게 재생', '013': '2초마다 바뀌는 장면이 보이게 멈춤 시점 조정',
      '016': '스페인어 자막 위로, 멈춤 화면 → "4% 나이아신아마이드" 장면·캡슐 병 장면', '017': '스페인어 자막 위로',
      '018': '멈춤 화면 → 클레이 스틱 제품 이름 장면', '020': '멈춤 화면 → 케이팝 아이돌 장면',
      '023': '스페인어 자막 위로, 제품이 바뀌는 장면이 보이게 멈춤 시점 조정', '024': '시청자 댓글 확대, 스페인어 자막 위로',
      '025': '스페인어 자막 위로, 팁 구간 멈춤 화면 → 결과(깨끗한 피부) 장면'}
def name(no, fn):
    if fn.endswith('.png'): return f'{no}_thumbnail_v3.png'
    if fn.endswith('.md'): return f'{no}_caption_v3.md'
    return f"{no}_{'ES' if '_ES_' in fn else 'KO'}_v3.mp4"
for a, b in [(1, 6), (7, 11), (12, 16), (17, 21), (22, 26)]:
    out = f'{S}/edit_done_v3_revised_{a:03d}-{b:03d}.zip'
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:
        log = ['v3 최종 (2026-10-26)', COMMON, '']
        for n in range(a, b + 1):
            no = f'{n:03d}'; log.append(f'{no}: {EP.get(no, "공통 수정만")}')
            for fn in sorted(os.listdir(f'{F}/{no}')): z.write(f'{F}/{no}/{fn}', f'edit_done_v3/{no}/{name(no, fn)}')
        z.writestr(f'edit_done_v3/CHANGES_{a:03d}-{b:03d}.txt', '﻿' + '\r\n'.join(log))
    print(os.path.basename(out), os.path.getsize(out) // 2**20, 'MB', zipfile.ZipFile(out).testzip())
