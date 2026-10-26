# 소리 나는 구간마다 대표 입 움직임 확인 → 입이 거의 안 움직이면 '다른 사람 목소리' 후보
import json, sys, numpy as np, subprocess
S = '/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad'
def regions(no):
    D = f'{S}/ep/{no}'; sil = [tuple(map(float, l.split())) for l in open(f'{D}/sil.txt') if l.strip()]
    T = float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f'{D}/clean.wav'],capture_output=True,text=True).stdout)
    out=[]; cur=0
    for a,b in sil:
        if a>cur+0.15: out.append((cur,a))
        cur=max(cur,b)
    if T>cur+0.15: out.append((cur,T))
    return out
for n in (sys.argv[1:] or [f'{i:03d}' for i in range(2,27)]):
    m=json.load(open(f'{S}/ep/{n}/mouth.json')); t=np.array([x[0] for x in m]); v=np.array([x[1] if x[1] is not None else np.nan for x in m])
    ko=json.load(open(f'{S}/ep/{n}/ko.json'))
    for a,b in regions(n):
        sel=(t>=a)&(t<=b); seg=v[sel]
        if seg.size==0: continue
        sd=np.nanstd(seg); mx=np.nanpercentile(seg,90) if np.isfinite(seg).any() else 0
        txt=' '.join(s['t'] for s in ko if s['s']<b and s['e']>a)[:40]
        if sd<0.010 or mx<0.03: print(n, f'{a:6.2f}-{b:6.2f}', f'sd={sd:.3f} p90={mx:.3f}', txt)
