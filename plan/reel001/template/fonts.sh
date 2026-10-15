#!/bin/bash
# 릴스 템플릿 폰트 받기 (Pretendard · Archivo Black · Space Mono)
cd "$(dirname "$0")"
for w in Medium Bold ExtraBold; do
  [ -f Pretendard-$w.woff2 ] || curl -sL -o Pretendard-$w.woff2 "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-$w.woff2"
done
[ -f ArchivoBlack-400.ttf ] || curl -sL -o ArchivoBlack-400.ttf "https://fonts.gstatic.com/s/archivoblack/v23/HTxqL289NzCGg4MzN6KJ7eW6OYs.ttf"
[ -f SpaceMono-400.ttf ] || curl -sL -o SpaceMono-400.ttf "https://fonts.gstatic.com/s/spacemono/v17/i7dPIFZifjKcF5UAWdDRUEY.ttf"
[ -f SpaceMono-700.ttf ] || curl -sL -o SpaceMono-700.ttf "https://fonts.gstatic.com/s/spacemono/v17/i7dMIFZifjKcF5UAWdDRaPpZYFI.ttf"
