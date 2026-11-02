#!/bin/bash
# usage: build_all.sh NNN...  (v7: ES만 빌드 → ep_final. KO 버전은 만들지 않음 2026-11-01)
S=/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad
for n in "$@"; do
  D=$S/ep/$n; cd $D || continue
  for f in ArchivoBlack-400.ttf Pretendard-Bold.woff2 Pretendard-ExtraBold.woff2 Pretendard-Medium.woff2 SpaceMono-400.ttf SpaceMono-700.ttf NotoSans-VF.woff2 endcard.html hand_down.png subs.html render_subs.mjs; do [ -e $f ] || cp $S/ep/002/$f .; done
  echo "START $n $(date +%H:%M)"
  cp plan_base.json plan.json && python3 $S/tools/build_ep.py es beauty.mp4 clean.wav sil.txt dub 2>&1 | tail -2 && cp plan.json plan_es.json \
  && cd $S && python3 tools/ep_final.py $n > /dev/null 2>&1 && rm -f $D/ceo_*.mov $D/seg_*.mp4 $D/video_nosub.mp4 $D/video_only.mp4 && echo "DONE $n $(date +%H:%M)" || echo "FAIL $n"
done
