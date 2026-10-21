import json,subprocess,sys,os
S,OUT=sys.argv[1],sys.argv[2]
LB=json.loads(subprocess.check_output(['node','-e',f"global.window=global;eval(require('fs').readFileSync('{S}/site/lecture_b.js','utf8'));console.log(JSON.stringify(LECTURE_B))"]))
E=json.loads(subprocess.check_output(['node','-e',f"global.window=global;const fs=require('fs');for(const f of ['data','data_ws'])eval(fs.readFileSync('{S}/site/'+f+'.js','utf8'));console.log(JSON.stringify(EPISODES.map(e=>[e.no,e.point])))"]))
def split(t):
    o='';q=False;i=0
    while i<len(t):
        c=t[i]
        if c in "'\"": q=not q
        o+=c
        if not q and c in '.!?🎁' and i+1<len(t) and t[i+1]==' ': o+='\n'; i+=1
        i+=1
    return o
def lab(l,k):
    if k==0: return 'HOOK'
    if l.startswith('CTA'): return 'CTA'
    if 'TU TIP' in l: return '팁'
    if 'ASÍ SE VENDE' in l: return '판매'
    return l[:2]
eps=[]
for no,title in E:
    d=LB[no]; talk=sum(max(2.6,len(r[3])/14.2+0.45) for r in d['rows']); play=sum(b-a for a,b in d['clips'])
    s='━━━━━━━━━━━━━━━━━━━━\n'+no+'  '+title+f'  (약 {round(talk+play)}초)\n━━━━━━━━━━━━━━━━━━━━\n\n'
    s+='\n\n'.join('['+lab(r[1],k)+']\n'+split(r[4]) for k,r in enumerate(d['rows']))
    eps.append(s)
hdr='K-Beauty que vende · 대표 촬영 대본 B안 (짧은 버전)\n편 시작 전 번호 한마디 · 한 줄씩 끊어 읽기 · 문장 앞뒤 1초 여유\nCTA 끝은 꼭 "댓글에 아무 이모티콘이나 남겨주세요!"\n\n'
open(f'{OUT}/대본_프롬프터용_B.txt','w').write(hdr+'\n\n\n'.join(eps)+'\n')
for i,(a,b) in enumerate([(0,13),(13,26)],1):
    t=f"K-Beauty que vende · 대표 촬영 대본 B안 ({i}/2) {E[a][0]}–{E[b-1][0]}\n\n"+'\n\n\n'.join(eps[a:b])+'\n'
    open(f'{OUT}/카톡_B_{i}of2_{E[a][0]}-{E[b-1][0]}.txt','w').write(t)
