"""Print one sample RAG retrieval, the way the backend does it, for a figure.

Embeds the approved corpus (orders of every group in summaries.json) through the
running ai_service /embed, embeds one group's orders as a single query, ranks
every corpus order by cosine similarity, groups the hits per summary and keeps
the top 3 summaries with up to 3 source orders each (as retrieveReferences).
Only other admissions or earlier days of the same admission can be retrieved.

For each match it also prints the shared clinical terms (drugs, tests,
procedures learned from the orders) to explain *why* it scored as similar.

Needs: Python 3.8+, batch_test.py + groups.txt + summaries.json in this folder,
ai_service running with the embedding model (Ollama is not needed).

    python rag_sample.py                      # first group that has references
    python rag_sample.py --group 2026001763-day-2
    python rag_sample.py --group 2026001763-day-2 --out sample.md
"""
import argparse
import json
import sys
from pathlib import Path

from batch_test import HERE, RAG_LIMIT, RAG_ORDERS, embed, load_groups, order_terms, terms


def retrieve(index, group, query, limit=RAG_LIMIT):
    """batch_test.retrieve, but keeping each source order's own similarity."""
    scored = sorted(
        ((sum(a * b for a, b in zip(query, vec)), g, text) for g, text, vec in index
         if g["admission_id"] != group["admission_id"] or g["day"] < group["day"]),
        key=lambda item: -item[0])[: limit * 8]
    best = {}
    for sim, g, text in scored:
        entry = best.setdefault(g["group_id"], {"group": g, "sim": sim, "orders": []})
        if len(entry["orders"]) < RAG_ORDERS:
            entry["orders"].append((sim, text))
    return sorted(best.values(), key=lambda e: -e["sim"])[:limit]


def main():
    sys.stdout.reconfigure(errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8000", help="ai_service base URL")
    ap.add_argument("--group", help="group id to use as the query (default: first one with hits)")
    ap.add_argument("--groups", default=str(HERE / "groups.txt"))
    ap.add_argument("--references", default=str(HERE / "summaries.json"))
    ap.add_argument("--timeout", type=int, default=600)
    ap.add_argument("--out", help="also write the sample to this Markdown file")
    args = ap.parse_args()

    groups = load_groups(Path(args.groups))
    approved = json.loads(Path(args.references).read_text(encoding="utf-8"))
    clinical = order_terms(groups)
    base = args.url.rstrip("/")

    query_group = next((g for g in groups if g["group_id"] == args.group), None) if args.group else None
    if args.group and not query_group:
        print(f"Group {args.group} not in {args.groups}.")
        return 1

    corpus = [(g, text) for g in groups if g["group_id"] in approved for text in g["orders"]]
    print(f"Embedding {len(corpus)} approved-summary orders via {base}/embed ...", file=sys.stderr)
    index = [(g, t, v) for (g, t), v in zip(corpus, embed(base, [t for _, t in corpus], args.timeout))]

    candidates = [query_group] if query_group else groups
    for g in candidates:
        query_text = "\n".join(g["orders"])
        hits = retrieve(index, g, embed(base, [query_text], args.timeout)[0])
        if hits:
            query_group = g
            break
    else:
        print("No retrievable references for that group.")
        return 1

    q_terms = terms(query_text) & clinical
    lines = [f"# Sample RAG retrieval — query group {query_group['group_id']}",
             f"Admission {query_group['admission_id']}, day {query_group['day']} ({query_group['date']})",
             "", "## Query: the day's orders (embedded together as one text)", ""]
    lines += [f"{i}. {o}" for i, o in enumerate(query_group["orders"], 1)]
    for rank, hit in enumerate(hits, 1):
        g = hit["group"]
        same = "same admission, earlier day" if g["admission_id"] == query_group["admission_id"] else "other admission"
        lines += ["", f"## Reference {rank}: summary {g['group_id']} — similarity {hit['sim']:.4f}",
                  f"Admission {g['admission_id']}, day {g['day']} ({same})", "", "Matching source orders:"]
        shared_all = set()
        for sim, text in hit["orders"]:
            shared = sorted(terms(text) & q_terms)
            shared_all |= set(shared)
            lines.append(f"- [{sim:.4f}] {text}")
            lines.append(f"  shared terms: {', '.join(shared) or '(none - matched on wording/structure)'}")
        lines += ["", "Approved summary given to the model as an example:", "", f"> {approved[g['group_id']]}", "",
                  f"Why similar: cosine {hit['sim']:.4f}; shares {len(shared_all)} clinical term(s) with the query"
                  + (f" ({', '.join(sorted(shared_all))})" if shared_all else "")
                  + "; closeness also comes from the same order type and phrasing (doses, routes, frequencies)."]

    text = "\n".join(lines)
    print(text)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
        print(f"\nWrote {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
