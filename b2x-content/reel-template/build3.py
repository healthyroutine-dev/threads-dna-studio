import json,subprocess
plan=json.load(open('plan.json'))
SRC='src_7482942231217704238.mp4'; VOICE='ko-KR-SunHiNeural'; RATE='+15%'
dur=lambda f: float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
# 1) voice lines -> freeze durations
for i,s in enumerate(plan['segs']):
    if s.get('voice'):
        f=f'vo_{i:02d}.mp3'
        subprocess.run(['python3','tts.py',VOICE,s['voice'],f,RATE],check=True)
        subprocess.run(['ffmpeg','-v','error','-y','-i',f,'-af','silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',f+'.wav'],check=True); f=f+'.wav'
        subprocess.run(['ffmpeg','-v','error','-y','-i',f,'-af','silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',f+'.wav'],check=True); f=f+'.wav'
        s['vo']=f; s['d']=round(max(2.6,dur(f)+0.45),2)
json.dump(plan,open('plan.json','w'),ensure_ascii=False,indent=1)
# 2) overlays
subprocess.run(['node','render2.mjs'],check=True)
# 3) video segments
enc=['-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-preset','medium','-r','30','-an']
parts=[];t=0;cues=[]
for i,s in enumerate(plan['segs']):
    ov=f'ov_{i:02d}.png'; out=f'seg_{i:02d}.mp4'
    if s['t']=='play':
        cmd=['ffmpeg','-v','error','-y','-ss',str(s['a']),'-to',str(s['b']),'-i',SRC,'-i',ov,'-filter_complex','[0:v]fps=30,scale=1080:1920,crop=1080:1380:0:270,pad=1080:1920:0:540:black,setsar=1[v];[v][1:v]overlay=0:0[o]','-map','[o]']+enc+[out]
    else:
        cmd=['ffmpeg','-v','error','-y','-ss',str(s['at']),'-i',SRC,'-i',ov,'-filter_complex',f"[0:v]trim=end_frame=1,scale=1080:1920,crop=1080:1380:0:270,pad=1080:1920:0:540:black,setsar=1,loop=loop=-1:size=1,fps=30,trim=duration={s['d']}[v];[v][1:v]overlay=0:0[o]",'-map','[o]','-t',str(s['d'])]+enc+[out]
    subprocess.run(cmd,check=True); parts.append(out)
    if s.get('vo'): cues.append((s['vo'],t+0.15))
    t+=dur(out)
open('list.txt','w').write(''.join(f"file '{p}'\n" for p in parts))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','list.txt','-c','copy','video_only.mp4'],check=True)
# 4) voice track
ins=[];fl=[]
for k,(f,st) in enumerate(cues):
    ins+=['-i',f]; ms=int(st*1000); fl.append(f'[{k}:a]aresample=48000,adelay={ms}|{ms}[a{k}]')
fl.append(''.join(f'[a{k}]' for k in range(len(cues)))+f'amix=inputs={len(cues)}:normalize=0,apad,atrim=0:{t:.2f},loudnorm=I=-16:TP=-1.5[a]')
subprocess.run(['ffmpeg','-v','error','-y']+ins+['-filter_complex',';'.join(fl),'-map','[a]','-ac','2','voice.wav'],check=True)
subprocess.run(['ffmpeg','-v','error','-y','-i','video_only.mp4','-i','voice.wav','-c:v','copy','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','b2x_kbeauty_que_vende_001_es_dub.mp4'],check=True)
print('total',round(t,2))
