# longform_fx

Adds variety-style captions, punch-in framing, keyword pop-ups, flash
transitions and SFX to a single-take talking-head video.

1. Transcribe with word timestamps (ElevenLabs Scribe):
   `curl -X POST https://api.elevenlabs.io/v1/speech-to-text -F model_id=scribe_v1 -F language_code=kor -F timestamps_granularity=word -F file=@audio.mp3 -o stt.json`
2. Write `projects/<ep>/directives.json` (range, face position, keywords, emphasis pop-ups, transitions).
3. `python3 build_edit.py --stt stt.json --directives directives.json --out edit.json`
4. `python3 render.py --edit edit.json --fonts <fonts dir> --sfx <sfx dir> --out out.mp4 [--preview]`

Fonts: Pretendard Black, Black Han Sans. SFX: `whoosh.wav`, `pop.wav`, `impact.wav`, `ding.wav`.
