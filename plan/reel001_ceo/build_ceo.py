# 001 릴스 · 대표 촬영본 버전 (스페인어 더빙 전 단계)
# 정지 구간 길이 = 대표 한국어 구간 길이(말 사이 공백 정리 후). 오디오 = 대표 원음(잡음 정리). 자막 = 스페인어(더빙 후 타이밍 재조정)
# usage: python3 build_ceo.py <ceo_video_1080x1920.mp4> <clean.wav> <silences.txt>
import json, subprocess, sys
CEO_V, CEO_A, SIL = sys.argv[1], sys.argv[2], sys.argv[3]
plan = json.load(open('plan.json'))
SUBS = json.load(open('subs_plan.json'))
# 헤드카피는 처음 후킹 제목으로 끝까지 고정, 포인트 이름은 멈춤 배지로 ("01 · SIN FILTRO")
H1, H2 = 'Ni una palabra.', plan['segs'][0]['h2']   # 제목: Ni una palabra. / 5,4 M de vistas. (말 한마디 없이 / 조회수 540만)
for s in plan['segs']:
    if s.get('endcard'): continue
    if s.get('pause') and s['pause'] not in ('HOOK',) and s.get('h1'):
        s['pause'] = (s['h1'] + ' ' + s['h2']).upper().replace('/ ', '/ ')
    s['h1'], s['h2'] = H1, H2   # 자막 조각: 의미·호흡 단위, 한 줄(폭 900px 이하)
VY = int(plan.get('video_y', 0)); SRC = 'src_7482942231217704238.mp4'
run = lambda c: subprocess.run(c, check=True)
import re as _re   # 재생 구간 원본 소리 (-19 LUFS 정도)
_o = subprocess.run(['ffmpeg', '-hide_banner', '-i', SRC, '-vn', '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
_L = float((_re.findall(r'I:\s+(-?[\d.]+) LUFS', _o) or ['-19'])[-1])
SRC_VOL = round(10 ** (max(-12, min(18, -19 - _L)) / 20), 3)
dur = lambda f: float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)

# 대표 촬영본에서 각 멈춤 구간에 해당하는 원본 시간 (받아쓰기 기준)
SECT = {'HOOK': (0.0, 5.3), '01': (5.3, 13.5), '02': (13.5, 23.75), '03': (23.75, 32.45), '04': (32.45, 40.0), '05': (40.0, 49.5), 'CTA': (49.5, 57.0)}
LEAD, TAIL = 0.12, 0.25          # 정지 화면에서 말 시작 전/후 여유
CROP = (900, 90, 520)            # 원형에 들어갈 얼굴 정사각 크롭 (크기, x, y) @1080x1920
sil = [tuple(map(float, l.split())) for l in open(SIL) if l.strip()]
JUMPS = [float(x) for x in open(sys.argv[4])] if len(sys.argv) > 4 else []   # 촬영본에서 이어 붙인 지점(초)

def speech_chunks(a, b):
    """구간 [a,b]에서 무음을 빼고 말한 부분만, 앞뒤 살짝 여유 두고 이어 붙일 조각"""
    cur = a; out = []
    for s, e in sil:
        if e <= a or s >= b: continue
        if s > cur: out.append([cur, s])
        cur = max(cur, e)
    if cur < b: out.append([cur, b])
    out = [[max(a, x - 0.12), min(b, y + 0.22)] for x, y in out if y - x > 0.12]
    merged = []
    for x, y in out:
        if merged and x - merged[-1][1] < 0.05: merged[-1][1] = y
        else: merged.append([x, y])
    return merged

# 1) 구간별 대표 클립 (영상+음성, 말 사이 공백 정리)
cutlist = {}
for i, s in enumerate(plan['segs']):
    if not s.get('pip'): continue
    key = s['pause'].split()[0]; a, b = SECT[key]; ch = speech_chunks(a, b); cutlist[key] = ch
    fl = []; n = len(ch); c, x0, y0 = CROP; z = 0
    for k, (x, y) in enumerate(ch):
        cc = int(c * (0.9 if z else 1.0)); xx = x0 + (c - cc) // 2; yy = y0 + int((c - cc) * 0.4)
        fl.append(f"[0:v]trim={x:.3f}:{y:.3f},setpts=PTS-STARTPTS,crop={cc}:{cc}:{xx}:{yy},scale=330:330,setsar=1[v{k}]")
        fl.append(f"[1:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={max(0,y-x-0.02):.3f}:d=0.02[a{k}]")
    fl.append(''.join(f'[v{k}][a{k}]' for k in range(n)) + f'concat=n={n}:v=1:a=1[v][a]')
    fl.append(f"[v]fps=30,format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lte(hypot(X-164.5,Y-164.5),165),255,0)'[vc]")
    run(['ffmpeg', '-v', 'error', '-y', '-i', CEO_V, '-i', CEO_A, '-filter_complex', ';'.join(fl), '-map', '[vc]', '-map', '[a]',
         '-c:v', 'qtrle', '-c:a', 'pcm_s16le', f'ceo_{i:02d}.mov'])
    s['ceo'] = f'ceo_{i:02d}.mov'; s['ceo_d'] = round(dur(f'ceo_{i:02d}.mov'), 2); s['d'] = round(s['ceo_d'] + LEAD + TAIL, 2)
json.dump(cutlist, open('ceo_cutlist.json', 'w'), indent=1)
json.dump(plan, open('plan.json', 'w'), ensure_ascii=False, indent=1)

# 흰 원 테두리 (346px, 기존 점선 자리를 덮음)
run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=white@0:s=346x346,format=rgba', '-frames:v', '1', '-vf',
     "geq=r=255:g=255:b=255:a='if(lte(hypot(X-172.5,Y-172.5),173),255,0)'", 'ring.png'])

