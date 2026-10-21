"""Run the base and fine-tuned models on eval.jsonl and show both next to the reference.

Usage: python compare.py [base_model] [tuned_model]
Writes compare.md next to this file.
"""
import json
import sys
import time
from pathlib import Path

import requests

URL = "http://localhost:11434/api/chat"
BASE = sys.argv[1] if len(sys.argv) > 1 else "qwen3.5:4b"
TUNED = sys.argv[2] if len(sys.argv) > 2 else "course4ward-summarizer"
HERE = Path(__file__).parent


def run(model, messages):
    start = time.time()
    r = requests.post(URL, json={
        "model": model, "messages": messages, "stream": False, "think": False,
        "options": {"temperature": 0.1},  # matches ai_service's default
    }, timeout=300)
    r.raise_for_status()
    return r.json()["message"]["content"].strip(), time.time() - start


out = []
for line in (HERE / "eval.jsonl").read_text(encoding="utf-8").splitlines():
    row = json.loads(line)
    prompt = [m for m in row["messages"] if m["role"] != "assistant"]
    reference = next(m["content"] for m in row["messages"] if m["role"] == "assistant")
    base, tb = run(BASE, prompt)
    tuned, tt = run(TUNED, prompt)
    print(f"done: {row['meta']['label']}  base {tb:.1f}s  tuned {tt:.1f}s")
    out.append(
        f"## {row['meta']['label']}\n\n"
        f"**Reference**\n\n{reference}\n\n"
        f"**Base ({BASE}, {tb:.1f}s, {len(base.split())} words)**\n\n{base}\n\n"
        f"**Fine-tuned ({TUNED}, {tt:.1f}s, {len(tuned.split())} words)**\n\n{tuned}\n"
    )

(HERE / "compare.md").write_text("\n---\n\n".join(out), encoding="utf-8")
print("wrote", HERE / "compare.md")
