"""
Build fine-tuning JSONL (chat format) from the doctor's-orders workbook.

Orders are grouped per admission (`ID`) and calendar day, exactly like
POST /generate-summary/batch, and the user message is built with the service's
own `build_prompt`, so training sees the production prompt. The workbook has no
admission date, so Day 1 is each admission's first order date.

  python fine_tuning_data/build_dataset.py --dump   # groups.txt for writing/reviewing summaries
  python fine_tuning_data/build_dataset.py          # train.jsonl + eval.jsonl from summaries.json
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "ai_service"))
from ollama_client import _build_group_id, _day_label, build_prompt  # noqa: E402

XLSX = HERE / "1000 DOCTORS ORDERS.xlsx"
SUMMARIES = HERE / "summaries.json"  # { group_id: approved summary }
# Whole admissions held out so evaluation sees patients the model never trained on.
EVAL_ADMISSIONS = {"2026002210", "2026002236", "2026002238"}

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def read_rows(path):
    """(admission_id, written_at, text) per row; stdlib only, no openpyxl."""
    z = zipfile.ZipFile(path)
    strings = [
        "".join(t.text or "" for t in si.iter(M + "t"))
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")
    ]
    rows = []
    for row in list(ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(M + "row"))[1:]:
        cells = {}
        for c in row.findall(M + "c"):
            v = c.find(M + "v")
            val = v.text if v is not None else ""
            cells[re.match(r"[A-Z]+", c.get("r")).group()] = strings[int(val)] if c.get("t") == "s" else val
        written_at = datetime(1899, 12, 30) + timedelta(days=float(cells["B"]))  # Excel serial date
        rows.append((cells["A"], written_at, cells["C"].strip()))
    return rows


def build_groups(rows):
    """[{group_id, admissionId, label, orders}] ordered by admission, then day."""
    buckets = defaultdict(list)
    for admission_id, written_at, text in rows:
        buckets[(admission_id, written_at.date())].append((written_at, text))
    first_day = {}
    for admission_id, day in buckets:
        first_day[admission_id] = min(first_day.get(admission_id, day), day)

    groups = []
    for (admission_id, day), members in sorted(buckets.items()):
        texts = [text for _, text in sorted(members)]
        day_number = (day - first_day[admission_id]).days + 1
        groups.append({
            "group_id": _build_group_id(admission_id, day_number),
            "admissionId": admission_id,
            "label": _day_label(admission_id, day, first_day[admission_id]),
            # same numbering as the batch endpoint
            "orders": texts[0] if len(texts) == 1 else "\n".join(f"{i}. {t}" for i, t in enumerate(texts, 1)),
        })
    return groups


def lint(summary):
    """Cheap rule checks; a clinician still reviews every summary."""
    problems = []
    if re.search(r"\bDr\.?\s", summary, re.I):
        problems.append("names a physician")
    if re.search(r"^\s*([-*•]|\d+\.)\s", summary, re.M):
        problems.append("bullet/numbered list")
    sentences = len(re.findall(r"[.!?](\s|$)", summary))
    if sentences > 8:
        problems.append(f"{sentences} sentences")
    return problems


def main():
    groups = build_groups(read_rows(XLSX))

    if "--dump" in sys.argv:
        with open(HERE / "groups.txt", "w", encoding="utf-8") as f:
            for g in groups:
                f.write(f"### {g['group_id']} | {g['label']}\n{g['orders']}\n\n")
        print(f"wrote {len(groups)} groups to groups.txt")
        return

    summaries = json.loads(SUMMARIES.read_text(encoding="utf-8"))
    missing = [g["group_id"] for g in groups if g["group_id"] not in summaries]
    unknown = set(summaries) - {g["group_id"] for g in groups}
    if missing or unknown:
        sys.exit(f"missing summaries: {missing}\nunknown group ids: {sorted(unknown)}")

    counts = {"train": 0, "eval": 0}
    with open(HERE / "train.jsonl", "w", encoding="utf-8") as train, \
            open(HERE / "eval.jsonl", "w", encoding="utf-8") as evals:
        for g in groups:
            summary = summaries[g["group_id"]].strip()
            for problem in lint(summary):
                print(f"WARN {g['group_id']}: {problem}")
            split = "eval" if g["admissionId"] in EVAL_ADMISSIONS else "train"
            record = {
                "meta": {"group_id": g["group_id"], "label": g["label"]},
                "messages": [
                    {"role": "user", "content": build_prompt(g["orders"], g["label"])},
                    {"role": "assistant", "content": summary},
                ],
            }
            (evals if split == "eval" else train).write(json.dumps(record, ensure_ascii=False) + "\n")
            counts[split] += 1
    print(f"train.jsonl: {counts['train']}  eval.jsonl: {counts['eval']}")


if __name__ == "__main__":
    main()
