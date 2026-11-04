"""Звук ролика: голос + музыка (Mixkit «Digital Clouds», дроп на 7.30 s) +
SFX, синтезированные в коде на событиях картинки. Музыка приглушается под
голосом (sidechain), итог — −14 LUFS, true peak −1.5 dB.

Запуск: python3 scripts/mix.py  (из папки video/)
Потом:  python3 scripts/mix.py mux out/video.mp4 out/kosmo-tiktok.mp4
"""
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
DUR = 40.5
TL = json.loads((ROOT / 'src' / 'timeline.json').read_text())
MUSIC_URL = 'https://assets.mixkit.co/music/175/175.mp3'   # Mixkit Free License
MUSIC = ROOT / 'out' / 'music-175.mp3'
SONG_DROP = 29.92                                         # дроп песни, найден по энергии

def word(scene, prefix):
    return next(w['start'] for w in TL['words'] if w['scene'] == scene and w['text'].lower().startswith(prefix.lower()))

def scene(id_):
    return max(0, next(s['start'] for s in TL['scenes'] if s['id'] == id_) - 0.2)

DROP_AT = word('design', 'Два')

# ---------- синтез SFX ----------
rng = np.random.default_rng(7)

def env(n, attack=0.004, release=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / attack) * np.exp(-t / release)

def whoosh(length=0.45, up=True):
    n = int(length * SR)
    noise = rng.standard_normal(n)
    # полосовой «вжух»: скользящая частота среза через простую одно-полюсную фильтрацию
    out = np.zeros(n)
    y = 0.0
    for i in range(n):
        f = (0.02 + 0.25 * (i / n if up else 1 - i / n))
        y += f * (noise[i] - y)
        out[i] = y
    shape = np.sin(np.pi * np.arange(n) / n) ** 2
    return out * shape * 0.9

def pop(freq=520):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 1.4 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.035)

def impact():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 6) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.35)
    air = rng.standard_normal(n) * env(n, 0.001, 0.06) * 0.25
    return body + air

def chime():
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    tone = sum(np.sin(2 * np.pi * f * t) * a for f, a in [(880, 1), (1320, 0.5), (1760, 0.25)])
    return tone * env(n, 0.003, 0.45) * 0.5

def place(track, clip, at, gain):
    i = int(at * SR)
    j = min(len(track), i + len(clip))
    if i < len(track):
        track[i:j] += clip[: j - i] * gain

def sfx_track():
    tr = np.zeros(int(DUR * SR))
    # смены сцен — «вжух»
    for at in [scene('intro'), scene('chat'), scene('calls'), scene('rooms'), scene('feed'), scene('privacy'), scene('cta')]:
        place(tr, whoosh(0.5), at - 0.18, 0.22)
    place(tr, whoosh(0.7, up=True), DROP_AT - 0.75, 0.3)
    place(tr, impact(), DROP_AT, 0.55)                       # дроп и смена дизайна
    place(tr, impact(), scene('intro') + 0.25, 0.3)          # появление планеты
    for sc, words in [('chat', ['Альбомы', 'кружки', 'голосовые', 'стикеры', 'реакции']),
                      ('rooms', ['Каналы', 'комментариями', 'опросы']),
                      ('privacy', ['Секретные', 'исчезающие', 'коду'])]:
        for k, wd in enumerate(words):
            place(tr, pop(480 + 60 * k), word(sc, wd), 0.18)
    for wd in ['Material', 'цветами']:
        place(tr, whoosh(0.4), word('design', wd) - 0.1, 0.18)
    place(tr, chime(), word('cta', 'Подписывайся'), 0.28)
    place(tr, pop(700), word('cta', 'Android'), 0.2)
    return tr

def write_wav(path, mono):
    data = np.clip(mono, -1, 1)
    stereo = np.stack([data, data], axis=1)
    pcm = (stereo * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0', str(path)], input=pcm, check=True)

def run(*args):
    return subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True, capture_output=True, text=True)

def mix():
    out = ROOT / 'out'
    out.mkdir(exist_ok=True)
    if not MUSIC.exists():
        urllib.request.urlretrieve(MUSIC_URL, MUSIC)
    write_wav(out / 'sfx.wav', sfx_track())
    start = SONG_DROP - DROP_AT
    vo = ROOT / 'public' / 'audio' / 'voiceover.mp3'
    graph = (
        f"[1:a]atrim={start:.3f}:{start + DUR:.3f},asetpts=PTS-STARTPTS,aresample={SR},volume=0.55,"
        f"afade=t=in:st=0:d=0.6,afade=t=out:st={DUR - 2.6:.2f}:d=2.6[mus];"
        f"[0:a]aresample={SR},apad=whole_dur={DUR},asplit=2[vo][key];"
        "[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=300:makeup=1[duck];"
        f"[2:a]aresample={SR}[fx];"
        "[vo][duck][fx]amix=inputs=3:normalize=0:duration=longest[m]"
    )
    run('-i', str(vo), '-i', str(MUSIC), '-i', str(out / 'sfx.wav'), '-filter_complex', graph, '-map', '[m]', '-t', str(DUR), str(out / 'premix.wav'))
    # два прохода loudnorm до −14 LUFS
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(out / 'premix.wav'), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rindex('{'):])
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run('-i', str(out / 'premix.wav'), '-af', ln, '-ar', str(SR), str(out / 'mix.wav'))
    print('mix.wav ready, measured', m['input_i'], 'LUFS →', -14)

def mux(video, dest):
    run('-i', video, '-i', str(ROOT / 'out' / 'mix.wav'), '-map', '0:v', '-map', '1:a',
        '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
        '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-color_range', 'tv', '-colorspace', 'bt709',
        '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', dest)
    print('muxed', dest)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'mux':
        mux(sys.argv[2], sys.argv[3])
    else:
        mix()
