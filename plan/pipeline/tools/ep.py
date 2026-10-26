# K-Beauty que vende · 편 준비 스크립트 (plan/EDIT_RULES.md)
# ep.py prep NNN FILE   : 받아쓰기 · 음성 정리 · 무음 · 대본 줄 매칭(SECT) → ep/NNN/report.txt
# ep.py plan NNN        : ep/NNN/override.json(제목·수정 문장) 반영해 plan.json + subs_plan.json
# ep.py tts NNN         : 대표 v2 스페인어 (속도 1회 추정) + 단어 시간
import sys, os, json, re, subprocess, difflib, shutil
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
T = S + '/tools'
run = lambda c, **k: subprocess.run(c, check=True, **k)
dur = lambda f: float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)

def js(expr, files):
    code = "global.window=global;const fs=require('fs');for(const f of " + json.dumps(files) + ")eval(fs.readFileSync(f,'utf8'));console.log(JSON.stringify(" + expr + "))"
    return json.loads(subprocess.check_output(['node', '-e', code]))

def data(no):
    E = {e['no']: e for e in js('EPISODES', [S + '/site/data.js', S + '/site/data_ws.js'])}[no]
    LB = js('LECTURE_B', [S + '/site/lecture_b.js'])[no]
    SH = {s['no']: s for s in js('SHOOT', [S + '/shoot/shoot.js'])}[no]
    return E, LB, SH

def key_of(lab, k):
    if k == 0: return 'HOOK'
    if lab.startswith('CTA'): return 'CTA'
    return lab[:2]

def norm(t): return re.sub(r"[\s'\".,!?…~·:()]", '', t)

def sentences(segs):
    out = []
    for s in segs:
        w = s.get('w') or []; cur = []
        for k, x in enumerate(w):
            cur.append(x)
            if x[2].strip().endswith(('.', '?', '!')) and k < len(w) - 1:
                out.append({'s': cur[0][0], 'e': cur[-1][1], 't': ''.join(y[2] for y in cur).strip(), 'w': cur}); cur = []
        if cur: out.append({'s': cur[0][0] if out and out[-1]['w'] is not w else s['s'], 'e': s['e'], 't': ''.join(y[2] for y in cur).strip(), 'w': cur})
        if not w: out.append(s)
    return out

