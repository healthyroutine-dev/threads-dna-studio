# 001 릴스 · 스페인어 더빙 완성본 (A안: 대표 v2 스페인어 음성 + 한국어 원음 작게)
# 정지 구간 길이 = 스페인어 음성 길이. 원형 = 대표 촬영본(보정). 자막 = 스페인어 음성 단어 시간에 맞춤
# usage: python3 build_dub.py <ceo_video_1080x1920.mp4> <clean.wav> <silences.txt> <dub_dir>
import json, subprocess, sys
CEO_V, CEO_A, SIL = sys.argv[1], sys.argv[2], sys.argv[3]
plan = json.load(open('plan.json'))
SUBS = json.load(open('subs_plan.json'))
# 헤드카피는 처음 후킹 제목으로 끝까지 고정, 포인트 이름은 멈춤 배지로 ("01 · SIN FILTRO")
H1, H2 = plan['segs'][0]['h1'], plan['segs'][0]['h2']
for s in plan['segs']:
    if s.get('endcard'): continue
    if s.get('pause') and s['pause'] not in ('HOOK',) and s.get('h1'):
        s['pause'] = (s['h1'] + ' ' + s['h2']).upper().replace('/ ', '/ ')
    s['h1'], s['h2'] = H1, H2   # 자막 조각: 의미·호흡 단위, 한 줄(폭 900px 이하)
VY = int(plan.get('video_y', 0)); SRC = 'src_7482942231217704238.mp4'
run = lambda c: subprocess.run(c, check=True)
dur = lambda f: float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)

# 대표 촬영본에서 각 멈춤 구간에 해당하는 원본 시간 (받아쓰기 기준)
SECT = {'HOOK': (0.0, 5.3), '01': (5.3, 13.5), '02': (13.5, 23.75), '03': (23.75, 32.45), '04': (32.45, 40.0), '05': (40.0, 49.5), 'CTA': (49.5, 57.0)}
LEAD, TAIL = 0.12, 0.25          # 정지 화면에서 말 시작 전/후 여유
CROP = (900, 90, 520)            # 원형에 들어갈 얼굴 정사각 크롭 (크기, x, y) @1080x1920
sil = [tuple(map(float, l.split())) for l in open(SIL) if l.strip()]
DUB = sys.argv[4]
KO_VOL = 0.13                     # 한국어 원음 (약 -18dB)
WORDS = json.load(open(f'{DUB}/es_words.json'))
import glob, os
ES = {os.path.basename(f).split('_', 2)[2][:-4]: f for f in glob.glob(f'{DUB}/es_*.wav')}   # key -> wav

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
    s['ceo'] = f'ceo_{i:02d}.mov'; s['ceo_d'] = round(dur(f'ceo_{i:02d}.mov'), 2)
    s['es'] = ES[key]; s['es_d'] = round(dur(ES[key]), 2); s['d'] = round(max(s['es_d'], s['ceo_d']) + LEAD + TAIL + 0.1, 2)   # 한국어 원음·영상이 잘리지 않게 긴 쪽 기준
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
            ins += ['-i', 'hand.png']; fc += ";[o2][4:v]overlay=x='720+34*abs(sin(PI*1.5*t))':y=1420:eval=frame[o3]"; last = 'o3'
        cmd = ['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', fc, '-map', f'[{last}]', '-t', str(s['d'])] + enc + [out]
        cues.append((s['es'], t + LEAD, 1.0, s['d'])); cues.append((s['ceo'], t + LEAD, KO_VOL, s['d'] - LEAD))
        if not s.get('endcard'): subs.append((SUBS.get(s['pause'].split()[0], [s['sub']]), t + LEAD, os.path.basename(s['es'])))
    run(cmd); parts.append(out); t += dur(out)
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
for k, (f, st, vol, ln) in enumerate(cues):
    ins += ['-i', f]; ms = int(st * 1000)
    fl.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=mono,atrim=0:{ln:.2f},afade=t=out:st={max(0, ln - 0.3):.2f}:d=0.3,volume={vol},adelay={ms}[a{k}]')
fl.append(''.join(f'[a{k}]' for k in range(len(cues))) + f'amix=inputs={len(cues)}:normalize=0,apad,atrim=0:{t:.2f},loudnorm=I=-16:TP=-1.5[a]')
run(['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', ';'.join(fl), '-map', '[a]', '-ac', '2', 'voice_es.wav'])
run(['ffmpeg', '-v', 'error', '-y', '-i', 'video_only.mp4', '-i', 'voice_es.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'b2x_kbeauty_que_vende_001_es_dub_ceo.mp4'])
print('total', round(t, 2), {k: round(sum(y - x for x, y in v), 2) for k, v in cutlist.items()})
