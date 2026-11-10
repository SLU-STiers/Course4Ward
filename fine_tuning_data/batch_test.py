"""Batch-test the summarizer end to end through the running ai_service.

Sends every order group in groups.txt to POST /generate-summary/batch (one
group per request, so each is timed on its own and one failure can't sink the
rest), checks each summary automatically, compares it with the approved
reference in summaries.json, and writes a CSV.

  python fine_tuning_data/batch_test.py                          # all 88 groups, base model
  python fine_tuning_data/batch_test.py --variant standard fine_tuned --eval-only
  python fine_tuning_data/batch_test.py --limit 10 --runs 3      # consistency: same group 3x
  python fine_tuning_data/batch_test.py --report                 # + batch_report.html / .pdf
  python fine_tuning_data/batch_test.py --report-from fine_tuning_data/batch_results.csv
  python fine_tuning_data/batch_test.py --self-test              # offline check of the checks

Setup: Python 3.8+, standard library only (no pip install, no venv).
Needs ai_service running (default http://localhost:8000) with Ollama behind it
serving qwen3.5:4b; --variant fine_tuned also needs the course4ward-summarizer
model imported into Ollama (its weights are not in git). --self-test and
--report-from need neither. A full 88-group run takes about 30-60 minutes.
Exit code 1 when any summary fails a hard check, so it can gate a model change.

Hard checks (FAIL): call failed/empty, bullet or numbered list, a physician
name ("Dr."), present tense ("is receiving"), a number that appears nowhere in
the orders (likely invented dose).
Soft checks (WARN): future/imperative wording, a sentence over 35 words.
All 88 approved references pass every hard check, so a FAIL is the model's.

Metrics: time, sentences, words, number coverage (share of the orders' doses/
rates/counts kept: a completeness proxy) and ROUGE-1 F1 against the reference.
"""
import argparse
import csv
import html
import json
import re
import shutil
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Same held-out admissions as build_dataset.py: the fine-tuned model never saw them.
EVAL_ADMISSIONS = {"2026002210", "2026002236", "2026002238"}

HEADER = re.compile(r"^### (\S+) \| Day (\d+) of Admission #(\S+) \((\d{4}-\d{2}-\d{2})\)")
ORDER_START = re.compile(r"^(\d+)\. (.*)")
NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
WORD = re.compile(r"[a-z0-9]+(?:[.'/-][a-z0-9]+)*")
# "is given", "are being monitored", "is receiving", "currently" — the prompt
# demands past tense, so these mean the model drifted into present tense.
PRESENT_TENSE = re.compile(
    r"\b(?:is|are)\s+(?:being\s+|currently\s+|still\s+)?\w+(?:ed|en|ing)\b|\bcurrently\b", re.I)
SENTENCE_END = re.compile(r"(?<!\b[A-Z])(?<!\bDr)(?<!\bvs)[.!?](?:\s+|$)")


# ------------------------------------------------------------------ data
def load_groups(path):
    """groups.txt -> [{group_id, admission_id, day, date, orders: [str]}].

    A line starting "N. " begins an order; any other non-blank line continues
    the previous one (orders can span lines). A single-order group is dumped
    without the "1. " prefix, so a group's first line always opens an order.
    """
    groups = []
    for line in path.read_text(encoding="utf-8").splitlines():
        header = HEADER.match(line)
        if header:
            gid, day, adm, iso = header.groups()
            groups.append({"group_id": gid, "admission_id": adm, "day": int(day),
                           "date": iso, "orders": []})
            continue
        if not groups or not line.strip():
            continue
        start = ORDER_START.match(line)
        # ponytail: a continuation line that itself starts "N. " would split an
        # order in two; harmless for testing (same text, same day), fix if it matters.
        if start or not groups[-1]["orders"]:
            groups[-1]["orders"].append(start.group(2) if start else line)
        else:
            groups[-1]["orders"][-1] += "\n" + line
    return groups


