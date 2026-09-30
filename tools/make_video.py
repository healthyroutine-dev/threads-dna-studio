# Photo slideshow -> ~10s MP4 with slow zoom, crossfades, optional music.
# Requires: pip install pillow imageio-ffmpeg
# Usage: python3 make_video.py [--size 1920x1080|1080x1920] [--music bgm.wav] out.mp4 img1[@anchor] img2 ...
#   anchor: "0.2" = vertical crop anchor, "x0.7" = horizontal crop anchor (forces fill), "fit" = never crop (blur fill)
import sys, subprocess, argparse, imageio_ffmpeg
from PIL import Image, ImageOps, ImageFilter
ap = argparse.ArgumentParser(); ap.add_argument('--size', default='1920x1080'); ap.add_argument('--music')
ap.add_argument('--seconds', type=float, default=10.0); ap.add_argument('out'); ap.add_argument('imgs', nargs='+')
a = ap.parse_args()
W, H = map(int, a.size.split('x')); FPS, TOTAL, XF = 30, a.seconds, 0.3
n = len(a.imgs); seg = (TOTAL+XF*(n-1))/n; prep = []
for i, spec in enumerate(a.imgs):
    p, _, anc = spec.partition('@'); cx, cy, fit = 0.5, 0.5, anc == 'fit'
    if anc.startswith('x'): cx = float(anc[1:])
    elif anc and not fit: cy = float(anc)
    im = ImageOps.exif_transpose(Image.open(p)).convert('RGB')
    r = (im.width/im.height)/(W/H)
    if not fit and (0.73 <= r <= 1.4 or anc.startswith('x')):   # close to target shape (or x anchor given): fill
        canvas = ImageOps.fit(im, (W, H), Image.LANCZOS, centering=(cx, cy))
    else:                               # very different shape: whole photo on blurred fill
        canvas = ImageOps.fit(im, (W, H)).filter(ImageFilter.GaussianBlur(40))
        s = min(W/im.width, H/im.height); fg = im.resize((round(im.width*s), round(im.height*s)), Image.LANCZOS)
        canvas.paste(fg, ((W-fg.width)//2, (H-fg.height)//2))
    q = f'{a.out}.prep_{i}.png'; canvas.save(q); prep.append(q)
ff = imageio_ffmpeg.get_ffmpeg_exe(); args = [ff, '-y']
for q in prep: args += ['-i', q]
if a.music: args += ['-i', a.music]
f = []
for i in range(n):
    frames = int(seg*FPS); z = f'1+0.08*on/{frames}' if i % 2 == 0 else f'1.08-0.08*on/{frames}'
    f.append(f"[{i}:v]scale={W*2}:-1,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},format=yuv420p,settb=AVTB[v{i}]")
last, off = 'v0', 0
for i in range(1, n):
    off += seg-XF; f.append(f"[{last}][v{i}]xfade=transition=fade:duration={XF}:offset={off:.3f}[x{i}]"); last = f'x{i}'
f.append(f"[{last}]fade=t=in:d=0.3,fade=t=out:st={TOTAL-0.4}:d=0.4[out]")
args += ['-filter_complex', ';'.join(f), '-map', '[out]']
if a.music: args += ['-map', f'{n}:a', '-c:a', 'aac', '-b:a', '192k']
args += ['-t', str(TOTAL), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', a.out]
r = subprocess.run(args, capture_output=True, text=True)
import os; [os.remove(q) for q in prep]
if r.returncode: sys.exit(r.stderr[-2000:])
print('ok', a.out)
