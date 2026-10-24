#!/bin/bash
# 보정(beauty.mp4)이 끝나는 편부터 차례로 조립 (usage: auto_build.sh 009 010 ...)
S=/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad
for n in "$@"; do
  until [ -s $S/ep/$n/beauty.mp4 ] && grep -q "DONE $n" $S/ep/beauty_queue.log; do sleep 30; done
  $S/tools/build_all.sh $n
done
echo AUTO_ALL_DONE
