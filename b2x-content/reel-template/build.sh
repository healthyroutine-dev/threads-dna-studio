#!/bin/bash
# K-Beauty que vende 릴스 빌드: 레퍼런스 영상(아래) + 분석 패널(위, 1080x640)
# 사용: ./build.sh <레퍼런스.mp4> <출력.mp4>
# 패널 문구는 states.json, 시리즈 번호·크리에이터·칩 이름은 panel.html 에서 바꾼다.
# 구간 시간(enable=...)은 레퍼런스의 장면 전환에 맞춰 아래에서 조정한다.
set -e
cd "$(dirname "$0")"
for w in Medium Bold ExtraBold; do
  [ -f Pretendard-$w.woff2 ] || curl -sL -o Pretendard-$w.woff2 "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-$w.woff2"
done
node render.mjs
SRC="$1"; OUT="$2"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
HOLD=4.6
ffmpeg -v error -y -i "$SRC" -i panel_s1.png -i panel_s2.png -i panel_s3.png -i panel_s4.png -i panel_s5.png -i panel_s6.png -filter_complex "\
[0:v]fps=30,tpad=stop_mode=clone:stop_duration=$HOLD,split[a][b];\
[a]scale=1080:1920,boxblur=30:3,eq=brightness=-0.25[bg];[b]scale=720:1280[fg];\
[bg][fg]overlay=180:640[v0];\
[v0][1:v]overlay=0:0:enable='lt(t,2.3)'[v1];\
[v1][2:v]overlay=0:0:enable='between(t,2.3,4.55)'[v2];\
[v2][3:v]overlay=0:0:enable='between(t,4.55,6.3)'[v3];\
[v3][4:v]overlay=0:0:enable='between(t,6.3,8.1)'[v4];\
[v4][5:v]overlay=0:0:enable='between(t,8.1,$DUR)'[v5];\
[v5][6:v]overlay=0:0:enable='gte(t,$DUR)'[v6]" \
  -map "[v6]" -an -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart "$OUT"
