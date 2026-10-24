#!/bin/bash
# 003~026 얼굴 보정 순서대로 (원형 영역만: 960x1000 @ 60,460). 편마다 무음 지점에서 4조각 병렬
S=/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad
while pgrep -f "tools/beauty.py ceo_raw/0002" >/dev/null; do sleep 30; done
for p in $(cat $S/ep/pairs.txt); do
  no=${p%%:*}; fn=${p##*:}; D=$S/ep/$no
  case $no in 001|002) continue;; esac
  [ -s $D/beauty.mp4 ] && continue
  cuts=$(python3 -c "
import json
sil=[tuple(map(float,l.split())) for l in open('$D/sil.txt') if l.strip()]
T=json.load(open('$D/sect.json'))['total']
mids=[(a+b)/2 for a,b in sil]
pts=[min(mids,key=lambda m:abs(m-T*q/4)) for q in (1,2,3)]
print(' '.join(f'{x:.2f}' for x in [0]+pts+[T+0.1]))")
  set -- $cuts; arr=($cuts); mkdir -p $D/bparts
  for i in 0 1 2 3; do
    a=${arr[$i]}; b=${arr[$((i+1))]}
    (cd $S && BEAUTY_CROP=960,1000,60,460 nice -n 2 python3 tools/beauty.py ceo_raw/$fn.mp4 $D/bparts/p$i.mp4 $a $b > $D/bparts/log$i.txt 2>&1) &
  done
  wait
  printf "file '%s'\n" $D/bparts/p0.mp4 $D/bparts/p1.mp4 $D/bparts/p2.mp4 $D/bparts/p3.mp4 > $D/bparts/list.txt
  ffmpeg -v error -y -f concat -safe 0 -i $D/bparts/list.txt -c copy $D/beauty.mp4 && echo "DONE $no $(date +%H:%M)"
done
