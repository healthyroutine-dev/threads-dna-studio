import json,subprocess
plan=json.load(open('plan.json'))
SRC='src_7482942231217704238.mp4'
enc=['-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-preset','medium','-r','30','-an']
parts=[]
for i,s in enumerate(plan['segs']):
    ov=f'ov_{i:02d}.png'; out=f'seg_{i:02d}.mp4'
    if s['t']=='play':
        cmd=['ffmpeg','-v','error','-y','-ss',str(s['a']),'-to',str(s['b']),'-i',SRC,'-i',ov,'-filter_complex',
             '[0:v]fps=30,scale=1080:1920,setsar=1[v];[v][1:v]overlay=0:0[o]','-map','[o]']+enc+[out]
    else:
        cmd=['ffmpeg','-v','error','-y','-ss',str(s['at']),'-i',SRC,'-i',ov,'-filter_complex',
             f"[0:v]trim=end_frame=1,scale=1080:1920,setsar=1,loop=loop=-1:size=1,fps=30,trim=duration={s['d']}[v];[v][1:v]overlay=0:0[o]",'-map','[o]','-t',str(s['d'])]+enc+[out]
    subprocess.run(cmd,check=True); parts.append(out)
open('list.txt','w').write(''.join(f"file '{p}'\n" for p in parts))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','list.txt','-c','copy','-movflags','+faststart','b2x_kbeauty_que_vende_001_es.mp4'],check=True)
