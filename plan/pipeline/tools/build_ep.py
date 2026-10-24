# K-Beauty que vende 편 공용 빌드 (plan/EDIT_RULES.md)
# mode es: 대표 v2 스페인어 + 한국어 원음 작게, 속도 맞춤·같이 끝남, 자막 = 스페인어 단어 시간
# mode ko: 대표 한국어 원음, 정지 = 한국어 길이, 자막(스페인어)은 길이 비례
# usage: python3 build_ep.py es|ko <ceo_video> <clean.wav> <silences.txt> [dub_dir]
import json, subprocess, sys, glob, os
MODE = sys.argv[1]; CEO_V, CEO_A, SIL = sys.argv[2], sys.argv[3], sys.argv[4]
plan = json.load(open('plan.json'))
SUBS = json.load(open('subs_plan.json'))
# 헤드카피는 처음 후킹 제목으로 끝까지 고정, 포인트 이름은 멈춤 배지로 ("01 · SIN FILTRO")
H1, H2 = plan['title_es']   # 제목 (plan.json title_es / title_ko)
for s in plan['segs']:
    if s.get('endcard'): continue
    if s.get('pause') and s['pause'] not in ('HOOK',) and s.get('h1'):
        s['key'] = s['pause']; s['pause'] = (s['h1'] + ' ' + s['h2']).upper().replace('/ ', '/ ')
    s['h1'], s['h2'] = H1, H2   # 자막 조각: 의미·호흡 단위, 한 줄(폭 900px 이하)
VY = int(plan.get('video_y', 0)); SRC = plan['src']
run = lambda c: subprocess.run(c, check=True)
dur = lambda f: float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)

# 대표 촬영본에서 각 멈춤 구간에 해당하는 원본 시간 (받아쓰기 기준)
SECT = {k: tuple(v) for k, v in plan['sect'].items()}
LEAD, TAIL = 0.12, 0.25          # 정지 화면에서 말 시작 전/후 여유
CROP = tuple(plan.get('crop', (900, 90, 520)))   # 원형에 들어갈 정사각 크롭 (크기, x, y) · 보정 영상 기준
sil = sorted([tuple(map(float, l.split())) for l in open(SIL) if l.strip()] + [tuple(c) for c in plan.get('cut', [])])   # cut: 다시 말한 중복 구간 빼기
DUB = sys.argv[5] if MODE == 'es' else None
KO_VOL = 0.13 if MODE == 'es' else 1.0   # es: 한국어 원음 약 -18dB
import re as _re   # 재생 구간 원본 소리: 원본 전체 음량을 재서 -19 LUFS 정도로 맞춤 (대표 음성보다 살짝 작게)
_o = subprocess.run(['ffmpeg', '-hide_banner', '-i', SRC, '-vn', '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
_L = float((_re.findall(r'I:\s+(-?[\d.]+) LUFS', _o) or ['-19'])[-1])
SRC_VOL = round(10 ** (max(-12, min(18, -19 - _L)) / 20), 3)
WORDS = json.load(open(f'{DUB}/es_words.json')) if DUB else {}
ES = {os.path.basename(f).split('_', 2)[2][:-4]: f for f in glob.glob(f'{DUB}/es_*.wav')} if DUB else {}   # key -> wav

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
    key = s.get('key') or s['pause'].split()[0]; a, b = SECT[key]; ch = speech_chunks(a, b); cutlist[key] = ch
    fl = []; n = len(ch); c, x0, y0 = CROP; z = 0
    for k, (x, y) in enumerate(ch):
        cc = int(c * (0.9 if z else 1.0)); xx = x0 + (c - cc) // 2; yy = y0 + int((c - cc) * 0.4)
        fl.append(f"[0:v]trim={x:.3f}:{y:.3f},setpts=PTS-STARTPTS,crop={cc}:{cc}:{xx}:{yy},scale=330:330,setsar=1[v{k}]")
        fl.append(f"[1:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={max(0,y-x-0.02):.3f}:d=0.02[a{k}]")
    ks = round(min(1.1, max(1.0, sum(y - x for x, y in ch) / dur(ES[key]))), 3) if DUB else 1.0   # 한국어(영상+원음)는 최대 1.1배까지만 빠르게
    fl.append(''.join(f'[v{k}][a{k}]' for k in range(n)) + f'concat=n={n}:v=1:a=1[v0][a0]')
    fl.append(f'[v0]setpts=PTS/{ks}[v];[a0]atempo={ks}[a]')
    fl.append(f"[v]fps=30,format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lte(hypot(X-164.5,Y-164.5),165),255,0)'[vc]")
    run(['ffmpeg', '-v', 'error', '-y', '-i', CEO_V, '-i', CEO_A, '-filter_complex', ';'.join(fl), '-map', '[vc]', '-map', '[a]',
         '-c:v', 'qtrle', '-c:a', 'pcm_s16le', f'ceo_{i:02d}.mov'])
    s['ceo'] = f'ceo_{i:02d}.mov'; s['ceo_d'] = round(dur(f'ceo_{i:02d}.mov'), 2)
    if DUB: s['es'] = ES[key]; s['es_d'] = round(dur(ES[key]), 2)
    else: s['es_d'] = 0
    s['d'] = round(max(s['es_d'], s['ceo_d']) + LEAD + TAIL + 0.1, 2)
    s['es_off'] = round(max(0, s['ceo_d'] - s['es_d']), 2) if DUB else 0; s['ko_off'] = round(max(0, s['es_d'] - s['ceo_d']), 2)   # 짧은 쪽을 늦게 시작 → 같이 끝남
    s['ko_speed'] = ks
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
        fc = base + f";[o0][2:v]overlay={px}:{py}[o1];[3:v]tpad=start_duration={LEAD + s.get('ko_off', 0)}:start_mode=clone:stop_duration={TAIL+0.3}:stop_mode=clone[c];[o1][c]overlay={px+8}:{py+8}:eof_action=repeat[o2]"
        last = 'o2'
        if s.get('endcard'):
            ins += ['-i', 'hand_down.png']; fc += ";[o2][4:v]overlay=x=455:y='1440+34*abs(sin(PI*1.6*t))':eval=frame[o3]"; last = "o3"   # 아래를 가리키는 손, 위아래로 통통
        cmd = ['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', fc, '-map', f'[{last}]', '-t', str(s['d'])] + enc + [out]
        if DUB: cues.append((s['es'], t + LEAD + s['es_off'], 1.0, s['d']))
        cues.append((s['ceo'], t + LEAD + s['ko_off'], KO_VOL, s['d'] - LEAD - s['ko_off']))
        if not s.get('endcard'): subs.append((SUBS.get(s.get('key') or s['pause'].split()[0], [s['sub']]), t + LEAD + s['es_off'], os.path.basename(s['es']) if DUB else s['ceo_d']))
    run(cmd); parts.append(out)
    if s['t'] == 'play':   # 레퍼런스가 재생되는 구간은 원본 소리(음악·효과음)를 그대로
        cues.append((SRC, t, SRC_VOL, dur(out), s['a']))
    t += dur(out)
open('list.txt', 'w').write(''.join(f"file '{p}'\n" for p in parts))
run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'video_nosub.mp4'])

