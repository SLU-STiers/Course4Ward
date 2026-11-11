"""Batch-test the summarizer end to end through the running ai_service.

Sends every order group in groups.txt to POST /generate-summary/batch (one
group per request, so each is timed on its own and one failure can't sink the
rest), checks each summary automatically, compares it with the approved
reference in summaries.json, and writes a CSV.

  python fine_tuning_data/batch_test.py                          # all 109 groups, base model
  python fine_tuning_data/batch_test.py --variant standard fine_tuned fine_tuned_rag --eval-only
  python fine_tuning_data/batch_test.py --variant standard_no_rag standard --report   # RAG effect
  python fine_tuning_data/batch_test.py --limit 10 --runs 3      # consistency: same group 3x
  python fine_tuning_data/batch_test.py --report                 # + batch_report.html / .pdf
  python fine_tuning_data/batch_test.py --report-from fine_tuning_data/batch_results.csv
  python fine_tuning_data/batch_test.py --self-test              # offline check of the checks

Setup: Python 3.8+, standard library only (no pip install, no venv).
Needs ai_service running (default http://localhost:8000) with Ollama behind it
serving qwen3.5:4b; --variant fine_tuned also needs the course4ward-summarizer
model imported into Ollama (its weights are not in git). --self-test and
--report-from need neither. A full 109-group run takes about 40-75 minutes.
Exit code 1 when any summary fails a hard check, so it can gate a model change.

Hard checks (FAIL): call failed/empty, bullet or numbered list, a physician
name ("Dr."), present tense ("is receiving"), a number that appears nowhere in
the orders (likely invented dose).
Soft checks (WARN): future/imperative wording, more than MAX_SENTENCES sentences.
Summaries should be as short as the orders allow, but there is no hard cap on
length, so it never fails a summary; word and sentence counts are just reported.
All 109 approved references pass every hard check, so a FAIL is the model's.

Metrics: time, sentences, words, number coverage (share of the orders' doses/
rates/counts kept: a completeness proxy) and ROUGE-1, ROUGE-2 and ROUGE-L F1
against the reference.

RAG: like the backend, the standard variant gets up to 3 approved summaries of
similar orders as references (the fine-tuned one gets none, as in production;
fine_tuned_rag is the fine-tuned model given the same references, test-only;
standard_no_rag is the base model without them). The corpus is
summaries.json: every order of every group is embedded once through the
service's /embed, and a group may only retrieve what production could have
had approved by then: other admissions, or earlier days of its own. --no-rag
sends none at all. Retrieval runs for every group either way, so the report's
RAG analysis can show: the similarity of every retrieved reference, embedding
time, the effect of RAG (each with/without pair in the run, compared group by
group) and a copy check (wording and terms the summary shares with the
references but not with its orders; the no-RAG variants are the baseline).
Besides the CSV, a <out>.json with the per-variant statistics is written for
the admin dashboard.
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
# Admissions held out of fine-tuning (build_dataset.py imports this, so the two never
# disagree): 19 day-groups from 1 to 28 orders. Widened from the first three on
# 2026-11-10; a model trained before then saw 2026002052 and 2026003328, so compare
# it with --only on the first three admissions' groups instead.
EVAL_ADMISSIONS = {"2026002210", "2026002236", "2026002238", "2026002052", "2026003328",
                   "2026004012", "2026004057", "2026004133", "2026004190", "2026004215", "2026004288", "2026004306"}

# Length is a WARN past this, never a FAIL: no hard cap, just "as short as possible".
MAX_SENTENCES = 15

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


def request_body(group, variant, temperature, references=()):
    """The camelCase payload the backend sends, for a single admission-day."""
    admitted = date.fromisoformat(group["date"]) - timedelta(days=group["day"] - 1)
    return {
        "temperature": temperature,
        "variant": SERVICE_VARIANT[variant],
        "references": list(references),
        "admissions": [{
            "admissionId": group["admission_id"],
            "admissionDate": admitted.isoformat(),
            "orders": [
                {"id": f"{group['group_id']}-{i}", "text": text, "dateCreated": group["date"]}
                for i, text in enumerate(group["orders"], start=1)
            ],
        }],
    }


# Test variant -> the ai_service variant it calls; RAG_VARIANTS also get references.
SERVICE_VARIANT = {"standard": "standard", "standard_no_rag": "standard",
                   "fine_tuned": "fine_tuned", "fine_tuned_rag": "fine_tuned"}
RAG_VARIANTS = {"standard", "fine_tuned_rag"}
# (without RAG, with RAG): the report compares each pair present in a run.
RAG_PAIRS = [("standard_no_rag", "standard"), ("fine_tuned", "fine_tuned_rag")]
# A word in at least this share of approved summaries is house style ("administered"), not clinical content.
STYLE_SHARE = 0.10
RAG_LIMIT = 3          # summaries per request, as CourseInWardService.retrieveReferences
RAG_ORDERS = 3         # best-matching source orders kept per summary
EMBED_CHUNK = 64       # texts per /embed call


def embed(base, texts, timeout):
    """Texts -> L2-normalized vectors through the service's /embed."""
    vectors = []
    for i in range(0, len(texts), EMBED_CHUNK):
        vectors += post_json(base + "/embed", {"texts": texts[i:i + EMBED_CHUNK]}, timeout)["embeddings"]
    return vectors


