"""Ton-Analyse eines Videos: Sprache/Musik/Soundeffekte pro Sekunde (PANNs, AudioSet),
Beats/Tempo in Musikpassagen (librosa) und Abgleich mit Schnittzeiten.
Aufruf: python analyse.py <ton.wav (16 kHz)> <cuts.txt> <ausgabe.json>"""
import sys, json, numpy as np, librosa, torch
from panns_inference import AudioTagging, labels

wav, cuts_path, out_path = sys.argv[1:4]
y16, _ = librosa.load(wav, sr=16000, mono=True)
y = librosa.resample(y16, orig_sr=16000, target_sr=32000)
dur = len(y) / 32000
print(f"Dauer {dur/60:.1f} min", flush=True)

at = AudioTagging(checkpoint_path=None, device="cpu")
L = np.array(labels)
def idx(names): return [i for i, l in enumerate(labels) if l in names]
SPEECH = idx(["Speech", "Male speech, man speaking", "Female speech, woman speaking", "Conversation", "Narration, monologue"])
MUSIC = idx(["Music"])
SFX = {
    "whoosh": idx(["Whoosh, swoosh, swish"]),
    "wind": idx(["Wind", "Rustling leaves", "Wind noise (microphone)"]),
    "fahrzeug": idx(["Vehicle", "Car", "Engine", "Motor vehicle (road)", "Truck", "Motorcycle", "Traffic noise, roadway noise"]),
    "wasser": idx(["Water", "Stream", "Waterfall", "Rain", "Ocean", "Waves, surf"]),
    "lachen": idx(["Laughter", "Giggle", "Chuckle, chortle"]),
    "menge": idx(["Crowd", "Chatter", "Hubbub, speech noise, speech babble"]),
    "beep_ui": idx(["Beep, bleep", "Ding", "Click", "Clicking", "Chime", "Cash register", "Camera"]),
    "impact": idx(["Thump, thud", "Bang", "Boom", "Explosion", "Slam"]),
}

win, hop = 64000, 32000             # 2 s Fenster, 1 s Schritt
starts = list(range(0, max(1, len(y) - win), hop))
rows = []
B = 48
with torch.no_grad():
    for b in range(0, len(starts), B):
        batch = np.stack([y[s:s + win] if s + win <= len(y) else np.pad(y[s:], (0, win - len(y[s:]))) for s in starts[b:b + B]])
        clip, _ = at.inference(batch)
        for k, p in enumerate(clip):
            t = (starts[b + k] + win / 2) / 32000
            top = np.argsort(p)[::-1][:5]
            rows.append({"t": round(t, 1),
                         "speech": float(p[SPEECH].max()), "music": float(p[MUSIC].max()),
                         **{k2: float(p[v].max()) for k2, v in SFX.items()},
                         "top": [[L[i], round(float(p[i]), 2)] for i in top]})
        if b % (B * 10) == 0: print(f"  {b}/{len(starts)}", flush=True)

T = np.array([r["t"] for r in rows]); M = np.array([r["music"] for r in rows]); S = np.array([r["speech"] for r in rows])
# Musikpassagen (≥ 8 s mit Musik > 0.35) → Beats
runs, cur = [], None
for t, m in zip(T, M):
    if m > 0.35: cur = [t, t] if cur is None else [cur[0], t]
    else:
        if cur and cur[1] - cur[0] >= 8: runs.append(cur)
        cur = None
if cur and cur[1] - cur[0] >= 8: runs.append(cur)
beats, tempos = [], []
y22 = librosa.resample(y16, orig_sr=16000, target_sr=22050)
for a, b in runs:
    seg = y22[int(a * 22050):int((b + 1) * 22050)]
    tempo, bt = librosa.beat.beat_track(y=seg, sr=22050)
    tempos.append([a, b, float(np.atleast_1d(tempo)[0])])
    beats += list(librosa.frames_to_time(bt, sr=22050) + a)
beats = np.array(sorted(beats))

cuts = np.array([float(x) for x in open(cuts_path).read().split()])
def at_t(arr, t): return arr[min(len(arr) - 1, max(0, int(np.searchsorted(T, t))))]
cut_rows = []
for c in cuts:
    m, s = at_t(M, c), at_t(S, c)
    nb = float(np.min(np.abs(beats - c))) if len(beats) else None
    near = [r for r in rows if abs(r["t"] - c) <= 1.0]
    wh = max((r["whoosh"] for r in near), default=0)
    imp = max((r["impact"] for r in near), default=0)
    cut_rows.append({"t": float(c), "music": float(m), "speech": float(s), "beatDist": nb, "whoosh": float(wh), "impact": float(imp)})
mc = [r for r in cut_rows if r["music"] > 0.35 and r["beatDist"] is not None]
summary = {
    "dauer_min": round(dur / 60, 1),
    "anteil_sprache": round(float((S > 0.5).mean()), 2),
    "anteil_musik": round(float((M > 0.35).mean()), 2),
    "anteil_musik_unter_sprache": round(float(((M > 0.25) & (S > 0.5)).mean()), 2),
    "musikpassagen": [[round(a), round(b), round(t)] for a, b, t in tempos],
    "schnitte": len(cuts),
    "schnitte_mit_musik": len(mc),
    "schnitte_auf_beat_100ms": round(sum(r["beatDist"] < 0.1 for r in mc) / max(len(mc), 1), 2),
    "zufall_auf_beat_100ms": round(float(np.mean([min(1, 0.2 * t / 60) for _, _, t in tempos])) if tempos else 0, 2),
    "schnitte_mit_whoosh": round(sum(r["whoosh"] > 0.2 for r in cut_rows) / max(len(cut_rows), 1), 2),
    "schnitte_mit_impact": round(sum(r["impact"] > 0.2 for r in cut_rows) / max(len(cut_rows), 1), 2),
    "sfx_sekunden": {k: int(sum(r[k] > 0.3 for r in rows)) for k in SFX},
}
json.dump({"summary": summary, "rows": rows, "cuts": cut_rows}, open(out_path, "w"))
print(json.dumps(summary, ensure_ascii=False, indent=1))