# 3b) 스페인어 자막: 스크립트 글자 위치를 음성 단어 시간에 대응시켜 조각 경계를 잡음
def char_time(words, frac):
    tot = sum(len(w[2]) for w in words); acc = 0
    for st, en, w in words:
        n = len(w)
        if acc + n >= frac * tot: return st + (en - st) * max(0, frac * tot - acc) / max(n, 1)
        acc += n
    return words[-1][1]
chunks = []
for parts, st, wav in subs:
    if not DUB:   # ko: 길이 비례
        tot = sum(len(x) for x in parts); c = st
        for x in parts: dd = wav * len(x) / tot; chunks.append((x, c, c + dd)); c += dd
        continue
    w = WORDS[wav]; tot = sum(len(x) for x in parts); acc = 0; prev = w[0][0]
    for k, x in enumerate(parts):
        acc += len(x)
        end = w[-1][1] if k == len(parts) - 1 else char_time(w, acc / tot)
        chunks.append((x, st + prev, st + end + (0.15 if k == len(parts) - 1 else 0))); prev = end
json.dump([c[0] for c in chunks], open('subs.json', 'w'), ensure_ascii=False)
run(['node', 'render_subs.mjs'])
ins = ['-i', 'video_nosub.mp4']; fl = []; prev = '0:v'
for k, (x, a, e) in enumerate(chunks):
    ins += ['-i', f'sub_{k:02d}.png']; fl.append(f"[{prev}][{k+1}:v]overlay=0:0:enable='between(t,{a:.2f},{e:.2f})'[s{k}]"); prev = f's{k}'
run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', ';'.join(fl), '-map', f'[{prev}]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', 'video_only.mp4'])

# 4) 오디오: 스페인어(대표 v2) + 한국어 원음 작게
ins = []; fl = []
for k, (f, st, vol, ln, *ss) in enumerate(cues):
    ins += (['-ss', str(ss[0])] if ss else []) + ['-i', f]; ms = int(st * 1000)
    fi = 'afade=t=in:d=0.05,' if ss else ''
    fl.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=mono,atrim=0:{ln:.2f},{fi}afade=t=out:st={max(0, ln - (0.12 if ss else 0.3)):.2f}:d={0.12 if ss else 0.3},volume={vol},adelay={ms}[a{k}]')
fl.append(''.join(f'[a{k}]' for k in range(len(cues))) + f'amix=inputs={len(cues)}:normalize=0,apad,atrim=0:{t:.2f},loudnorm=I=-16:TP=-1.5[a]')
run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', ';'.join(fl), '-map', '[a]', '-ac', '2', f'voice_{MODE}.wav'])
run(['ffmpeg', '-v', 'error', '-y', '-i', 'video_only.mp4', '-i', f'voice_{MODE}.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', f"b2x_kbeauty_que_vende_{plan['meta']['no']}_{MODE}.mp4"])
print('total', round(t, 2), {k: round(sum(y - x for x, y in v), 2) for k, v in cutlist.items()})