def retrieve(index, group, query, limit=RAG_LIMIT):
    """The backend's pgvector retrieval, in memory.

    `index` is [(group, order_text, vector)] over the approved corpus. Ranks
    every order by cosine similarity (a dot product: the vectors are
    normalized), keeps the top limit*8 like the SQL, then groups them per
    summary: best similarity, up to RAG_ORDERS source orders.
    """
    scored = sorted(
        ((sum(a * b for a, b in zip(query, vec)), g, text) for g, text, vec in index
         # Only what was approved before this day: other admissions, or this one's earlier days.
         if g["admission_id"] != group["admission_id"] or g["day"] < group["day"]),
        key=lambda item: -item[0])[: limit * 8]
    best = {}
    for sim, g, text in scored:
        entry = best.setdefault(g["group_id"], {"group_id": g["group_id"], "sim": sim, "orders": []})
        if len(entry["orders"]) < RAG_ORDERS:
            entry["orders"].append(text)
    return sorted(best.values(), key=lambda e: -e["sim"])[:limit]


def rouge2_precision(generated, reference):
    """Share of the generated text's word pairs that also occur in `reference` (0..1)."""
    a, b = WORD.findall((generated or "").lower()), WORD.findall((reference or "").lower())
    if len(a) < 2 or len(b) < 2:
        return None
    pairs_a, pairs_b = Counter(zip(a, a[1:])), Counter(zip(b, b[1:]))
    return round(sum((pairs_a & pairs_b).values()) / (len(a) - 1), 2)


def style_vocabulary(references, share=STYLE_SHARE):
    """Words common to many approved summaries: wording the references are meant to teach."""
    counts = Counter(w for text in references.values() for w in set(WORD.findall(text.lower())))
    return {w for w, c in counts.items() if c >= share * len(references)}


def copied_terms(summary, orders_text, reference_texts, style):
    """Summary words that a reference has but the orders don't (and that aren't house style).

    ponytail: word-level, so a correct expansion the orders abbreviate ("creatinine"
    for "Crea") counts too; the no-RAG baseline on the same references nets that out.
    """
    own = set(WORD.findall(orders_text.lower())) | style
    in_refs = {w for text in reference_texts for w in WORD.findall(text.lower())}
    return sorted({w for w in WORD.findall((summary or "").lower()) if w in in_refs and w not in own})


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
    if present:  # none of the 109 approved references trips this, so it is a hard fail
        fails.append("present tense: " + ", ".join(sorted({p.lower() for p in present})[:3]))
    if re.search(r"\b(will|please|kindly)\b", summary, re.I):
        warns.append("future/imperative wording")
    sents = sentences(summary)
    if len(sents) > MAX_SENTENCES:
        warns.append(f"more than {MAX_SENTENCES} sentences ({len(sents)})")

    order_numbers = numbers_in(orders_text)
    covered = len(order_numbers & numbers_in(summary))
    return fails, warns, {
        "sentences": len(sents),
        "words": len(summary.split()),
        # Completeness proxy: share of the orders' numbers (doses, rates, counts) kept.
        "number_coverage": round(covered / len(order_numbers), 2) if order_numbers else None,
    }


ROUGE_KEYS = ("rouge1", "rouge2", "rougeL")


def _f1(overlap, generated_len, reference_len):
    if not overlap:
        return 0.0
    precision, recall = overlap / generated_len, overlap / reference_len
    return round(2 * precision * recall / (precision + recall), 2)


def _lcs(a, b):
    """Length of the longest common subsequence of two word lists (O(len(a) * len(b)))."""
    previous = [0] * (len(b) + 1)
    for word in a:
        current = [0]
        for j, other in enumerate(b, start=1):
            current.append(previous[j - 1] + 1 if word == other else max(previous[j], current[j - 1]))
        previous = current
    return previous[-1]


