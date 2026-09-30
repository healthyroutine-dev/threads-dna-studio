# Aromiel short video tools

- `make_music.py` builds a calm 10s music bed with a singing bowl, soft pad chords and bell notes. It is synthesized, so there are no licensing issues.
- `make_video.py` turns photos into a 10s slideshow with slow zoom, crossfades and the music bed.

```
pip install pillow imageio-ffmpeg numpy
python3 tools/make_music.py bgm.wav 10
python3 tools/make_video.py --music bgm.wav out_16x9.mp4 a.jpg b.jpg@0.3 c.jpg
python3 tools/make_video.py --size 1080x1920 --music bgm.wav out_9x16.mp4 a.jpg@x0.6 b.jpg@fit
```
