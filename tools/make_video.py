# Requires: pip install pillow imageio-ffmpeg
# Usage: python3 make_video.py out.mp4 img1 img2[@0.0] ...  (@y = vertical crop anchor 0=top..1=bottom, default 0.5)   -> 1920x1080, ~10s, Ken Burns + crossfade
import sys, subprocess, imageio_ffmpeg
from PIL import Image, ImageOps, ImageFilter
out, imgs = sys.argv[1], sys.argv[2:]
W,H,FPS,TOTAL,XF = 1920,1080,30,10.0,0.3
n=len(imgs); seg=(TOTAL+XF*(n-1))/n
prep=[]
for i,p in enumerate(imgs):
    p,_,cy=p.partition('@'); cy=float(cy or 0.5)
    im=ImageOps.exif_transpose(Image.open(p)).convert('RGB')
    # 16:9 canvas: blurred fill background + full photo centered (keeps vertical phone shots intact)
    bg=ImageOps.fit(im,(W,H)).filter(ImageFilter.GaussianBlur(40))
    s=min(W/im.width,H/im.height); fg=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    if fg.width/fg.height>1.3: fg=ImageOps.fit(im,(W,H),centering=(0.5,cy))  # landscape: fill frame
    bg.paste(fg,((W-fg.width)//2,(H-fg.height)//2))
    q=f'prep_{i}.png'; bg.save(q); prep.append(q)
ff=imageio_ffmpeg.get_ffmpeg_exe(); args=[ff,'-y']
for q in prep: args+=['-i',q]
f=[]
for i in range(n):
    frames=int(seg*FPS); z='1+0.08*on/%d'%frames if i%2==0 else '1.08-0.08*on/%d'%frames
    f.append(f"[{i}:v]scale=3840:-1,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=%d:s={W}x{H}:fps={FPS},format=yuv420p,settb=AVTB[v{i}]" % frames)
last='v0'; off=0
for i in range(1,n):
    off+=seg-XF; f.append(f"[{last}][v{i}]xfade=transition=fade:duration={XF}:offset={off:.3f}[x{i}]"); last=f'x{i}'
f.append(f"[{last}]fade=t=in:d=0.3,fade=t=out:st={TOTAL-0.4}:d=0.4[out]")
args+=['-filter_complex',';'.join(f),'-map','[out]','-t',str(TOTAL),'-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart',out]
subprocess.run(args,check=True,capture_output=True); print('ok',out)
