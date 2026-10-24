import sys,json,subprocess,numpy as np
from faster_whisper import WhisperModel
m=WhisperModel(sys.argv[3] if len(sys.argv)>3 else "small",device="cpu",compute_type="int8")
a=np.frombuffer(subprocess.run(["ffmpeg","-v","quiet","-i",sys.argv[1],"-ac","1","-ar","16000","-f","s16le","-"],capture_output=True).stdout,np.int16).astype(np.float32)/32768
segs,info=m.transcribe(a,language="ko",beam_size=5,word_timestamps=True,vad_filter=False)
out=[]
for s in segs:
    out.append({"s":round(s.start,2),"e":round(s.end,2),"t":s.text.strip(),"w":[[round(w.start,2),round(w.end,2),w.word] for w in s.words]})
    print(f"{s.start:6.2f}-{s.end:6.2f} {s.text.strip()}",flush=True)
json.dump(out,open(sys.argv[2],"w"),ensure_ascii=False,indent=1)
