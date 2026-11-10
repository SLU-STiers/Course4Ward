"""
Build fine-tuning JSONL (chat format) from the doctor's-orders workbook.

Orders are grouped per admission (`ID`) and calendar day, exactly like
POST /generate-summary/batch, and the user message is built with the service's
own `build_prompt`, so training sees the production prompt. The workbook has no
admission date, so Day 1 is each admission's first order date.

  python fine_tuning_data/build_dataset.py --dump   # groups.txt for writing/reviewing summaries
  python fine_tuning_data/build_dataset.py          # train.jsonl + eval.jsonl from summaries.json

extra_summaries.json adds partial-day training examples: '<group_id>@N' is the
first N orders of that day, as when a physician generates a summary mid-day.
They are training-only; whole held-out admissions stay in eval.

Every summary goes through batch_test.check, the same checks the batch test
applies to model output: a hard failure stops the build.
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
# Held-out admissions and summary checks live in the batch test, so training data
# and the evaluation of trained models use the same split and the same rules.
from batch_test import EVAL_ADMISSIONS, check, numbers_in  # noqa: E402

XLSX = HERE / "1000 DOCTORS ORDERS.xlsx"
SUMMARIES = HERE / "summaries.json"  # { group_id: reference summary }
EXTRA = HERE / "extra_summaries.json"  # { summaries: { "<group_id>@N": summary } }

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
            "day": day_number,
            "date": day.isoformat(),
            "label": _day_label(admission_id, day, first_day[admission_id]),
            "texts": texts,
            "orders": number_orders(texts),
        })
    return groups


def number_orders(texts):
    """Same numbering as the batch endpoint: a lone order is sent as-is."""
    return texts[0] if len(texts) == 1 else "\n".join(f"{i}. {t}" for i, t in enumerate(texts, 1))


def partial_day(group, n):
    """The first `n` orders of a day: what a mid-day summary is generated from."""
    if not 0 < n < len(group["texts"]):
        sys.exit(f"{group['group_id']}@{n}: the day has {len(group['texts'])} orders")
    return {**group, "group_id": f"{group['group_id']}@{n}", "texts": group["texts"][:n],
            "orders": number_orders(group["texts"][:n])}


def lint(group, summary):
    """batch_test's checks against this group's orders: (hard failures, warnings)."""
    fails, warns, _ = check(
        summary, group["orders"],
        allowed_numbers=numbers_in(f"{group['day']} {group['admissionId']} {group['date']}"),
    )
    return fails, warns


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

    by_id = {g["group_id"]: g for g in groups}
    examples = [(g, summaries[g["group_id"]]) for g in groups]
    extra = json.loads(EXTRA.read_text(encoding="utf-8")) if EXTRA.exists() else {"summaries": {}}
    if extra["summaries"] and not extra.get("reviewed"):
        print(f"NOTE {EXTRA.name} is not marked reviewed: a clinician should check it before training.")
    for key, summary in extra["summaries"].items():
        group_id, _, n = key.partition("@")
        if group_id not in by_id or not n.isdigit():
            sys.exit(f"{EXTRA.name}: {key!r} is not '<group_id>@<number of orders>'")
        if by_id[group_id]["admissionId"] in EVAL_ADMISSIONS:
            sys.exit(f"{EXTRA.name}: {key} is from a held-out admission; that would leak eval data")
        examples.append((partial_day(by_id[group_id], int(n)), summary))

    failed, long_days = [], 0
    counts = {"train": 0, "eval": 0}
    with open(HERE / "train.jsonl", "w", encoding="utf-8") as train, \
            open(HERE / "eval.jsonl", "w", encoding="utf-8") as evals:
        for g, summary in examples:
            summary = summary.strip()
            fails, warns = lint(g, summary)
            for problem in warns:
                if problem.startswith("more than"):
                    long_days += 1  # long busy days are expected; counted, not listed
                else:
                    print(f"WARN {g['group_id']}: {problem}")
            failed += [f"{g['group_id']}: {problem}" for problem in fails]
            split = "eval" if g["admissionId"] in EVAL_ADMISSIONS else "train"
            record = {
                "meta": {"group_id": g["group_id"], "label": g["label"], "orders": len(g["texts"])},
                "messages": [
                    {"role": "user", "content": build_prompt(g["orders"], g["label"])},
                    {"role": "assistant", "content": summary},
                ],
            }
            (evals if split == "eval" else train).write(json.dumps(record, ensure_ascii=False) + "\n")
            counts[split] += 1
    if failed:
        # The model learns whatever the answers do, so a broken one must not be trained on.
        for line in failed:
            print(f"FAIL {line}")
        sys.exit(f"{len(failed)} summaries fail a hard check; fix them and rebuild.")
    if long_days:
        print(f"note: {long_days} summaries have more than the batch test's sentence target (a WARN, not an error)")
    print(f"train.jsonl: {counts['train']} ({len(examples) - len(groups)} partial-day)  eval.jsonl: {counts['eval']}")


if __name__ == "__main__":
    main()
