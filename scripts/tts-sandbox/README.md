# Fish Audio S2 Pro sandbox (Modal)

Throwaway sandbox to evaluate Fish Audio's S2 Pro TTS model, self-hosted on
Modal (serverless GPU), before deciding whether to swap it in for the
production pipeline (currently OpenAI `gpt-4o-mini-tts`, see
`../../src/audio/tts.ts`). Not wired into the app — nothing here runs unless
you run it yourself.

## Setup (one time, on your own machine)

```bash
pip install modal
modal setup   # opens a browser to link this machine to your Modal account
```

Modal builds the container image (clones `fishaudio/fish-speech`, installs
its deps) on Modal's own remote build cluster the first time you run the
command below — that step needs no local GPU and happens automatically.

## Run a test generation

```bash
modal run scripts/tts-sandbox/modal_app.py --text-file my-script.txt --out test.wav
```

First run downloads the ~24GB `fishaudio/s2-pro` checkpoint from Hugging Face
into a persistent Modal Volume (`fish-speech-s2-pro-weights`) — later runs
skip the download. Expect a ~30-60s cold start per run since nothing is kept
warm (scale-to-zero, per-second billing — nothing runs, nothing is billed,
while idle).

### Voice cloning (optional)

Pass a 5-30 second reference clip plus its transcript to test a custom anchor
voice:

```bash
modal run scripts/tts-sandbox/modal_app.py \
  --text-file my-script.txt \
  --ref-audio anchor-sample.wav \
  --ref-transcript "transcript of anchor-sample.wav" \
  --out test.wav
```

### Emotion / delivery tags

S2 Pro reads inline bracket tags directly in the text — no script changes
needed:

```
[happy] Markets rallied today. [pause] But not everything was green.
```

Tags layer (`[sad][whispering]`) and support free-form descriptions beyond
the common set (`[pause]`, `[emphasis]`, `[whisper]`, `[shouting]`, `[angry]`,
`[sad]`, `[happy]`). Current full list:
https://docs.fish.audio/developer-guide/core-features/emotions

## Cost tracking

Each run prints the measured GPU-seconds, the dollar cost for that run (at
Modal's L4 rate, a constant at the top of `modal_app.py` — re-check
[modal.com/pricing](https://modal.com/pricing), rates change), and a rough
monthly projection extrapolated from that one run at 50 users × 21 weekdays.
Treat the projection as a ballpark from a single sample, not a committed
estimate — run it a few times on representative script lengths before
trusting it.

## VRAM note

Modal's L4 has 24GB of VRAM. The official `fishaudio/s2-pro` checkpoint wants
~24GB, so it fits but with little headroom — if you hit an OOM, the
lower-VRAM path is an fp8-quantized community mirror (~12GB, reported as
having no perceptible quality loss); swap `HF_REPO` in `modal_app.py` to that
repo and re-run.

## Known unknowns

I couldn't execute this script myself (this session's sandbox can't reach
`modal.com`/`huggingface.co`), so the fish-speech CLI flags in
`modal_app.py` are based on published docs, not a live test run. If either
inference step in `_run_dac_inference` / `_run_text2semantic` fails on a
flag mismatch, run the underlying script with `--help` inside `modal shell
scripts/tts-sandbox/modal_app.py` to see the current flags and I'll fix it
up.
