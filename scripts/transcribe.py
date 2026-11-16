"""Local speech-to-text worker for StreamCut.

Called by the local server as:
  python transcribe.py <audio.wav> [model] [language]

Prints progress lines to stderr ("PROGRESS 42") and a single JSON object to
stdout:
  {"language": "en", "duration": 61.2, "segments": [{"start": 0.4, "end": 3.1, "text": "..."}]}

The model is downloaded once into STREAMCUT_HF_HOME (default E:/AI/streamcut-models
on Windows when that drive exists) so the project's nearly-full system drive is
not used for model weights.
"""
import json
import os
import sys


def resolve_download_root() -> str:
    explicit = os.environ.get("STREAMCUT_HF_HOME")
    if explicit:
        return explicit
    if os.name == "nt" and os.path.isdir("E:\\"):
        return "E:\\AI\\streamcut-models"
    return os.path.join(os.path.expanduser("~"), ".cache", "streamcut-models")


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: transcribe.py <audio> [model] [language]", file=sys.stderr)
        return 2

    audio = sys.argv[1]
    model_name = (sys.argv[2] if len(sys.argv) > 2 else os.environ.get("STREAMCUT_WHISPER_MODEL") or "base").strip()
    language = (sys.argv[3] if len(sys.argv) > 3 else "auto").strip().lower()
    if language in ("auto", "detect", ""):
        language = None

    if not os.path.isfile(audio):
        print(f"Audio file not found: {audio}", file=sys.stderr)
        return 1

    # Imported here so --help style failures surface as clean messages.
    from faster_whisper import WhisperModel

    download_root = resolve_download_root()
    os.makedirs(download_root, exist_ok=True)

    device = os.environ.get("STREAMCUT_WHISPER_DEVICE", "cpu")
    compute = os.environ.get("STREAMCUT_WHISPER_COMPUTE", "int8" if device == "cpu" else "float16")
    model = WhisperModel(model_name, device=device, compute_type=compute, download_root=download_root)

    segments_iter, info = model.transcribe(
        audio,
        language=language,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        beam_size=5,
        condition_on_previous_text=False,
        word_timestamps=False,
    )

    total = float(getattr(info, "duration", 0) or 0)
    segments = []
    for segment in segments_iter:
        text = (segment.text or "").strip()
        if not text:
            continue
        segments.append({"start": round(float(segment.start), 2), "end": round(float(segment.end), 2), "text": text})
        if total > 0:
            percent = min(99, int(max(0.0, segment.end) / total * 100))
            print(f"PROGRESS {percent}", file=sys.stderr, flush=True)

    print(
        json.dumps(
            {
                "language": getattr(info, "language", None) or "unknown",
                "language_probability": round(float(getattr(info, "language_probability", 0) or 0), 3),
                "duration": round(total, 2),
                "segments": segments,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # surfaced to the server as a readable job error
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
