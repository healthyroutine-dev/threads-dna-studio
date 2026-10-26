# 채원 대표 v2 (일레븐랩스) 스페인어 음성 생성: plan.json의 voice 구간별
import json, sys, subprocess, urllib.request, os
plan, out = sys.argv[1], sys.argv[2]
SPEED = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}   # 구간별 말하기 속도 (일레븐랩스 speed)
VOICE = '2tNk6YiVpK91N5GMnp0a'; MODEL = 'eleven_multilingual_v2'
segs = [s for s in json.load(open(plan))['segs'] if s.get('voice')]
texts = [s['voice'] for s in segs]
for k, s in enumerate(segs):
    key = s['pause'].split()[0]
    if os.environ.get('ONLY') and key not in os.environ['ONLY'].split(','): continue   # 고친 구간만 다시
    body = {'text': texts[k], 'model_id': MODEL,
            'voice_settings': {'stability': 0.5, 'similarity_boost': 0.85, 'style': 0.15, 'use_speaker_boost': True, 'speed': SPEED.get(key, 1.0)},
            'previous_text': texts[k - 1] if k else None, 'next_text': texts[k + 1] if k + 1 < len(texts) else None}
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    mp3 = f'{out}/es_{k:02d}_{key}.mp3'
    open(mp3, 'wb').write(urllib.request.urlopen(req, timeout=120).read())
    wav = mp3[:-4] + '.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', '-ar', '48000', '-ac', '1', wav], check=True)
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], capture_output=True, text=True).stdout)
    print(key, round(d, 2), texts[k])