def request_body(group, variant, temperature):
    """The camelCase payload the backend sends, for a single admission-day."""
    admitted = date.fromisoformat(group["date"]) - timedelta(days=group["day"] - 1)
    return {
        "temperature": temperature,
        "variant": variant,
        "admissions": [{
            "admissionId": group["admission_id"],
            "admissionDate": admitted.isoformat(),
            "orders": [
                {"id": f"{group['group_id']}-{i}", "text": text, "dateCreated": group["date"]}
                for i, text in enumerate(group["orders"], start=1)
            ],
        }],
    }


def post_json(url, body, timeout):
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------------------------------------------------------------- checks
def numbers_in(text):
    """Every number as a float, so "1,000" == "1000" and "4.50" == "4.5"."""
    found = set()
    for raw in NUMBER.findall(text):
        try:
            found.add(float(raw.replace(",", "")))
        except ValueError:
            # "2.19.26"-style dates: keep each part
            found.update(float(part) for part in re.split(r"[.,]", raw) if part)
    return found


def sentences(text):
    return [s for s in SENTENCE_END.split(text.strip()) if s.strip()]


def check(summary, orders_text, allowed_numbers=()):
    """-> (fails, warns, metrics). Pure function: the offline self-test drives it."""
    fails, warns = [], []
    summary = (summary or "").strip()
    if not summary:
        return ["empty summary"], [], {}

    if re.search(r"^\s*([-*•]|\d+[.)])\s", summary, re.M):
        fails.append("bullet/numbered list")
    if re.search(r"\bDra?\.\s", summary):
        fails.append("physician name (Dr.)")

    source = numbers_in(orders_text) | set(allowed_numbers)
    # Also accept digits that appear literally in the orders: they glue tokens
    # ("d5050" -> summary "D50/50"), which splits the numbers differently.
    invented = sorted(n for n in numbers_in(summary) - source if f"{n:g}" not in orders_text)
    if invented:
        fails.append("numbers not in orders: " + ", ".join(f"{n:g}" for n in invented))

    present = PRESENT_TENSE.findall(summary)
    if present:  # none of the 88 approved references trips this, so it is a hard fail
        fails.append("present tense: " + ", ".join(sorted({p.lower() for p in present})[:3]))
    if re.search(r"\b(will|please|kindly)\b", summary, re.I):
        warns.append("future/imperative wording")
    sents = sentences(summary)
    long_ones = [len(s.split()) for s in sents if len(s.split()) > 35]
    if long_ones:
        warns.append(f"{len(long_ones)} sentence(s) over 35 words")

    order_numbers = numbers_in(orders_text)
    covered = len(order_numbers & numbers_in(summary))
    return fails, warns, {
        "sentences": len(sents),
        "words": len(summary.split()),
        # Completeness proxy: share of the orders' numbers (doses, rates, counts) kept.
        "number_coverage": round(covered / len(order_numbers), 2) if order_numbers else None,
    }


def similarity(a, b):
    """ROUGE-1 F1 against the approved reference, 0..1: shared words, any order.

    Order-sensitive matching (difflib) scores two correct summaries near 0 when
    they merely arrange the same orders differently.
    """
    a, b = WORD.findall((a or "").lower()), WORD.findall((b or "").lower())
    if not a or not b:
        return None
    overlap = sum((Counter(a) & Counter(b)).values())
    precision, recall = overlap / len(a), overlap / len(b)
    return round(2 * precision * recall / (precision + recall), 2) if overlap else 0.0


def pct(values, q):
    values = sorted(values)
    return values[min(len(values) - 1, round(q * (len(values) - 1)))]