# 2) 오버레이
run(['node', 'render2.mjs'])

# 3) 세그먼트
enc = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-r', '30', '-an']
parts = []; t = 0; cues = []; subs = []
for i, s in enumerate(plan['segs']):
    ov = f'ov_{i:02d}.png'; out = f'seg_{i:02d}.mp4'
    if s['t'] == 'play':
        cmd = ['ffmpeg', '-v', 'error', '-y', '-ss', str(s['a']), '-to', str(s['b']), '-i', SRC, '-i', ov, '-filter_complex',
               f"[0:v]fps=30,scale=1080:1920,setsar=1,split[x][y];[x]boxblur=30:3,eq=brightness=-0.3[bg];[bg][y]overlay=0:{VY}[v];[v][1:v]overlay=0:0[o]", '-map', '[o]'] + enc + [out]
    else:
        px, py = (367, 220) if s.get('endcard') else (691, 640)
        base = f"[0:v]trim=end_frame=1,scale=1080:1920,setsar=1,split[x][y];[x]boxblur=30:3,eq=brightness=-0.3[bg];[bg][y]overlay=0:{VY},loop=loop=-1:size=1,fps=30,trim=duration={s['d']}[v];[v][1:v]overlay=0:0[o0]"
        ins = ['-ss', str(s['at']), '-i', SRC, '-i', ov, '-i', 'ring.png', '-i', s['ceo']]
        fc = base + f";[o0][2:v]overlay={px}:{py}[o1];[3:v]tpad=start_duration={LEAD}:start_mode=clone:stop_duration={TAIL+0.3}:stop_mode=clone[c];[o1][c]overlay={px+8}:{py+8}:eof_action=repeat[o2]"
        last = 'o2'
        if s.get('endcard'):
            ins += ['-i', 'hand_down.png']; fc += ";[o2][4:v]overlay=x=455:y='1440+34*abs(sin(PI*1.6*t))':eval=frame[o3]"; last = "o3"   # 아래를 가리키는 손, 위아래로 통통
        cmd = ['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', fc, '-map', f'[{last}]', '-t', str(s['d'])] + enc + [out]
        cues.append((s['ceo'], t + LEAD))
        if not s.get('endcard'): subs.append((' | '.join(SUBS.get(s['pause'].split()[0], [s['sub']])), t + LEAD, s['ceo_d']))
    run(cmd); parts.append(out)
    if s['t'] == 'play': cues.append((SRC, t, s['a'], dur(out)))
    t += dur(out)
open('list.txt', 'w').write(''.join(f"file '{p}'\n" for p in parts))
run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'video_nosub.mp4'])

# 3b) 스페인어 자막 (대표 말 길이에 맞춰 나눔 · 더빙 후 다시 맞춤)
chunks = []
for text, st, d in subs:
    ps = [x.strip() for x in text.split('|')]; tot = sum(len(x) for x in ps); c = st
    for x in ps: dd = d * len(x) / tot; chunks.append((x, c, c + dd)); c += dd
json.dump([c[0] for c in chunks], open('subs.json', 'w'), ensure_ascii=False)
run(['node', 'render_subs.mjs'])
ins = ['-i', 'video_nosub.mp4']; fl = []; prev = '0:v'
for k, (x, a, e) in enumerate(chunks):
    ins += ['-i', f'sub_{k:02d}.png']; fl.append(f"[{prev}][{k+1}:v]overlay=0:0:enable='between(t,{a:.2f},{e:.2f})'[s{k}]"); prev = f's{k}'
run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', ';'.join(fl), '-map', f'[{prev}]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', 'video_only.mp4'])

# 4) 오디오: 대표 원음을 정지 구간에 배치
ins = []; fl = []
for k, (f, st, *ss) in enumerate(cues):
    ms = int(st * 1000)
    if ss:   # 재생 구간 원본 소리
        ins += ['-ss', str(ss[0]), '-i', f]; fl.append(f'[{k}:a]aresample=48000,atrim=0:{ss[1]:.2f},afade=t=in:d=0.05,afade=t=out:st={max(0, ss[1] - 0.12):.2f}:d=0.12,volume={SRC_VOL},adelay={ms}|{ms}[a{k}]')
    else:
        ins += ['-i', f]; fl.append(f'[{k}:a]aresample=48000,adelay={ms}|{ms}[a{k}]')
fl.append(''.join(f'[a{k}]' for k in range(len(cues))) + f'amix=inputs={len(cues)}:normalize=0,apad,atrim=0:{t:.2f},loudnorm=I=-16:TP=-1.5[a]')
run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', ';'.join(fl), '-map', '[a]', '-ac', '2', 'voice_ko.wav'])
run(['ffmpeg', '-v', 'error', '-y', '-i', 'video_only.mp4', '-i', 'voice_ko.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'b2x_kbeauty_que_vende_001_ceo_ko.mp4'])
print('total', round(t, 2), {k: round(sum(y - x for x, y in v), 2) for k, v in cutlist.items()})
