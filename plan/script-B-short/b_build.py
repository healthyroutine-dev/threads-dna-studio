import json,re,subprocess,sys
S=sys.argv[1]; sys.path.insert(0,S+'/tools'); from b_eps import B
js=lambda f: json.loads(subprocess.check_output(['node','-e',f"global.window=global;const fs=require('fs');for(const f of ['data','lecture','data_ws','lecture_ws'])eval(fs.readFileSync('{S}/site/'+f+'.js','utf8'));console.log(JSON.stringify({f}))"]))
L=js('LECTURE'); E={e['no']:e for e in js('EPISODES')}
KO=['첫째','둘째','셋째','넷째','다섯째','여섯째']; ES=['Uno','Dos','Tres','Cuatro','Cinco','Seis']
out={}; rep=[]
for no,(keep,ov) in B.items():
    A=L[no]; rows=[]; p=0
    for i in keep:
        t,lab,en,es,ko=A[i]
        if i in ov: ko,es=ov[i]
        if re.match(r'^0\d · ',lab) and 'TU TIP' not in lab and 'ASÍ SE VENDE' not in lab:
            ko=re.sub(r'^('+'|'.join(KO)+r'),',KO[p]+',',ko); es=re.sub(r'^('+'|'.join(ES)+r'):',ES[p]+':',es)
            lab=f"0{p+1} · "+lab.split(' · ',1)[1]; p+=1
        elif 'TU TIP' in lab or 'ASÍ SE VENDE' in lab:
            lab=f"0{p+1} · "+lab.split(' · ',1)[1]; p+=1
        rows.append([t,lab,"",es,ko])
    dur=E[no]['dur']; short=dur<=15; clips=[]; prev=0
    for r in rows:
        a=prev if short else max(prev,r[0]-2.5)
        if r[0]>a: clips.append([round(a,2),r[0]])
        prev=r[0]
    play=sum(b-a for a,b in clips); talk=sum(max(2.6,len(r[3])/14.2+0.45) for r in rows)
    out[no]={"rows":rows,"clips":clips}
    rep.append((no,dur,len(rows),round(play,1),round(talk),round(play+talk)))
open(S+'/site/lecture_b.js','w').write("// B안 · 짧은 버전: rows = [정지(초), 라벨, EN, ES, KO], clips = 재생할 원본 구간\nwindow.LECTURE_B = "+json.dumps(out,ensure_ascii=False,indent=1)+";\n")
for r in rep: print(*r,sep='\t')
