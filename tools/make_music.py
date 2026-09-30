# Calm ambient bed: warm pad chords + singing-bowl strikes + soft bell notes.
# Usage: python3 make_music.py out.wav [seconds]   Requires: pip install numpy
import sys, wave, numpy as np
out = sys.argv[1]; D = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
SR = 44100; t = np.arange(int(SR*D))/SR; L = np.zeros_like(t); R = np.zeros_like(t)
def n(m): return 440*2**((m-69)/12)
def env(start, a, dec):
    x = t-start; e = np.where(x < 0, 0, np.where(x < a, x/a, np.exp(-(x-a)/dec))); return e
# pad: Fmaj9 -> Cmaj7 (soft, slightly detuned sines, slow swell)
chords = [([53,60,64,67,69],0.0),([48,55,64,67,71],D/2)]
for notes, st in chords:
    ln = D/2
    g = np.clip((t-st)/1.8,0,1)*np.clip((st+ln+1.2-t)/1.8,0,1)
    for i,m in enumerate(notes):
        f = n(m)
        L += 0.05*g*(np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*2*f*t+1))*(1+0.1*np.sin(2*np.pi*0.2*t+i))
        R += 0.05*g*(np.sin(2*np.pi*f*1.003*t+0.5)+0.3*np.sin(2*np.pi*2*f*1.003*t))*(1+0.1*np.sin(2*np.pi*0.23*t+i))
# singing bowl strikes (inharmonic partials with beating)
for st, f0, amp in [(0.15, n(57), 0.22), (5.0, n(55), 0.18)]:
    for ratio, a, dec in [(1,1,4.5),(2.76,0.45,3),(5.4,0.2,2),(8.9,0.08,1.2)]:
        f = f0*ratio; e = env(st, 0.01, dec)
        L += amp*a*e*np.sin(2*np.pi*f*t)*(0.75+0.25*np.cos(2*np.pi*1.7*t))
        R += amp*a*e*np.sin(2*np.pi*(f+1.2)*t)*(0.75+0.25*np.cos(2*np.pi*1.9*t+1))
# soft bell melody (pentatonic), roughly on the cuts
mel = [76,79,81,79,84,81,79,76,72]
for k,m in enumerate(mel):
    st = 0.6+k*1.05
    if st > D-1.5: break
    f = n(m); e = env(st,0.008,1.1)
    s = 0.05*e*(np.sin(2*np.pi*f*t)+0.25*np.sin(2*np.pi*3*f*t))
    pan = 0.35+0.3*(k%2); L += s*(1-pan); R += s*pan
# simple reverb: multi-tap feedback delays
def verb(x):
    y = x.copy()
    for d,g in [(0.037,0.35),(0.061,0.3),(0.089,0.25),(0.127,0.2),(0.181,0.15),(0.263,0.1)]:
        k = int(d*SR); y[k:] += g*x[:-k]
    return y
L, R = verb(L)+0.2*verb(R), verb(R)+0.2*verb(L)
fade = np.clip(t/0.6,0,1)*np.clip((D-t)/1.5,0,1); L*=fade; R*=fade
peak = max(abs(L).max(), abs(R).max()); L, R = L/peak*0.6, R/peak*0.6
data = (np.stack([L,R],1)*32767).astype('<i2')
with wave.open(out,'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('ok', out)
