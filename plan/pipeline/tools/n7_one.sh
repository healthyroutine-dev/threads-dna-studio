#!/bin/bash
# usage: n7_one.sh NNN vid_id vid_tok th_id th_tok → 노션에 ES v7 영상 + 썸네일 올리고, 페이지 본문 출력
S=/tmp/claude-0/-home-user-threads-dna-studio/c2baa838-8d39-5050-9a2e-a92a98b07ab3/scratchpad
F=/home/user/threads-dna-studio/plan/final/$1
v=$(ls $F/*_ES_*.mp4 | head -1)
r1=$(curl -sS -X POST "https://api.notion.com/v1/mcp/file_uploads/$2/send" -H "authorization: Bearer $3" -F "file=@$v;filename=$1_ES_v7.mp4;type=video/mp4")
r2=$(curl -sS -X POST "https://api.notion.com/v1/mcp/file_uploads/$4/send" -H "authorization: Bearer $5" -F "file=@$F/$1_썸네일.png;filename=$1_thumb_v7.png;type=image/png")
echo "UP $1 vid:$(echo "$r1" | grep -o '"status":"[a-z]*"\|"message":"[^"]*"') th:$(echo "$r2" | grep -o '"status":"[a-z]*"\|"message":"[^"]*"')"
echo "PAGE $(grep "^$1 " $S/notion_rows.txt | cut -d' ' -f2)"
echo "$1 $2" > $S/n7_$1.txt
cd $S && VER=v7 python3 tools/notion_pages.py n7_$1.txt $1 | python3 -c "
import json,sys;c=json.load(sys.stdin)[0]['content'];i=c.index('</video>')+8
print(c[:i]+'\n\n![$1 썸네일](file-upload://$4)'+c[i:])"
