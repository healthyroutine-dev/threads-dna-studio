# v7 엔딩 카드 세그먼트: 대표 얼굴 없음 · 앞 화면에서 0.3초 크로스페이드 · 글자 순서대로 등장 (음성은 build 쪽에서 그대로 깔림)
# 레이어(render2.mjs가 그림): ov_XX.png(배경) _gift(🎁+자료명) _cmt(댓글 문구) _corp(상호명) _b2x(B2X, 끝 1.5초) + hand_down.png(👇 통통)
import subprocess
XF = 0.3                        # 크로스페이드
T_GIFT, T_CMT, T_CORP = 0.3, 0.9, 1.5
HAND_X, HAND_Y = 470, 905

def endcard_cmd(ov, d, prev_seg, out, enc):
    nm = ov[:-4]; prev = f'{nm}_prev.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-sseof', '-0.1', '-i', prev_seg, '-update', '1', '-frames:v', '1', prev], check=True)
    T_B2X = max(T_CORP + 0.5, d - 1.5)
    img = lambda f: ['-loop', '1', '-framerate', '30', '-t', f'{d:.2f}', '-i', f]
    ins = img(ov) + img(f'{nm}_gift.png') + img('hand_down.png') + img(f'{nm}_cmt.png') + img(f'{nm}_corp.png') + img(f'{nm}_b2x.png') + img(prev)
    fade = lambda k, T, lab, pre='': f'[{k}:v]{pre}format=rgba,fade=t=in:st={T:.2f}:d=0.35:alpha=1[{lab}]'
    rise = lambda T: f"'30*max(0,1-max(0,t-{T:.2f})/0.4)'"   # 30px 아래에서 올라오며 등장
    fc = ';'.join([
        '[0:v]format=rgba[b0]',
        fade(1, T_GIFT, 'g'), fade(2, T_CMT, 'h', 'scale=140:140,'), fade(3, T_CMT, 'c'), fade(4, T_CORP, 'p'), fade(5, T_B2X, 'x'),
        f'[6:v]format=rgba,fade=t=out:st=0:d={XF}:alpha=1[pv]',
        f'[b0][g]overlay=0:{rise(T_GIFT)}:eval=frame[b1]',
        f"[b1][h]overlay=x={HAND_X}:y='{HAND_Y}+26*abs(sin(PI*1.6*t))':eval=frame[b2]",
        f'[b2][c]overlay=0:{rise(T_CMT)}:eval=frame[b3]',
        f'[b3][p]overlay=0:{rise(T_CORP)}:eval=frame[b4]',
        '[b4][x]overlay=0:0[b5]',
        '[b5][pv]overlay=0:0,format=yuv420p[o]'])
    return ['ffmpeg', '-v', 'error', '-y'] + ins + ['-filter_complex', fc, '-map', '[o]', '-t', f'{d:.2f}'] + enc + [out]
