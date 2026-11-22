# Audio clips for the STT eval

Put recordings here as `<id>.webm` (or `.wav`, `.m4a`, `.ogg`) with a reference transcript `<id>.txt` next to it.
Name the id with the language first so the report can group it: `hi-01.webm`, `mr-03.wav`, `gu-02.m4a`, `en-01.webm`.
Include a few silence and shop-noise clips (`hi-silence-01.webm` with an empty `.txt`) to test hallucination guards.

`.webm`/`.m4a`/`.ogg` need `ffmpeg` on PATH to decode; `.wav` does not.
