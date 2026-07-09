"""
Sandbox: evaluate Fish Audio's S2 Pro TTS model on Modal (serverless GPU) before
deciding whether to swap it in for the podcast's OpenAI gpt-4o-mini-tts pipeline
(see ../../src/audio/tts.ts).

One-time setup on your own machine (not run from here):
    pip install modal
    modal setup          # authenticates this machine against your Modal account

Trigger a test generation:
    modal run scripts/tts-sandbox/modal_app.py --text-file my-script.txt --out test.wav

Voice cloning against a reference clip (5-30s) + its transcript:
    modal run scripts/tts-sandbox/modal_app.py --text-file my-script.txt \
        --ref-audio anchor-sample.wav --ref-transcript "transcript of anchor-sample.wav" \
        --out test.wav

Emotion/delivery control: embed inline bracket tags directly in your text file,
e.g. "[happy] Markets rallied today. [pause] But not everything was green."
S2 Pro supports layering tags like [sad][whispering] and free-form descriptive
tags; see https://docs.fish.audio/developer-guide/core-features/emotions for the
current full set — no script changes needed, tags are just part of the text.

This is a throwaway sandbox (scale-to-zero, no keep-warm) — expect a ~30-60s
cold start per run while the container loads the model. Not wired into the
production pipeline or any of src/.
"""

import pathlib
import subprocess
import time

import modal

FISH_SPEECH_DIR = "/root/fish-speech"
WEIGHTS_DIR = "/weights/s2-pro"
HF_REPO = "fishaudio/s2-pro"

# Modal's public L4 rate as of 2026-07 (modal.com/pricing) — re-check before
# trusting this for real budgeting; on-demand rates do change.
L4_COST_PER_SECOND = 0.000222

image = (
    modal.Image.from_registry("nvidia/cuda:12.1.0-devel-ubuntu22.04", add_python="3.10")
    .apt_install("git", "ffmpeg", "libsndfile1")
    .run_commands(f"git clone --depth 1 https://github.com/fishaudio/fish-speech {FISH_SPEECH_DIR}")
    .pip_install("torch", "torchaudio", extra_index_url="https://download.pytorch.org/whl/cu121")
    .run_commands(f"pip install -r {FISH_SPEECH_DIR}/requirements.txt")
    .pip_install("huggingface_hub")
)

# Persists the ~24GB checkpoint across runs so it's only downloaded once.
weights_volume = modal.Volume.from_name("fish-speech-s2-pro-weights", create_if_missing=True)

app = modal.App("fish-speech-s2-pro-sandbox")


def _ensure_weights_downloaded() -> None:
    marker = pathlib.Path(WEIGHTS_DIR) / "codec.pth"
    if marker.exists():
        return
    from huggingface_hub import snapshot_download

    snapshot_download(repo_id=HF_REPO, local_dir=WEIGHTS_DIR)
    weights_volume.commit()


def _run_dac_inference(ref_wav_path: pathlib.Path, work_dir: pathlib.Path) -> pathlib.Path:
    """Extracts VQ tokens from a reference clip for voice cloning."""
    subprocess.run(
        [
            "python",
            f"{FISH_SPEECH_DIR}/fish_speech/models/dac/inference.py",
            "-i",
            str(ref_wav_path),
            "--checkpoint-path",
            f"{WEIGHTS_DIR}/codec.pth",
        ],
        check=True,
        cwd=str(work_dir),
    )
    npy_files = list(work_dir.glob("*.npy"))
    if not npy_files:
        raise RuntimeError(
            "dac/inference.py produced no .npy token file. Its CLI flags may "
            "have changed since this script was written — run it with --help "
            "inside a `modal shell` against this image to check."
        )
    return npy_files[0]


def _run_text2semantic(text: str, prompt_args: list[str], work_dir: pathlib.Path) -> pathlib.Path:
    subprocess.run(
        [
            "python",
            f"{FISH_SPEECH_DIR}/fish_speech/models/text2semantic/inference.py",
            "--text",
            text,
            *prompt_args,
            "--checkpoint-path",
            WEIGHTS_DIR,
        ],
        check=True,
        cwd=str(work_dir),
    )
    wav_files = list(work_dir.glob("*.wav"))
    if not wav_files:
        raise RuntimeError(
            "text2semantic/inference.py produced no .wav file. Its CLI flags "
            "may have changed since this script was written — run it with "
            "--help inside a `modal shell` against this image to check."
        )
    return wav_files[0]


@app.function(image=image, gpu="L4", volumes={"/weights": weights_volume}, timeout=600)
def generate(text: str, ref_audio_bytes: bytes | None = None, ref_transcript: str | None = None) -> dict:
    start = time.monotonic()
    _ensure_weights_downloaded()

    work_dir = pathlib.Path("/tmp/tts-run")
    work_dir.mkdir(exist_ok=True)

    prompt_args: list[str] = []
    if ref_audio_bytes is not None:
        if not ref_transcript:
            raise ValueError("ref_transcript is required when ref_audio_bytes is provided")
        ref_wav_path = work_dir / "ref.wav"
        ref_wav_path.write_bytes(ref_audio_bytes)
        prompt_tokens_path = _run_dac_inference(ref_wav_path, work_dir)
        prompt_args = ["--prompt-text", ref_transcript, "--prompt-tokens", str(prompt_tokens_path)]

    out_wav_path = _run_text2semantic(text, prompt_args, work_dir)
    wav_bytes = out_wav_path.read_bytes()

    gpu_seconds = time.monotonic() - start
    cost = gpu_seconds * L4_COST_PER_SECOND
    print(f"[cost] {gpu_seconds:.1f} GPU-seconds · ${cost:.5f} for this run (L4 @ ${L4_COST_PER_SECOND}/s)")

    return {"wav_bytes": wav_bytes, "gpu_seconds": gpu_seconds, "cost": cost}


@app.local_entrypoint()
def main(text_file: str, ref_audio: str = "", ref_transcript: str = "", out: str = "./output.wav"):
    text = pathlib.Path(text_file).read_text()

    ref_audio_bytes = None
    if ref_audio:
        if not ref_transcript:
            raise ValueError("--ref-transcript is required together with --ref-audio")
        ref_audio_bytes = pathlib.Path(ref_audio).read_bytes()

    result = generate.remote(text, ref_audio_bytes, ref_transcript or None)

    out_path = pathlib.Path(out)
    out_path.write_bytes(result["wav_bytes"])
    print(f"Wrote {out_path} ({len(result['wav_bytes'])} bytes)")

    gpu_seconds = result["gpu_seconds"]
    cost = result["cost"]
    monthly_requests = 50 * 21  # 50 users x 21 weekdays/month
    projected_monthly_cost = cost * monthly_requests
    print(
        f"\nThis run: {gpu_seconds:.1f} GPU-seconds, ${cost:.5f}\n"
        f"Extrapolated to {monthly_requests} requests/month "
        f"(50 users x 21 weekdays, assuming this run is representative): "
        f"${projected_monthly_cost:.2f}/month\n"
        f"This is a rough extrapolation from a single sample run, not a "
        f"guarantee — actual per-request time varies with cold-start "
        f"frequency and text length."
    )
