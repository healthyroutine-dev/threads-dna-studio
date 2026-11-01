# 랙 점검: 대표 원이 멈춰 보이는 구간(말하는 중) · 화면 전체 끊김 · 영상/음성 길이 차이
# usage: check_lag.py NNN [es|ko]
import json, re, subprocess, sys
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
n = sys.argv[1]; mode = sys.argv[2] if len(sys.argv) > 2 else 'es'; D = f'{S}/ep/{n}'
v = f'{D}/b2x_kbeauty_que_vende_{n}_{mode}.mp4'
import os; p = json.load(open(f'{D}/plan_{mode}.json' if os.path.exists(f'{D}/plan_{mode}.json') else f'{D}/plan.json'))
dur = lambda f, s='format': float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', f'{s}=duration', '-of', 'csv=p=0'] + (['-select_streams', 'v:0'] if s == 'stream' else []) + [f], capture_output=True, text=True).stdout.split()[0])
def freezes(vf, d=0.3):
    o = subprocess.run(['ffmpeg', '-v', 'info', '-i', v, '-vf', f'{vf}freezedetect=n=0.0003:d={d}', '-an', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'freeze_start: ([0-9.]+)', o)]; en = [float(x) for x in re.findall(r'freeze_end: ([0-9.]+)', o)]
    return list(zip(st, en + [9e9] * (len(st) - len(en))))
# 멈춤 구간(대표 원 보이는 곳) 시간표
t = 0; pauses = []
for s in p['segs']:
    d = s['d'] if s['t'] != 'play' else s['b'] - s['a']
    if s['t'] != 'play': pauses.append((t, t + d, s.get('endcard'), s.get('pause', 'CTA')))
    t += d
bad = []
for a, b, ec, name in pauses:
    if ec: continue   # v7: 엔딩 카드엔 대표 원 없음 (배경 정지가 정상)
    x, y = 70, 1140   # v7 원 (60,1130, 지름 400) 안쪽
    for fs, fe in freezes(f'trim={a}:{b},setpts=PTS-STARTPTS,crop=380:380:{x}:{y},', 0.35):
        fe = min(fe, b - a)
        if fe < b - a - 0.05: bad.append(f'{name.strip()}: 원 멈춤 {a + fs:.2f}~{a + fe:.2f}s ({fe - fs:.2f}s)')
whole = [f'화면 전체 멈춤 {fs:.2f}~{fe:.2f}s' for fs, fe in freezes('', 0.6) if not any(a - 0.1 <= fs <= b for a, b, _, _ in pauses)]   # 멈춤 화면은 배경이 원래 정지 → 재생 구간만
vd, ad = dur(v, 'stream'), float(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', v], capture_output=True, text=True).stdout.split()[0])
print(f'{n} {mode}: 길이 영상 {vd:.2f}s / 음성 {ad:.2f}s (차이 {abs(vd - ad):.2f}s) · 멈춤구간 {len(pauses)}개')
for x in bad + whole: print('  ⚠', x)
if not bad and not whole and abs(vd - ad) < 0.2: print('  OK 랙 없음')