# ------------------------------------------------------------------- run
def main():
    # A cp1252 Windows console (or a redirect) must not crash on a stray character in a summary.
    sys.stdout.reconfigure(errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8000", help="ai_service base URL")
    ap.add_argument("--variant", nargs="+", default=["standard"], choices=["standard", "fine_tuned"])
    ap.add_argument("--groups", default=str(HERE / "groups.txt"))
    ap.add_argument("--references", default=str(HERE / "summaries.json"))
    ap.add_argument("--only", nargs="+", metavar="GROUP_ID", help="test just these group ids")
    ap.add_argument("--eval-only", action="store_true", help="only the held-out eval admissions")
    ap.add_argument("--limit", type=int, help="first N groups")
    ap.add_argument("--runs", type=int, default=1, help="repeat each group N times")
    ap.add_argument("--temperature", type=float, default=0.1)
    ap.add_argument("--timeout", type=int, default=600, help="seconds per request")
    ap.add_argument("--out", default=str(HERE / "batch_results.csv"))
    ap.add_argument("--report", nargs="?", const=str(HERE / "batch_report.html"), metavar="HTML",
                    help="also write a printable report (+ PDF when Edge/Chrome is installed)")
    ap.add_argument("--report-from", metavar="CSV",
                    help="build the report from an earlier run's CSV instead of calling the service")
    ap.add_argument("--self-test", action="store_true", help="run the offline checks and exit")
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return 0

    ref_path = Path(args.references)
    references = json.loads(ref_path.read_text(encoding="utf-8")) if ref_path.exists() else {}

    if args.report_from:
        rows = read_rows(args.report_from)
        if not rows:
            print(f"{args.report_from} has no results.")
            return 1
        write_report(rows, args.report or str(HERE / "batch_report.html"), references,
                     {"Source": f"Earlier run: {Path(args.report_from).name}",
                      "Summaries tested": len(rows),
                      "Order groups": len({r["group_id"] for r in rows})})
        return 0

    groups = load_groups(Path(args.groups))
    if args.eval_only:
        groups = [g for g in groups if g["admission_id"] in EVAL_ADMISSIONS]
    if args.only:
        groups = [g for g in groups if g["group_id"] in set(args.only)]
    if args.limit:
        groups = groups[: args.limit]
    if not groups:
        print("No groups selected.")
        return 1

    base = args.url.rstrip("/")
    try:
        health = json.loads(urllib.request.urlopen(base + "/health", timeout=10).read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"ai_service not reachable at {base}/health: {exc}")
        return 1

    total = len(groups) * len(args.variant) * args.runs
    print(f"Testing {len(groups)} group(s) x {len(args.variant)} variant(s) x {args.runs} run(s) = {total} calls\n")

    rows, n = [], 0
    for variant in args.variant:
        for group in groups:
            orders_text = "\n".join(group["orders"])
            for run in range(1, args.runs + 1):
                n += 1
                started = time.time()
                summary, error, service_s = None, None, None
                try:
                    data = post_json(base + "/generate-summary/batch",
                                     request_body(group, variant, args.temperature), args.timeout)
                    result = data["results"][0]
                    summary, error = result.get("summary"), result.get("error")
                    service_s = result.get("processing_time_seconds")
                except Exception as exc:  # report and keep going: one bad call must not stop the batch
                    error = f"{type(exc).__name__}: {exc}"
                wall = round(time.time() - started, 2)

                # The label ("Day 2 of Admission #...") is in the prompt, so its numbers are fair game.
                fails, warns, metrics = check(
                    summary, orders_text,
                    allowed_numbers=numbers_in(f"{group['day']} {group['admission_id']} {group['date']}"),
                )
                if error:
                    fails.insert(0, f"error: {error}")
                status = "FAIL" if fails else ("WARN" if warns else "PASS")
                sim = similarity(summary, references.get(group["group_id"]))

                print(f"[{n}/{total}] {status:4} {variant:10} {group['group_id']:22} "
                      f"{service_s if service_s is not None else wall:>6}s"
                      f"  sim={sim if sim is not None else '-'}  {'; '.join(fails + warns)}")
                rows.append({
                    "variant": variant, "group_id": group["group_id"], "run": run,
                    "status": status, "orders": len(group["orders"]),
                    "seconds": service_s if service_s is not None else wall, "wall_seconds": wall,
                    "sentences": metrics.get("sentences"), "words": metrics.get("words"),
                    "number_coverage": metrics.get("number_coverage"),
                    "reference_similarity": sim,
                    "fails": " | ".join(fails), "warns": " | ".join(warns),
                    "summary": summary or "",
                })

    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    print_report(rows, args.variant)
    print(f"\nWrote {args.out}")
    if args.report:
        models = {"standard": health.get("model"), "fine_tuned": health.get("fine_tuned_model")}
        write_report(rows, args.report, references, {
            "AI service": base,
            "Models": ", ".join(f"{VARIANT_LABELS[v]}: {models.get(v) or '?'}" for v in args.variant),
            "Order groups": f"{len(groups)} ({'held-out eval admissions only' if args.eval_only else 'from groups.txt'})",
            "Runs per group": args.runs,
            "Temperature": args.temperature,
            "Summaries tested": len(rows),
        })
    return 1 if any(r["status"] == "FAIL" for r in rows) else 0


METRICS = [("sentences", "Sentences"), ("words", "Words"),
           ("number_coverage", "Number coverage"), ("reference_similarity", "ROUGE-1 vs reference")]


def variant_stats(rows, variant):
    """One variant's totals, shared by the console summary and the report."""
    mine = [r for r in rows if r["variant"] == variant]
    ok = [r for r in mine if not r["fails"].startswith("error")]
    times = [r["seconds"] for r in ok if r["seconds"] is not None]
    reasons = Counter(
        reason.split(":")[0] for r in mine for reason in filter(None, r["fails"].split(" | ")))
    warn_reasons = Counter(
        reason.split(":")[0] for r in mine for reason in filter(None, r["warns"].split(" | ")))
    metrics = {}
    for field, _ in METRICS:
        values = [r[field] for r in ok if r[field] is not None]
        if values:
            metrics[field] = (statistics.mean(values), min(values), max(values))
    return {
        "calls": len(mine),
        "pass": sum(r["status"] == "PASS" for r in mine),
        "warn": sum(r["status"] == "WARN" for r in mine),
        "fail": sum(r["status"] == "FAIL" for r in mine),
        "time": (statistics.mean(times), statistics.median(times), pct(times, 0.95), max(times))
        if times else None,
        "metrics": metrics,
        "fail_reasons": reasons.most_common(),
        "warn_reasons": warn_reasons.most_common(),
    }


def print_report(rows, variants):
    print("\n" + "=" * 72)
    for variant in variants:
        s = variant_stats(rows, variant)
        print(f"\n{variant}")
        print(f"  calls        {s['calls']}   PASS {s['pass']}   WARN {s['warn']}   FAIL {s['fail']}")
        if s["time"]:
            print("  time (s)     avg {:.1f}   median {:.1f}   p95 {:.1f}   max {:.1f}".format(*s["time"]))
        for field, label in METRICS:
            if field in s["metrics"]:
                print("  {:15} avg {:.2f}   min {:g}   max {:g}".format(label, *s["metrics"][field]))
        for key, count in s["fail_reasons"]:
            print(f"  FAIL x{count:<4} {key}")


# ---------------------------------------------------------------- report
VARIANT_LABELS = {"standard": "Base model (with RAG)", "fine_tuned": "Fine-tuned model"}


def read_rows(path):
    """batch_results.csv -> rows with the numeric columns back as numbers."""
    def num(value):
        return float(value) if value not in ("", None) else None

    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        for field in ("seconds", "wall_seconds", "sentences", "words",
                      "number_coverage", "reference_similarity"):
            r[field] = num(r.get(field))
    return rows


def write_report(rows, path, references, meta):
    """Printable HTML report (A4, prints cleanly); also a PDF when Edge/Chrome is installed."""
    esc = html.escape
    variants = list(dict.fromkeys(r["variant"] for r in rows))
    generated = time.strftime("%Y-%m-%d %H:%M")

    def fmt(value, digits=2):
        return "—" if value is None else f"{value:.{digits}f}".rstrip("0").rstrip(".")

    def tile(label, value, hint=""):
        return (f'<div class="tile"><span class="k">{esc(label)}</span>'
                f'<span class="v">{esc(str(value))}</span><span class="h">{esc(hint)}</span></div>')

    sections = []
    for variant in variants:
        s = variant_stats(rows, variant)
        rate = f"{round(100 * s['pass'] / s['calls'])}%" if s["calls"] else "—"
        t = s["time"]
        m = s["metrics"]
        tiles = "".join([
            tile("Summaries", s["calls"], f"{s['fail']} failed · {s['warn']} warned"),
            tile("Pass rate", rate, "no FAIL and no WARN"),
            tile("Typical time", f"{fmt(t[1], 1)} s" if t else "—", f"p95 {fmt(t[2], 1)} s" if t else ""),
            tile("Coverage", fmt(m.get("number_coverage", (None,))[0]), "of the orders' numbers kept"),
            tile("ROUGE-1", fmt(m.get("reference_similarity", (None,))[0]), "word overlap with reference"),
            tile("Length", f"{fmt(m.get('words', (None,))[0], 0)} words",
                 f"{fmt(m.get('sentences', (None,))[0], 1)} sentences"),
        ])
        timing = ("<tr><td>Average</td><td>{:.1f} s</td></tr><tr><td>Median</td><td>{:.1f} s</td></tr>"
                  "<tr><td>95th percentile</td><td>{:.1f} s</td></tr><tr><td>Slowest</td><td>{:.1f} s</td></tr>"
                  .format(*t)) if t else '<tr><td colspan="2">No successful calls.</td></tr>'
        metric_rows = "".join(
            f"<tr><td>{esc(label)}</td><td>{fmt(m[f][0])}</td><td>{fmt(m[f][1])}</td><td>{fmt(m[f][2])}</td></tr>"
            for f, label in METRICS if f in m)
        reasons = "".join(f"<tr><td>FAIL</td><td>{esc(k)}</td><td>{c}</td></tr>" for k, c in s["fail_reasons"])
        reasons += "".join(f"<tr><td>WARN</td><td>{esc(k)}</td><td>{c}</td></tr>" for k, c in s["warn_reasons"])
        sections.append(f"""
<section>
  <h2>{esc(VARIANT_LABELS.get(variant, variant))}</h2>
  <div class="tiles">{tiles}</div>
  <div class="cols">
    <div><h3>Processing time</h3>
      <p class="desc">Time the AI service spent writing one summary, over successful calls.
      "Median" is the typical call; "95th percentile" is the slow end that 1 call in 20 exceeds.</p>
      <table>{timing}</table></div>
    <div><h3>Quality measures</h3>
      <p class="desc">Averages with the lowest and highest value seen across the summaries.</p>
      <table><tr><th>Measure</th><th>Avg</th><th>Min</th><th>Max</th></tr>{metric_rows}</table></div>
  </div>
  <h3>Problems found</h3>
  <p class="desc">How often each check tripped. One summary can trip several.</p>
  <table><tr><th>Level</th><th>Check</th><th>Summaries</th></tr>
  {reasons or '<tr><td colspan="3">No problems found.</td></tr>'}</table>
</section>""")

    result_rows = "".join(
        f'<tr class="{r["status"].lower()}"><td>{esc(r["group_id"])}</td>'
        f'<td>{"Fine-tuned" if r["variant"] == "fine_tuned" else "Base"}</td><td>{esc(str(r["run"]))}</td>'
        f'<td><b>{r["status"]}</b></td><td>{esc(str(r["orders"]))}</td><td>{fmt(r["seconds"], 1)}</td>'
        f'<td>{fmt(r["words"], 0)}</td><td>{fmt(r["number_coverage"])}</td><td>{fmt(r["reference_similarity"])}</td>'
        f'<td>{esc("; ".join(filter(None, [r["fails"], r["warns"]])).replace(" | ", "; "))}</td></tr>'
        for r in rows)

    appendix = "".join(
        f'<div class="sample"><h4>{esc(r["group_id"])} · {esc(VARIANT_LABELS.get(r["variant"], r["variant"]))}'
        f' · run {esc(str(r["run"]))} · <span class="{r["status"].lower()}">{r["status"]}</span></h4>'
        f'<p class="lbl">Generated</p><p>{esc(r["summary"]) or "<i>No summary returned.</i>"}</p>'
        + (f'<p class="lbl">Approved reference</p><p class="ref">{esc(references[r["group_id"]])}</p>'
           if r["group_id"] in references else "")
        + "</div>"
        for r in rows)

    setup = "".join(f"<tr><td>{esc(k)}</td><td>{esc(str(v))}</td></tr>" for k, v in meta.items())

    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Summarization Batch Test Report</title>
<style>
  @page {{ size: A4; margin: 16mm 14mm; }}
  body {{ font: 10.5pt/1.45 "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; margin: 24px auto; max-width: 900px; padding: 0 16px; background: #fff; }}
  h1 {{ font-size: 20pt; margin: 0; }} h2 {{ font-size: 14pt; margin: 26px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }}
  h3 {{ font-size: 11pt; margin: 14px 0 2px; }} h4 {{ font-size: 10pt; margin: 0 0 4px; }}
  .sub, .desc {{ color: #475569; }} .desc {{ font-size: 9pt; margin: 0 0 6px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 9pt; }}
  th, td {{ text-align: left; padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }}
  th {{ color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 7.5pt; letter-spacing: .04em; }}
  .tiles {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0; }}
  .tile {{ border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; }}
  .tile .k {{ font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: #64748b; font-weight: 600; }}
  .tile .v {{ font-size: 15pt; font-weight: 800; }} .tile .h {{ font-size: 8pt; color: #64748b; }}
  .cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
  .fail b, span.fail {{ color: #b91c1c; }} .warn b, span.warn {{ color: #b45309; }} .pass b, span.pass {{ color: #15803d; }}
  /* Samples may be a page long, so they split; only their headings stay with the text. */
  .sample {{ border-top: 1px solid #e2e8f0; padding: 8px 0 2px; margin: 6px 0; }}
  .sample p {{ margin: 0 0 6px; font-size: 9pt; }} .lbl {{ font-size: 7.5pt !important; text-transform: uppercase; color: #64748b; font-weight: 600; }}
  h2, h3, h4, .lbl {{ break-after: avoid; }} .ref {{ color: #475569; }}
  tr, .tiles, .cols > div {{ break-inside: avoid; }}
  .results td:first-child, .results th {{ white-space: nowrap; }}
  .appendix {{ break-before: page; }}
  @media (max-width: 640px) {{ .tiles {{ grid-template-columns: repeat(2, 1fr); }} .cols {{ grid-template-columns: 1fr; }} }}
</style></head><body>
<h1>Summarization Batch Test Report</h1>
<p class="sub">Course4Ward · SLU Sacred Heart CIMS · AI service · Generated {generated}</p>
<p>This report tests how well the AI writes "Course in the Ward" summaries. Real physician
orders, grouped per admission day exactly as the system does, were sent to the AI service and
every summary was checked automatically, timed, and compared with the summary a physician
approved for the same orders.</p>

<h2>Test setup</h2>
<table>{setup}</table>

<h2>How to read this report</h2>
<table>
<tr><th>Result</th><th>Meaning</th></tr>
<tr class="pass"><td><b>PASS</b></td><td>No problem found.</td></tr>
<tr class="warn"><td><b>WARN</b></td><td>Usable, but worth a look: future or imperative wording ("will", "please"), or a sentence over 35 words.</td></tr>
<tr class="fail"><td><b>FAIL</b></td><td>Breaks a rule the summary must follow: the call failed or returned nothing; a bullet or numbered list;
a physician's name; present tense ("is receiving") instead of past tense; or a number that appears nowhere in the
orders, which usually means an invented dose.</td></tr>
</table>
<p class="desc">Every approved reference summary passes all FAIL checks, so a FAIL points at the AI, not the test.
<b>Number coverage</b> is the share of the orders' numbers (doses, rates, counts) that the summary kept: a rough
measure of completeness. <b>ROUGE-1</b> is the share of words the summary shares with the approved reference
(0 = nothing in common, 1 = same words); around 0.5 is typical for two correct summaries worded differently.</p>
{''.join(sections)}

<h2>All results</h2>
<table class="results"><tr><th>Group</th><th>Model</th><th>Run</th><th>Result</th><th>Orders</th><th>Time (s)</th>
<th>Words</th><th>Coverage</th><th>ROUGE-1</th><th>Issues</th></tr>{result_rows}</table>

<div class="appendix"><h2>Appendix: generated summaries</h2>
<p class="desc">Each generated summary next to the physician-approved reference for the same orders.</p>
{appendix}</div>
</body></html>"""

    path = Path(path)
    path.write_text(page, encoding="utf-8")
    print(f"Wrote {path}")
    pdf = to_pdf(path)
    if pdf:
        print(f"Wrote {pdf}")
    else:
        print("No Edge/Chrome found for PDF: open the HTML and print it (Ctrl+P -> Save as PDF).")


def to_pdf(html_path):
    """HTML -> PDF with a headless Edge/Chrome, if one is installed. None otherwise."""
    candidates = [shutil.which(n) for n in ("msedge", "chrome", "google-chrome", "chromium")] + [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    browser = next((c for c in candidates if c and Path(c).exists()), None)
    if not browser:
        return None
    pdf = html_path.with_suffix(".pdf")
    try:
        subprocess.run([browser, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                        "--print-to-pdf-no-header", f"--print-to-pdf={pdf}", html_path.resolve().as_uri()],
                       check=True, timeout=120, capture_output=True)
    except (subprocess.SubprocessError, OSError):
        return None
    return pdf if pdf.exists() else None


def self_test():
    """Offline: the parser and the checks, no service needed."""
    sample = HERE / "_selftest_groups.txt"
    sample.write_text(
        "### 1-day-2 | Day 2 of Admission #1 (2026-03-10)\n"
        "1. Start Ceftriaxone 2 g IV q24h\n"
        "continue 1,000 ml PNSS\n"
        "2. CBC, Crea\n"
        "### 1-day-3 | Day 3 of Admission #1 (2026-03-11)\n"
        "Single order, no number prefix\n", encoding="utf-8")
    try:
        g, single = load_groups(sample)
    finally:
        sample.unlink()
    assert g["group_id"] == "1-day-2" and g["day"] == 2 and len(g["orders"]) == 2, g
    assert single["orders"] == ["Single order, no number prefix"], single
    assert "1,000 ml" in g["orders"][0]
    body = request_body(g, "standard", 0.1)
    assert body["admissions"][0]["admissionDate"] == "2026-03-09"

    orders = "\n".join(g["orders"])
    good = "Ceftriaxone 2 g IV q24h was started and 1000 ml PNSS was continued. CBC and creatinine were requested."
    assert check(good, orders)[0] == [], check(good, orders)
    assert any("numbers not in orders: 500" in f for f in check("Ceftriaxone 500 mg was given.", orders)[0])
    assert check("D50/50 was given.", "give 1 vial d5050")[0] == []
    assert "physician name (Dr.)" in check("Dr. Cruz was consulted.", orders)[0]
    assert "bullet/numbered list" in check("- Ceftriaxone 2 g was started.", orders)[0]
    assert check("", orders)[0] == ["empty summary"]
    assert check("Labs will be requested.", orders)[1] == ["future/imperative wording"]
    assert check(good, orders)[2]["number_coverage"] == 1.0
    assert any(f.startswith("present tense") for f in check("The patient is receiving IV fluids.", orders)[0])
    assert similarity("a b c", "c b a") == 1.0  # word order does not matter
    assert similarity("a b", "c d") == 0.0
    print("self-test OK")


if __name__ == "__main__":
    sys.exit(main())