def rouge(generated, reference):
    """ROUGE-1, ROUGE-2 and ROUGE-L F1 against the reference, each 0..1.

    ROUGE-1: shared words, any order. ROUGE-2: shared word pairs, so it rewards
    keeping phrases together ("600 mg IV"). ROUGE-L: the longest run of words in
    the same order (gaps allowed), so it rewards keeping the reference's sequence.
    None for all three when either text is empty.
    """
    a, b = WORD.findall((generated or "").lower()), WORD.findall((reference or "").lower())
    if not a or not b:
        return dict.fromkeys(ROUGE_KEYS)
    pairs_a, pairs_b = Counter(zip(a, a[1:])), Counter(zip(b, b[1:]))
    return {
        "rouge1": _f1(sum((Counter(a) & Counter(b)).values()), len(a), len(b)),
        "rouge2": _f1(sum((pairs_a & pairs_b).values()), max(1, len(a) - 1), max(1, len(b) - 1)),
        "rougeL": _f1(_lcs(a, b), len(a), len(b)),
    }


def pct(values, q):
    values = sorted(values)
    return values[min(len(values) - 1, round(q * (len(values) - 1)))]


# ------------------------------------------------------------------- run
def main():
    # A cp1252 Windows console (or a redirect) must not crash on a stray character in a summary.
    sys.stdout.reconfigure(errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8000", help="ai_service base URL")
    ap.add_argument("--variant", nargs="+", default=["standard"], choices=list(SERVICE_VARIANT))
    ap.add_argument("--groups", default=str(HERE / "groups.txt"))
    ap.add_argument("--references", default=str(HERE / "summaries.json"))
    ap.add_argument("--only", nargs="+", metavar="GROUP_ID", help="test just these group ids")
    ap.add_argument("--eval-only", action="store_true", help="only the held-out eval admissions")
    ap.add_argument("--limit", type=int, help="first N groups")
    ap.add_argument("--runs", type=int, default=1, help="repeat each group N times")
    ap.add_argument("--temperature", type=float, default=0.1)
    ap.add_argument("--no-rag", action="store_true", help="no retrieval at all: no variant gets references")
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

    all_groups = groups = load_groups(Path(args.groups))
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

    # RAG corpus embedded once up front. Retrieval runs for every group, also for
    # variants that are sent no references: the copy check needs them as a baseline.
    rag = not args.no_rag
    hits_by_group, embed_meta, rag_off = {}, {}, "none (--no-rag)" if args.no_rag else "none"
    index = []
    if rag:
        corpus = [(g, text) for g in all_groups if g["group_id"] in references for text in g["orders"]]
        print(f"Embedding {len(corpus)} reference orders + {len(groups)} queries for RAG...")
        try:
            started = time.time()
            vectors = embed(base, [text for _, text in corpus], args.timeout)
            corpus_s = time.time() - started
            index = [(g, text, v) for (g, text), v in zip(corpus, vectors)]
            # One query per call, as the backend embeds one per summary: this is the real per-summary cost.
            query_s = []
            for g in groups:
                started = time.time()
                query = embed(base, ["\n".join(g["orders"])], args.timeout)[0]
                query_s.append(time.time() - started)
                hits_by_group[g["group_id"]] = retrieve(index, g, query)
            embed_meta = {
                "Embedding time (reference corpus)":
                    f"{corpus_s:.1f} s for {len(corpus)} orders, batched "
                    f"({1000 * corpus_s / max(1, len(corpus)):.0f} ms per order)",
                "Embedding time (query, per summary)":
                    f"avg {1000 * statistics.mean(query_s):.0f} ms, median {1000 * statistics.median(query_s):.0f} ms, "
                    f"max {1000 * max(query_s):.0f} ms over {len(query_s)} queries",
            }
        except Exception as exc:  # the backend also summarizes without references when retrieval fails
            rag_off = f"none: /embed failed ({type(exc).__name__}: {str(exc)[:200]})"
            print(f"RAG disabled, {rag_off}")
            rag, hits_by_group = False, {}
    style = style_vocabulary(references)

    total = len(groups) * len(args.variant) * args.runs
    print(f"Testing {len(groups)} group(s) x {len(args.variant)} variant(s) x {args.runs} run(s) = {total} calls\n")

    rows, n = [], 0
    for variant in args.variant:
        for group in groups:
            orders_text = "\n".join(group["orders"])
            hits = hits_by_group.get(group["group_id"], [])
            hit_texts = [references[h["group_id"]] for h in hits]
            refs = [{"approvedSummary": references[h["group_id"]], "sourceOrders": h["orders"],
                     "similarity": round(h["sim"], 4)} for h in hits] if variant in RAG_VARIANTS else []
            for run in range(1, args.runs + 1):
                n += 1
                started = time.time()
                summary, error, service_s = None, None, None
                try:
                    data = post_json(base + "/generate-summary/batch",
                                     request_body(group, variant, args.temperature, refs), args.timeout)
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
                scores = rouge(summary, references.get(group["group_id"]))
                shown = "/".join("-" if scores[k] is None else f"{scores[k]:.2f}" for k in ROUGE_KEYS)

                print(f"[{n}/{total}] {status:4} {variant:10} {group['group_id']:22} "
                      f"{service_s if service_s is not None else wall:>6}s"
                      f"  R1/R2/RL={shown}  RAG={len(refs)}  {'; '.join(fails + warns)}")
                rows.append({
                    "variant": variant, "group_id": group["group_id"], "run": run,
                    "status": status, "orders": len(group["orders"]),
                    "seconds": service_s if service_s is not None else wall, "wall_seconds": wall,
                    "sentences": metrics.get("sentences"), "words": metrics.get("words"),
                    "number_coverage": metrics.get("number_coverage"),
                    **scores,
                    # None (not 0) when this variant never gets references, so averages leave it out.
                    "rag_refs": len(refs) if rag and variant in RAG_VARIANTS else None,
                    "rag_similarity": refs[0]["similarity"] if refs else None,
                    "rag_mean_similarity": round(statistics.mean(r["similarity"] for r in refs), 4)
                    if refs else None,
                    # What retrieval found for this group, whether or not this variant was sent it.
                    "rag_similarities": " ".join(f"{h['sim']:.4f}" for h in hits),
                    "rag_from": " ".join(h["group_id"] for h in hits),
                    "ref_overlap": max(filter(None, (rouge2_precision(summary, t) for t in hit_texts)),
                                       default=None) if hit_texts and summary else None,
                    "copied_terms": " ".join(copied_terms(summary, orders_text, hit_texts, style))
                    if hit_texts and summary else "",
                    "fails": " | ".join(fails), "warns": " | ".join(warns),
                    "summary": summary or "",
                })

    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    print_report(rows, args.variant)
    print(f"\nWrote {args.out}")
    models = {"standard": health.get("model"), "standard_no_rag": health.get("model"),
              "fine_tuned": health.get("fine_tuned_model"), "fine_tuned_rag": health.get("fine_tuned_model")}
    sent_to = [VARIANT_LABELS[v] for v in args.variant if v in RAG_VARIANTS]
    meta = {
        "AI service": base,
        "Models": ", ".join(f"{VARIANT_LABELS[v]}: {models.get(v) or '?'}" for v in args.variant),
        "Order groups": f"{len(groups)} ({'held-out eval admissions only' if args.eval_only else 'from groups.txt'})",
        "Runs per group": args.runs,
        "Temperature": args.temperature,
        "RAG references": (f"up to {RAG_LIMIT} per summary from {len(index)} embedded orders "
                           f"({health.get('embedding_model', '?')}); sent to "
                           f"{', '.join(sent_to) or 'no variant in this run (copy-check baseline only)'}")
        if rag else rag_off,
        **embed_meta,
        "Summaries tested": len(rows),
    }
    write_stats(rows, Path(args.out).with_suffix(".json"), meta)
    if args.report:
        write_report(rows, args.report, references, meta)
    return 1 if any(r["status"] == "FAIL" for r in rows) else 0


METRICS = [("sentences", "Sentences"), ("words", "Words"),
           ("number_coverage", "Number coverage"),
           ("rouge1", "ROUGE-1"), ("rouge2", "ROUGE-2"), ("rougeL", "ROUGE-L"),
           ("rag_refs", "RAG references"), ("rag_similarity", "RAG top similarity"),
           ("rag_mean_similarity", "RAG mean similarity"), ("ref_overlap", "Reference overlap")]


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


def write_stats(rows, path, meta):
    """<out>.json: every variant's statistics, read by the admin dashboard."""
    variants = {}
    for variant in dict.fromkeys(r["variant"] for r in rows):
        s = variant_stats(rows, variant)
        variants[variant] = {
            **{k: s[k] for k in ("calls", "pass", "warn", "fail", "fail_reasons", "warn_reasons")},
            "time": dict(zip(("avg", "median", "p95", "max"), s["time"])) if s["time"] else None,
            "metrics": {k: dict(zip(("avg", "min", "max"), v)) for k, v in s["metrics"].items()},
        }
    path.write_text(json.dumps({"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                                "meta": meta, "variants": variants}, indent=2), encoding="utf-8")
    print(f"Wrote {path}")


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
VARIANT_LABELS = {"standard": "Base model (with RAG)", "standard_no_rag": "Base model (no RAG)",
                  "fine_tuned": "Fine-tuned model", "fine_tuned_rag": "Fine-tuned model (with RAG)"}
SHORT_LABELS = {"standard": "Base + RAG", "standard_no_rag": "Base", "fine_tuned": "Fine-tuned",
                "fine_tuned_rag": "Fine-tuned + RAG"}


# ------------------------------------------------------------ RAG analysis
def _floats(text):
    return [float(x) for x in (text or "").split()]


def retrieval_stats(rows):
    """Similarity of what retrieval found, once per group (it is the same for every variant)."""
    per_group = {}
    for r in rows:
        if r["rag_similarities"] and r["group_id"] not in per_group:
            per_group[r["group_id"]] = _floats(r["rag_similarities"])
    if not per_group:
        return None
    sims = list(per_group.values())
    every = [x for s in sims for x in s]
    bins = [("0.90 and above", lambda x: x >= 0.9), ("0.80 to 0.89", lambda x: 0.8 <= x < 0.9),
            ("0.70 to 0.79", lambda x: 0.7 <= x < 0.8), ("below 0.70", lambda x: x < 0.7)]
    return {
        "groups": len(sims),
        "refs_per_group": statistics.mean(len(s) for s in sims),
        "by_rank": [(rank + 1, [s[rank] for s in sims if len(s) > rank]) for rank in range(RAG_LIMIT)],
        "all": every,
        "bins": [(label, sum(map(test, every))) for label, test in bins],
    }


# (label, value of one row, decimals, direction: 1 higher is better, -1 lower is better, 0 neither)
EFFECT_MEASURES = [
    ("Pass rate (%)", lambda r: 100.0 * (r["status"] == "PASS"), 0, 1),
    ("Number coverage", lambda r: r["number_coverage"], 2, 1),
    ("ROUGE-1", lambda r: r["rouge1"], 2, 1),
    ("ROUGE-2", lambda r: r["rouge2"], 2, 1),
    ("ROUGE-L", lambda r: r["rougeL"], 2, 1),
    ("Words", lambda r: r["words"], 0, 0),
    ("Time (s)", lambda r: r["seconds"], 1, -1),
]


def rag_effect(rows, without, with_rag):
    """Each measure without vs with RAG over the groups both variants ran, compared group by group.

    -> [(label, mean_without, mean_with, difference, (better, same, worse) or None, digits)], or None.
    """
    def per_group(variant, value, include_errors):
        values = {}
        for r in rows:
            if r["variant"] != variant or (not include_errors and r["fails"].startswith("error")):
                continue
            v = value(r)
            if v is not None:
                values.setdefault(r["group_id"], []).append(v)
        return {g: statistics.mean(v) for g, v in values.items()}

    out = []
    for label, value, digits, direction in EFFECT_MEASURES:
        is_pass = label.startswith("Pass")
        a, b = per_group(without, value, is_pass), per_group(with_rag, value, is_pass)
        common = sorted(a.keys() & b.keys())
        if not common:
            continue
        mean_a, mean_b = statistics.mean(a[g] for g in common), statistics.mean(b[g] for g in common)
        tally = None
        if direction:
            deltas = [direction * (b[g] - a[g]) for g in common]
            tally = (sum(d > 1e-9 for d in deltas), sum(abs(d) <= 1e-9 for d in deltas),
                     sum(d < -1e-9 for d in deltas))
        out.append((label, mean_a, mean_b, mean_b - mean_a, tally, digits))
    return out or None


def copy_stats(rows, variant):
    """How much of a variant's wording / terms also sit in the retrieved references."""
    mine = [r for r in rows if r["variant"] == variant and r["summary"] and r["rag_from"]]
    if not mine:
        return None
    overlaps = [r["ref_overlap"] for r in mine if r["ref_overlap"] is not None]
    with_terms = [r for r in mine if r["copied_terms"]]
    terms = Counter(t for r in mine for t in r["copied_terms"].split())
    return {
        "summaries": len(mine),
        "overlap": statistics.mean(overlaps) if overlaps else None,
        "with_terms": len(with_terms),
        "terms_per_summary": statistics.mean(len(r["copied_terms"].split()) for r in mine),
        "top_terms": terms.most_common(12),
    }


def rag_section(rows, meta):
    """The report's "RAG analysis" section, or "" when the run had no retrieval."""
    esc, fmt = html.escape, fmt_number
    retrieval = retrieval_stats(rows)
    if not retrieval:
        return ""
    variants = list(dict.fromkeys(r["variant"] for r in rows))

    def stat_row(label, values):
        if not values:
            return f"<tr><td>{esc(label)}</td><td colspan='5'>—</td></tr>"
        return (f"<tr><td>{esc(label)}</td><td>{len(values)}</td><td>{fmt(statistics.mean(values))}</td>"
                f"<td>{fmt(statistics.median(values))}</td><td>{fmt(min(values))}</td><td>{fmt(max(values))}</td></tr>")

    sim_rows = "".join(stat_row(f"Reference #{rank}" + (" (top-1)" if rank == 1 else ""), values)
                       for rank, values in retrieval["by_rank"])
    sim_rows += stat_row("All references", retrieval["all"])
    total = len(retrieval["all"]) or 1
    bin_rows = "".join(f"<tr><td>{esc(label)}</td><td>{count}</td><td>{round(100 * count / total)}%</td></tr>"
                       for label, count in retrieval["bins"])
    timing = "".join(f"<tr><td>{esc(k)}</td><td>{esc(str(v))}</td></tr>"
                     for k, v in meta.items() if k.startswith("Embedding time"))

    effects = []
    for without, with_rag in RAG_PAIRS:
        if without in variants and with_rag in variants:
            result = rag_effect(rows, without, with_rag)
            if not result:
                continue
            body = "".join(
                f"<tr><td>{esc(label)}</td><td>{fmt(a, d)}</td><td>{fmt(b, d)}</td>"
                f"<td>{'+' if diff > 0 else ''}{fmt(diff, max(d, 2) if d else 0)}</td>"
                f"<td>{' / '.join(map(str, tally)) if tally else '—'}</td></tr>"
                for label, a, b, diff, tally, d in result)
            effects.append(
                f"<h3>{esc(VARIANT_LABELS[without])} vs {esc(VARIANT_LABELS[with_rag])}</h3>"
                f"<table><tr><th>Measure</th><th>Without RAG</th><th>With RAG</th><th>Difference</th>"
                f"<th>Groups better / same / worse</th></tr>{body}</table>")
    effect_html = "".join(effects) or (
        '<p class="desc">This run has no with/without pair, so the effect of RAG cannot be measured. '
        "Run Base (no RAG) with Base (with RAG), or Fine-tuned with Fine-tuned + RAG, on the same groups.</p>")

    copy_rows = ""
    for v in variants:
        c = copy_stats(rows, v)
        if not c:
            continue
        baseline = " (baseline: not sent references)" if v not in RAG_VARIANTS else ""
        terms = ", ".join(f"{t} ({n})" for t, n in c["top_terms"]) or "—"
        copy_rows += (f"<tr><td>{esc(VARIANT_LABELS.get(v, v))}{esc(baseline)}</td><td>{c['summaries']}</td>"
                      f"<td>{fmt(c['overlap'])}</td>"
                      f"<td>{c['with_terms']} ({round(100 * c['with_terms'] / c['summaries'])}%)</td>"
                      f"<td>{fmt(c['terms_per_summary'], 1)}</td><td>{esc(terms)}</td></tr>")

    return f"""
<section>
  <h2>RAG analysis</h2>
  <p class="desc">Retrieval-augmented generation (RAG) gives the model up to {RAG_LIMIT} approved summaries of
  similar orders as style examples. Retrieval embeds every order of every approved summary and ranks them by
  cosine similarity to the day's orders, exactly as the backend does with pgvector; a day can only retrieve
  other admissions or earlier days of its own admission, never its own approved summary.</p>
  <div class="cols">
    <div><h3>Retrieval similarity</h3>
      <p class="desc">Cosine similarity (0 to 1) of what retrieval found for {retrieval['groups']} order groups,
      {fmt(retrieval['refs_per_group'], 1)} references each on average. It compares embeddings, so read it as
      how close the examples were, not as a percentage of anything.</p>
      <table><tr><th>Reference</th><th>N</th><th>Avg</th><th>Median</th><th>Min</th><th>Max</th></tr>{sim_rows}</table></div>
    <div><h3>Similarity distribution</h3>
      <p class="desc">All retrieved references, by similarity band.</p>
      <table><tr><th>Similarity</th><th>References</th><th>Share</th></tr>{bin_rows}</table>
      <h3>Embedding time</h3>
      <p class="desc">The reference corpus is embedded once per run; production embeds it as orders are written.
      Each summary costs one query embedding.</p>
      <table>{timing or '<tr><td>Not measured in this run.</td></tr>'}</table></div>
  </div>
  <h3>Effect of RAG</h3>
  <p class="desc">The same order groups with and without references. Averages are over the groups both variants
  ran; "better / same / worse" counts groups where RAG raised, kept or lowered the measure (for time, faster is
  better; for length there is no better).</p>
  {effect_html}
  <h3>Copy check</h3>
  <p class="desc">References are style guidance only: the summary must not take clinical content from them.
  <b>Reference overlap</b> is the share of the summary's word pairs found in its closest reference (house style
  such as "was administered" counts too). <b>Copied terms</b> are words the summary shares with a reference but
  not with its own orders, leaving out words common to {round(100 * STYLE_SHARE)}% or more of approved summaries.
  A correct expansion of an abbreviation can count, so compare each RAG variant with its no-RAG baseline, which is
  measured against the same references it was never sent.</p>
  <table><tr><th>Model</th><th>Summaries</th><th>Reference overlap</th><th>With copied terms</th>
  <th>Terms per summary</th><th>Most frequent copied terms</th></tr>
  {copy_rows or '<tr><td colspan="6">No summaries to check.</td></tr>'}</table>
</section>"""


def fmt_number(value, digits=2):
    """`0.50` -> `0.5`, `160` -> `160`: trim trailing zeros of decimals only."""
    if value is None:
        return "—"
    text = f"{value:.{digits}f}"
    return text.rstrip("0").rstrip(".") if "." in text else text


def read_rows(path):
    """batch_results.csv -> rows with the numeric columns back as numbers."""
    def num(value):
        return float(value) if value not in ("", None) else None

    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        # CSVs from before ROUGE-2/L had ROUGE-1 only, as "reference_similarity".
        r.setdefault("rouge1", r.get("reference_similarity"))
        for field in ("rag_similarities", "rag_from", "copied_terms"):  # absent from older CSVs
            r[field] = r.get(field) or ""
        for field in ("seconds", "wall_seconds", "sentences", "words", "number_coverage", *ROUGE_KEYS,
                      "rag_refs", "rag_similarity", "rag_mean_similarity", "ref_overlap"):
            r[field] = num(r.get(field))
    return rows


def write_report(rows, path, references, meta):
    """Printable HTML report (A4, prints cleanly); also a PDF when Edge/Chrome is installed."""
    esc = html.escape
    variants = list(dict.fromkeys(r["variant"] for r in rows))
    generated = time.strftime("%Y-%m-%d %H:%M")

    fmt = fmt_number

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
            tile("ROUGE-1 / 2 / L",
                 " / ".join(fmt(m.get(k, (None,))[0]) for k in ROUGE_KEYS), "average F1 vs reference"),
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
        f'<td>{SHORT_LABELS.get(r["variant"], r["variant"])}</td><td>{esc(str(r["run"]))}</td>'
        f'<td><b>{r["status"]}</b></td><td>{esc(str(r["orders"]))}</td><td>{fmt(r["seconds"], 1)}</td>'
        f'<td>{fmt(r["words"], 0)}</td><td>{fmt(r["number_coverage"])}</td>'
        + "".join(f"<td>{fmt(r[k])}</td>" for k in ROUGE_KEYS) +
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
<tr class="warn"><td><b>WARN</b></td><td>Usable, but worth a look: future or imperative wording ("will", "please"), or more than {MAX_SENTENCES} sentences. Length is never a FAIL: there is no hard cap, summaries should just be as short as the orders allow.</td></tr>
<tr class="fail"><td><b>FAIL</b></td><td>Breaks a rule the summary must follow: the call failed or returned nothing; a bullet or numbered list;
a physician's name; present tense ("is receiving") instead of past tense; or a number that appears nowhere in the
orders, which usually means an invented dose.</td></tr>
</table>
<p class="desc">Every approved reference summary passes all FAIL checks, so a FAIL points at the AI, not the test.
<b>Number coverage</b> is the share of the orders' numbers (doses, rates, counts) that the summary kept: a rough
measure of completeness. <b>ROUGE</b> compares the summary's wording with the reference summary (F1, 0 = nothing
in common, 1 = identical): <b>ROUGE-1</b> counts shared words, <b>ROUGE-2</b> shared word pairs (keeping phrases such as
"600 mg IV" together), and <b>ROUGE-L</b> the longest run of words in the same order. ROUGE-2 and ROUGE-L are naturally
lower than ROUGE-1. All three reward shared wording, not correctness, and drop when the summary is much shorter than
its reference, so read them as a comparison between models on the same orders, not as a pass mark.</p>
{''.join(sections)}
{rag_section(rows, meta)}

<h2>All results</h2>
<table class="results"><tr><th>Group</th><th>Model</th><th>Run</th><th>Result</th><th>Orders</th><th>Time (s)</th>
<th>Words</th><th>Coverage</th><th>R-1</th><th>R-2</th><th>R-L</th><th>Issues</th></tr>{result_rows}</table>

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
    assert body["admissions"][0]["admissionDate"] == "2026-03-09" and body["references"] == []
    assert request_body(g, "fine_tuned_rag", 0.1, [{"approvedSummary": "x"}])["variant"] == "fine_tuned"
    assert request_body(g, "standard_no_rag", 0.1)["variant"] == "standard"

    # Copy check: "vancomycin" is only in the reference; "given" is house style; "ceftriaxone" is in the orders.
    assert rouge2_precision("a b c", "x a b") == 0.5
    assert copied_terms("Ceftriaxone and vancomycin were given.", "Start Ceftriaxone",
                        ["Vancomycin was given."], {"given", "was", "were", "and"}) == ["vancomycin"]
    assert style_vocabulary({"1": "was given", "2": "was started"}, share=1.0) == {"was"}

    # Effect of RAG: paired per group, direction-aware.
    def row(variant, group, status, rl, secs):
        return {"variant": variant, "group_id": group, "status": status, "fails": "", "number_coverage": None,
                "rouge1": None, "rouge2": None, "rougeL": rl, "words": None, "seconds": secs}
    effect = {e[0]: e for e in rag_effect([
        row("fine_tuned", "a", "PASS", 0.2, 10), row("fine_tuned", "b", "FAIL", 0.4, 10),
        row("fine_tuned_rag", "a", "PASS", 0.3, 12), row("fine_tuned_rag", "b", "PASS", 0.4, 8),
    ], "fine_tuned", "fine_tuned_rag")}
    assert effect["ROUGE-L"][4] == (1, 1, 0) and abs(effect["ROUGE-L"][3] - 0.05) < 1e-9, effect
    assert effect["Pass rate (%)"][1:4] == (50, 100, 50)
    assert effect["Time (s)"][4] == (1, 0, 1)  # one faster (better), one slower
    assert "Words" not in effect  # no values -> no row

    # RAG: own day and later days of the same admission are never retrieved; one entry per summary.
    other = {"group_id": "2-day-1", "admission_id": "2", "day": 1}
    index = [(g, "a", [1.0, 0.0]), (single, "b", [1.0, 0.0]),
             (other, "c", [0.6, 0.8]), (other, "d", [0.0, 1.0])]
    hits = retrieve(index, g, [1.0, 0.0])
    assert [h["group_id"] for h in hits] == ["2-day-1"] and hits[0]["orders"] == ["c", "d"], hits
    assert abs(hits[0]["sim"] - 0.6) < 1e-9
    assert [h["group_id"] for h in retrieve(index, single, [1.0, 0.0])] == ["1-day-2", "2-day-1"]

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
    eleven = " ".join(["CBC was requested."] * (MAX_SENTENCES + 1))
    assert check(eleven, orders)[1] == [f"more than {MAX_SENTENCES} sentences ({MAX_SENTENCES + 1})"]
    assert check(eleven, orders)[0] == []  # length is never a FAIL
    long_sentence = "CBC was requested " + "and repeated " * 30 + "."
    assert check(long_sentence, orders)[1] == []  # no per-sentence word limit
    assert any(f.startswith("present tense") for f in check("The patient is receiving IV fluids.", orders)[0])
    assert rouge("a b c", "c b a")["rouge1"] == 1.0  # ROUGE-1 ignores order...
    assert rouge("a b c", "c b a")["rouge2"] == 0.0  # ...ROUGE-2 needs the same pairs...
    assert rouge("a b c", "c b a")["rougeL"] == 0.33  # ...ROUGE-L the same sequence (1 of 3)
    assert rouge("a b c d", "a b x d") == {"rouge1": 0.75, "rouge2": 0.33, "rougeL": 0.75}
    assert rouge("a b", "c d") == {"rouge1": 0.0, "rouge2": 0.0, "rougeL": 0.0}
    assert rouge("", "a") == dict.fromkeys(ROUGE_KEYS)
    assert [fmt_number(160, 0), fmt_number(0.5), fmt_number(0.25), fmt_number(15.0, 1), fmt_number(None)] == \
        ["160", "0.5", "0.25", "15", "—"]  # 160 once printed as "16"
    print("self-test OK")


if __name__ == "__main__":
    sys.exit(main())
