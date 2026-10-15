import json,subprocess
plan=json.load(open('plan.json'))
# 영상 세로 위치(px): 0=원본 그대로, 음수=위로, 양수=아래로. 헤더(0~575)에 가릴 부분과 하단 UI(약 1650~)를 보고 영상마다 정한다
VY=int(plan.get('video_y',0))
SRC='src_7482942231217704238.mp4'; VOICE='es-MX-DaliaNeural'; RATE='+12%'  # 임시 스페인어 AI 음성. 정식본은 대표 영상의 스페인어 립싱크 더빙으로 교체
dur=lambda f: float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
# 1) voice lines -> freeze durations
import os
TRIM='silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse'
for i,s in enumerate(plan['segs']):
    if s.get('voice'):
        raw=f'vo_{i:02d}.mp3'; wav=f'vo_{i:02d}.wav'; txt=f'vo_{i:02d}.txt'
        cached=os.path.exists(wav) and os.path.exists(txt) and open(txt).read()==VOICE+RATE+s['voice']
        if not cached:  # 문장이 바뀐 구간만 다시 합성
            subprocess.run(['python3','tts.py',VOICE,s['voice'],raw,RATE],check=True)
            subprocess.run(['ffmpeg','-v','error','-y','-i',raw,'-af',TRIM,wav],check=True)
            open(txt,'w').write(VOICE+RATE+s['voice'])
        s['vo']=wav; s['d']=round(max(2.6,dur(wav)+0.45),2)
json.dump(plan,open('plan.json','w'),ensure_ascii=False,indent=1)
# 2) overlays
subprocess.run(['node','render2.mjs'],check=True)
# 3) video segments
enc=['-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-preset','medium','-r','30','-an']
parts=[];t=0;cues=[];subs=[]
for i,s in enumerate(plan['segs']):
    ov=f'ov_{i:02d}.png'; out=f'seg_{i:02d}.mp4'
    if s['t']=='play':
        cmd=['ffmpeg','-v','error','-y','-ss',str(s['a']),'-to',str(s['b']),'-i',SRC,'-i',ov,'-filter_complex','[0:v]fps=30,scale=1080:1920,setsar=1,split[x][y];[x]boxblur=30:3,eq=brightness=-0.3[bg];[bg][y]overlay=0:'+str(VY)+'[v];[v][1:v]overlay=0:0[o]','-map','[o]']+enc+[out]
    else:
        cmd=['ffmpeg','-v','error','-y','-ss',str(s['at']),'-i',SRC,'-i',ov,'-filter_complex',f"[0:v]trim=end_frame=1,scale=1080:1920,setsar=1,split[x][y];[x]boxblur=30:3,eq=brightness=-0.3[bg];[bg][y]overlay=0:{VY},loop=loop=-1:size=1,fps=30,trim=duration={s['d']}[v];[v][1:v]overlay=0:0[o]",'-map','[o]','-t',str(s['d'])]+enc+[out]
        if s.get('endcard'):  # 엔드카드: 댓글 버튼 쪽을 가리키는 손 일러스트가 좌우로 톡톡 움직임
            cmd=cmd[:cmd.index('-filter_complex')]+['-i','hand.png','-filter_complex',cmd[cmd.index('-filter_complex')+1].replace('[o]','[o0]')+";[o0][2:v]overlay=x='720+34*abs(sin(PI*1.5*t))':y=1420:eval=frame[o]",'-map','[o]','-t',str(s['d'])]+enc+[out]
    subprocess.run(cmd,check=True); parts.append(out)
    if s.get('vo'):
        cues.append((s['vo'],t+0.15))
        if not s.get('endcard'): subs.append((s['sub'],t+0.15,dur(s['vo'])))
    t+=dur(out)
open('list.txt','w').write(''.join(f"file '{p}'\n" for p in parts))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','list.txt','-c','copy','video_nosub.mp4'],check=True)
# 3b) Spanish subtitles of the narration, chunked by '|' and timed by length
chunks=[]
for text,st,d in subs:
    parts_=[x.strip() for x in text.split('|')]; tot=sum(len(x) for x in parts_); c=st
    for x in parts_:
        dd=d*len(x)/tot; chunks.append((x,c,c+dd)); c+=dd
json.dump([c[0] for c in chunks],open('subs.json','w'),ensure_ascii=False)
subprocess.run(['node','render_subs.mjs'],check=True)
ins=['-i','video_nosub.mp4'];fl=[];prev='0:v'
for k,(x,a,e) in enumerate(chunks):
    ins+=['-i',f'sub_{k:02d}.png']; fl.append(f"[{prev}][{k+1}:v]overlay=0:0:enable='between(t,{a:.2f},{e:.2f})'[s{k}]"); prev=f's{k}'
subprocess.run(['ffmpeg','-v','error','-y']+ins+['-filter_complex',';'.join(fl),'-map',f'[{prev}]','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-preset','medium','video_only.mp4'],check=True)
# 4) voice track
ins=[];fl=[]
for k,(f,st) in enumerate(cues):
    ins+=['-i',f]; ms=int(st*1000); fl.append(f'[{k}:a]aresample=48000,adelay={ms}|{ms}[a{k}]')
fl.append(''.join(f'[a{k}]' for k in range(len(cues)))+f'amix=inputs={len(cues)}:normalize=0,apad,atrim=0:{t:.2f},loudnorm=I=-16:TP=-1.5[a]')
subprocess.run(['ffmpeg','-v','error','-y']+ins+['-filter_complex',';'.join(fl),'-map','[a]','-ac','2','voice.wav'],check=True)
subprocess.run(['ffmpeg','-v','error','-y','-i','video_only.mp4','-i','voice.wav','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','b2x_kbeauty_que_vende_001_es_dub.mp4'],check=True)
# 5) 대표 영상 삽입 큐시트: 최종 영상 기준 정지 구간 = 원형 PiP 자리
cue=[];tt=0
for i,s in enumerate(plan['segs']):
    d_=dur(f'seg_{i:02d}.mp4')
    if s.get('pip'): cue.append({'seg':i,'pause':s['pause'],'start':round(tt,2),'end':round(tt+d_,2),'say_es':s['voice'],'say_en':s.get('voice_en',''),'sub_es':s['sub'].replace(' | ',' '),'say_ko':s.get('ko','')})
    tt+=d_
json.dump(cue,open('ceo_cues.json','w'),ensure_ascii=False,indent=1)
print('total',round(t,2))