def prep(no, fn):
    D = f'{S}/ep/{no}'; os.makedirs(D, exist_ok=True); R = S + '/ceo_raw'
    src = f'{R}/{fn}.mp4'
    if not os.path.exists(f'{D}/ko.json'):
        run(['python3', T + '/tr_ko.py', src, f'{D}/ko.json', 'small'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not os.path.exists(f'{D}/clean.wav'):
        run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vn', '-af', f'highpass=f=80,arnndn=m={S}/models/sh.rnnn:mix=0.9,afftdn=nr=8:nf=-60:tn=1,lowpass=f=14000,deesser=i=0.3,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=120:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', '48000', '-ac', '1', f'{D}/clean.wav'])
        out = subprocess.run(['ffmpeg', '-hide_banner', '-i', f'{D}/clean.wav', '-af', 'silencedetect=n=-42dB:d=0.22', '-f', 'null', '-'], capture_output=True, text=True).stderr
        v = re.findall(r'silence_(?:start|end): ([0-9.]+)', out)
        open(f'{D}/sil.txt', 'w').write(''.join(f'{v[i]} {v[i+1]}\n' for i in range(0, len(v) - 1, 2)))
    E, LB, SH = data(no)
    rows = LB['rows']; segs = json.load(open(f'{D}/ko.json')); total = dur(src)
    segs = sentences(segs)   # 한 조각에 문장 두 개가 묶이면 단어 시간으로 문장마다 쪼갬 (경계가 밀리지 않게)
    # 단조 DP: 받아쓰기 조각 n개를 대본 줄 m개에 순서대로 배정 (유사도 합 최대)
    n, m = len(segs), len(rows)
    sim = lambda i, j, r: difflib.SequenceMatcher(None, norm(''.join(s['t'] for s in segs[i:j])), norm(rows[r][4])).ratio()
    best = {(0, 0): (0, None)}
    for r in range(m):
        for j in range(1, n + 1):
            cands = [(best[(i, r)][0] + sim(i, j, r), i) for i in range(j) if (i, r) in best]
            if cands: best[(j, r + 1)] = max(cands)
    cuts = []; j = n
    for r in range(m, 0, -1):
        i = best[(j, r)][1]; cuts.append((i, j)); j = i
    cuts = cuts[::-1]
    sect = {}; rep = [f'{no} · 촬영본 {fn} · {E["point"]}']
    for r, (i, j) in enumerate(cuts):
        key = key_of(rows[r][1], r)
        a = 0.0 if r == 0 else round((segs[i - 1]['e'] + segs[i]['s']) / 2, 2)
        b = round(total, 2) if r == m - 1 else round((segs[j - 1]['e'] + segs[j]['s']) / 2, 2)
        sect[key] = [a, b]
        said = ' '.join(s['t'] for s in segs[i:j]); sc = sim(i, j, r)
        rep.append(f"[{key}] {a:.2f}-{b:.2f} 일치 {sc:.2f}{'  ⚠ 확인' if sc < 0.8 else ''}\n  대본: {rows[r][4]}\n  촬영: {said}")
    json.dump({'sect': sect, 'total': total, 'file': fn}, open(f'{D}/sect.json', 'w'), ensure_ascii=False, indent=1)
    open(f'{D}/report.txt', 'w').write('\n'.join(rep) + '\n'); print('\n'.join(rep))

def es_views(v):   # '190만' -> '1,9 M', '9.47만' -> '94.700'
    n = float(v.replace(',', '').replace('만', '')) * (10000 if '만' in v else 1)
    if n >= 1e6: return f'{n/1e6:.1f}'.replace('.', ',').replace(',0', '') + ' M'
    if n >= 1e4: return f'{n/1e3:.0f} mil'   # K 대신 mil (제목 표기와 통일)
    return f'{int(n):,}'.replace(',', '.')

CW = json.load(open(T + '/charw.json'))
def width(s): return sum(CW.get(c, 30) for c in s)
SPLIT_BEFORE = ('y', 'que', 'para', 'con', 'en', 'de', 'por', 'pero', 'si', 'porque', 'cuando', 'así', 'sin', 'solo', 'hasta', 'como', 'a')
NO_END = {'de', 'que', 'en', 'a', 'con', 'para', 'por', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'tu', 'tus', 'su', 'sus', 'mi', 'lo', 'al', 'del', 'se', 'te', 'no', 'muy', 'más'}
def split_subs(text, limit=880):
    # 문장 단위 → 쉼표 → 접속사/전치사 앞 (따옴표 안·전치사로 끝나는 곳 금지). "Uno:" 같은 서수는 뒤에 붙임
    parts = [p.strip() for p in re.split(r'(?<=[.?!])\s+|(?<=[^A-Za-zÁÉÍÓÚáéíóúñ]{0}:)\s+(?=\S)', text) if p.strip()]
    merged = []
    for p in parts:
        if merged and re.fullmatch(r"(Uno|Dos|Tres|Cuatro|Cinco|Seis):", merged[-1]): merged[-1] += ' ' + p
        else: merged.append(p)
    out = []
    def inquote(p, c): return p[:c].count("'") % 2 == 1 or p[:c].count('«') > p[:c].count('»')
    def ok(p, c):
        if not (8 < c < len(p) - 8) or inquote(p, c): return False
        left = p[:c].split()
        return bool(left) and left[-1].lower().strip(',') not in NO_END
    def fit(p):
        if width(p) <= limit: out.append(p); return
        cand = [m.start() + 1 for m in re.finditer(', ', p) if ok(p, m.start() + 1)]
        if not cand: cand = [m.start() for m in re.finditer(r" (?:%s) " % '|'.join(SPLIT_BEFORE), p) if ok(p, m.start())]
        if not cand: cand = [m.start() for m in re.finditer(r" [«']", p) if ok(p, m.start())]
        if not cand: cand = [m.start() for m in re.finditer(' ', p) if ok(p, m.start())]
        if not cand: cand = [m.start() for m in re.finditer(' ', p) if 3 < m.start() < len(p) - 3 and p[:m.start()].split()[-1].lower() not in NO_END]
        if not cand: out.append(p); return
        c = min(cand, key=lambda x: abs(width(p[:x]) - width(p) / 2))
        fit(p[:c].strip()); fit(p[c:].strip())
    for p in merged: fit(p)
    # 너무 짧은 조각(서수+한 단어 등)은 이웃과 합침 (한 줄에 들어가면)
    i = 0
    while i < len(out):
        if width(out[i]) < 380 and not out[i].endswith(('.', '?', '!', ',', ':', "'")) and i + 1 < len(out) and width(out[i] + ' ' + out[i + 1]) <= limit:
            out[i:i + 2] = [out[i] + ' ' + out[i + 1]]; continue
        if width(out[i]) < 330 and i > 0 and not out[i - 1].endswith(('.', '?', '!')) and width(out[i - 1] + ' ' + out[i]) <= limit:
            out[i - 1:i + 1] = [out[i - 1] + ' ' + out[i]]; i -= 1; continue
        i += 1
    return out

def plan(no):
    D = f'{S}/ep/{no}'; E, LB, SH = data(no); sc = json.load(open(f'{D}/sect.json'))
    ov = json.load(open(f'{D}/override.json')) if os.path.exists(f'{D}/override.json') else {}
    ko_said = {}
    rows = LB['rows']; dur_src = E['dur']; clips = LB['clips'] if dur_src > 15 else None
    shutil.copy(f'{S}/site/v/{E["id"]}.mp4', f'{D}/src.mp4')
    for f in os.listdir(S + '/eptpl'): shutil.copy(f'{S}/eptpl/{f}', D)
    segs = []; prev = 0.0; lit = []; h1 = ''
    for k, r in enumerate(rows):
        t, lab, _, es, ko = r; key = key_of(lab, k)
        at = min(t, dur_src - 0.08)
        # 재생 구간: 15초 이하 원본은 이어서, 넘으면 clips(멈춤 앞 2.5초)만
        wins = [[a, b] for a, b in (clips or [[prev, at]]) if b > prev + 0.01 and b <= at + 0.01] if at > prev + 0.01 else []
        for a, b in wins:
            segs.append(dict(t='play', a=round(a, 2), b=round(min(b, at), 2), lit=list(lit), h1=h1, h2='', now=0, pause=None, pip=False))
        if key in ov.get('drop', []): prev = at; continue   # 촬영에서 통째로 건너뛴 포인트는 멈춤 없이
        if key not in ('HOOK', 'CTA'):
            lit.append(len(lit) + 1); h1 = ov.get('labels', {}).get(key) or (lab.split(' · ', 1)[0] + ' · ' + lab.split(' · ', 1)[1].capitalize())
        es = ov.get('es', {}).get(key, es)
        sh_line = SH['lines'][k] if k < len(SH['lines']) else []
        s = dict(t='freeze', at=round(at, 2), lit=list(lit) if key != 'CTA' else [1, 2, 3, 4, 5], h1=h1 if key not in ('HOOK', 'CTA') else '', h2='',
                 now=(lit[-1] if key not in ('HOOK', 'CTA') else 0), pause=key, pip=True, sub=es, voice=es.replace(' 🎁 ', '. ').replace('🎁', '').replace('..', '.'), ko=ko)
        if len(sh_line) > 3 and sh_line[3]: s['quote'] = sh_line[3]
        if key == 'CTA': s.update(endcard=True, items=ov.get('items', SH['items']), lit=[1, 2, 3, 4, 5], h1='', h2='', now=0)
        segs.append(s); prev = at
    st = E['stats']; ws = E.get('src') == '우식PD'
    meta = dict(no=no, views=es_views(st['views']), mult=st['mult'].replace(',', '.'), dur=f"{E['dur']} S", multk='vs promedio' if E['stats'].get('multLabel', '팔로워 대비') == '평소 대비' else 'vs seguidores')
    sect = {**sc['sect'], **ov.get('sect', {})}   # 경계 손보기
    for k in ov.get('drop', []): sect.pop(k, None)   # 건너뛴 포인트는 구간도 뺌
    p = dict(src='src.mp4', video_y=ov.get('video_y', 70), handle=f"@{E['handle']} · TikTok", meta=meta, segs=segs, sect=sect, cut=ov.get('cut', []), sub_bottom=ov.get('sub_bottom', 495), crop=ov.get('crop', [900, 30, 60]),
             title_es=ov['title_es'], title_ko=ov['title_ko'])
    json.dump(p, open(f'{D}/plan_base.json', 'w'), ensure_ascii=False, indent=1); shutil.copy(f'{D}/plan_base.json', f'{D}/plan.json')
    subs = {s['pause']: split_subs(s['sub']) for s in segs if s['t'] == 'freeze' and not s.get('endcard')}
    subs.update(ov.get('subs', {}))   # 손으로 고친 자막 조각
    json.dump(subs, open(f'{D}/subs_plan.json', 'w'), ensure_ascii=False, indent=1)
    for k, v in subs.items(): print(k, ' | '.join(v))
    print('title', ov['title_es'], '=', ov['title_ko'], [round(width(x.upper()) * 86 / 54) for x in ov['title_es']])
    assert all(round(width(x.upper()) * 86 / 54) <= 880 for x in ov['title_es']), '제목 한 줄 폭 880 초과 (영상에서 두 줄로 넘어감)'

def tts(no):
    D = f'{S}/ep/{no}'; p = json.load(open(f'{D}/plan_base.json')); sc = json.load(open(f'{D}/sect.json'))
    # 한국어 구간 길이(무음 정리 후) 추정 → 스페인어 속도 (글자/14.5초 기준, 0.85~1.12)
    sil = sorted([tuple(map(float, l.split())) for l in open(f'{D}/sil.txt') if l.strip()] + [tuple(c) for c in p.get('cut', [])])
    def kd(a, b):
        cur = a; out = []
        for s_, e_ in sil:
            if e_ <= a or s_ >= b: continue
            if s_ > cur: out.append([cur, s_])
            cur = max(cur, e_)
        if cur < b: out.append([cur, b])
        return sum(min(b, y + 0.22) - max(a, x - 0.12) for x, y in out if y - x > 0.12)
    speed = {}
    for s in p['segs']:
        if s['t'] != 'freeze': continue
        k = s['pause']; ko_d = kd(*p['sect'][k]); es_est = len(s['voice']) / 14.5
        speed[k] = round(min(1.12, max(0.85, es_est / (ko_d / 1.1))), 2)
    os.makedirs(f'{D}/dub', exist_ok=True); json.dump(speed, open(f'{D}/dub/speed.json', 'w'))
    run(['python3', T + '/el_tts.py', f'{D}/plan_base.json', f'{D}/dub', f'{D}/dub/speed.json'])
    code = f'''
import glob,json,subprocess,numpy as np
from faster_whisper import WhisperModel
m=WhisperModel('small',device='cpu',compute_type='int8'); out={{}}
for f in sorted(glob.glob('{D}/dub/es_*.wav')):
  a=np.frombuffer(subprocess.run(['ffmpeg','-v','quiet','-i',f,'-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout,np.int16).astype(np.float32)/32768
  s,i=m.transcribe(a,language='es',beam_size=5,word_timestamps=True); s=list(s)
  out[f.split('/')[-1]]=[[round(w.start,2),round(w.end,2),w.word.strip()] for x in s for w in x.words]
  print('STT', f.split('/')[-1],'|',' '.join(x.text.strip() for x in s))
json.dump(out,open('{D}/dub/es_words.json','w'),ensure_ascii=False,indent=1)'''
    run(['python3', '-I', '-c', code])

if __name__ == '__main__':
    cmd, no = sys.argv[1], sys.argv[2]
    {'prep': lambda: prep(no, sys.argv[3]), 'plan': lambda: plan(no), 'tts': lambda: tts(no)}[cmd]()
