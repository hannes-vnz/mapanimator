#!/usr/bin/env bash
# Analysiert ein Video für Schnitt/Format-Studien:
#   Schnitte (ffmpeg-Szenenwechsel), Kontaktbögen (1 Bild/10 s), Einstieg (1 Bild/s, 90 s),
#   Transkript (whisper.cpp), Tonklassen + Beats (PANNs + librosa, via uv).
# Aufruf: tools/video-analyse.sh "video.mp4" [ausgabeordner] [sprache: auto|de|en]
# Voraussetzungen: brew install ffmpeg whisper-cpp uv; Modell ~/whisper-models/ggml-large-v3-turbo.bin;
#                  PANNs-Daten in ~/panns_data (class_labels_indices.csv, Cnn14_mAP=0.431.pth)
set -euo pipefail
IN="$1"; OUT="${2:-analyse_$(basename "${IN%.*}")}"; LANG_="${3:-auto}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
echo "▶ Schnitte + Kontaktbögen …"
ffmpeg -hide_banner -nostats -i "$IN" -an -filter_complex \
  "[0:v:0]scale=320:-2,split=2[a][b];[a]select='gt(scene,0.28)',showinfo[c];[b]fps=1/10,tile=8x6[d]" \
  -map "[c]" -f null - -map "[d]" -fps_mode passthrough "$OUT/sheet_%02d.jpg" 2> "$OUT/scenes.log"
grep -o 'pts_time:[0-9.]*' "$OUT/scenes.log" | cut -d: -f2 > "$OUT/cuts.txt"
ffmpeg -loglevel error -y -i "$IN" -t 90 -vf "fps=1,scale=256:-2,tile=10x9" -frames:v 1 "$OUT/einstieg.jpg"
echo "▶ Ton extrahieren …"
ffmpeg -loglevel error -y -i "$IN" -ar 16000 -ac 1 -c:a pcm_s16le "$OUT/ton.wav"
echo "▶ Transkript (whisper) …"
whisper-cli -m ~/whisper-models/ggml-large-v3-turbo.bin -l "$LANG_" -t 6 -osrt -otxt -of "$OUT/transkript" -f "$OUT/ton.wav" > "$OUT/whisper.log" 2>&1
echo "▶ Tonklassen + Beats …"
uv run -q --python 3.11 --with torch --with librosa --with panns-inference --with soundfile \
  python "$HERE/audio_analyse.py" "$OUT/ton.wav" "$OUT/cuts.txt" "$OUT/audio.json" | tee "$OUT/audio_summary.txt"
python3 - "$OUT/cuts.txt" <<'PY'
import sys, statistics as st
ts = sorted(float(x) for x in open(sys.argv[1]).read().split())
d = [b - a for a, b in zip(ts, ts[1:]) if b - a > 0.05]
print(f"Schnitte: {len(ts)} · Median-Einstellung {st.median(d):.2f} s · Mittel {st.mean(d):.2f} s")
PY
echo "Fertig → $OUT"
