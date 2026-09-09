import os
import time
import numpy as np

# Set offline mode BEFORE loading any model
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

# Path to your locally downloaded model (override with EMBED_MODEL_PATH env)
EMBED_MODEL_PATH = os.getenv("EMBED_MODEL_PATH", r"C:\my_models\qwen3-embedding-0.6b")
EMBED_MODEL_NAME = os.path.basename(EMBED_MODEL_PATH.rstrip("\\/"))
DEFAULT_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "8"))

# Lazy singleton: the heavy sentence-transformers model is only imported/loaded
# once, on first use (keeps `ollama_client.py` startup fast when only chat runs).
_model = None


def get_model():
    """Load (once, cached) and return the SentenceTransformer embedding model."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer  # deferred import

        _model = SentenceTransformer(EMBED_MODEL_PATH)
    return _model


def embed_texts(texts, batch_size=DEFAULT_BATCH_SIZE, show_progress_bar=False):
    """
    Embed a list of strings.

    Returns an L2-normalized numpy array of shape (len(texts), embedding_dim).
    """
    model = get_model()
    embeddings = model.encode(
        list(texts),
        batch_size=batch_size,
        show_progress_bar=show_progress_bar,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    return np.asarray(embeddings)


def embed_one(text: str):
    """Embed a single string into a 1-D numpy vector."""
    return embed_texts([text])[0]


def cosine_similarity(vec_a, vec_b):
    """Calculate cosine similarity between two vectors (numpy arrays)."""
    dot = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

def main():
    # 1. Create sample documents.txt if it doesn't exist (same as before)
    if not os.path.exists("documents.txt"):
        print("📝 Creating sample documents.txt with medical notes...")
        with open("documents.txt", "w", encoding="utf-8") as f:
            f.write("""GS  Please facilitate STAT WAB CT with IV contrast Refer accordingly  Dr. Ong-Cunanan/langeg

Erratum on Order # 959897 IM CARDIO Please refer to Dr. Andal for joint management Dr. S.Black/ Bao-in  Addendum ABGs now instead of later Dr. S.Black/ Bao-in

IM ER # Tachycardia - ECG  # tachypnea, desaturation at room air - abg - CXR   # nausea - metoclopramide 10 mg IV   # Hypotensive  - Lipase  -Procalcitonin - Crea   will update Dr. Belvis 

IM GASTRO - PTPA  - Blood CS x 2 sites - Shift antibiotics to Piperacillin- Tazobactam 4.5 g IV then every 6 hours (to be renally adjusted)   currently considering sepsis probably from intraabdominal infection   Dr. Belvis/Agsaullo 

CARDIO Repeat HS trop i, CKMB ,  K , albumin to pre HD labs today  Transfuse 1u PRBC today during HD Transfuse another 1u PRBC during the next HD  Dr S Black/Tanding

CARDIO Noted surgical plans Transfuse 2u PRBC properly typed and crossmatched  Secure another 1u PRBC properly typed and crossmatched to be transfused during HD in AM Secure 1 u PRBC as standby  NEPHRO Decrease HD duration to 3 hours Dr Untalan/Tanding

IM CARDIO May increase hydration  For pre HD labs: CBC and K Dr S Black/Tanding  [FLUIDS & DRIPS] CENTRAL RED PORT:increase PNSS 1L to 60cc per hour BLUE PORT: fentanyl drip 10 ml/hour WHITE PORT:  Trifuse       ----Red: TPN 50cc per hour KCL drip-on hold       ----White CVP        ---Blue NTG drip: 0.1 = 3.1 ml/hour | Peripheral : Right Arm Amiodarone drip-- 10.4 ml/hour Discontinue once Heart rate is 100bpm Norepinephrine drip: OFF Dobutamine: OFF  TOTAL FLUID RATE: 133 cc per hour

GS Please schedule patient for Bogota Bag placement tomorrow, Friday, February 27, 2026 at 9AM under AA Secure consent for procedure Please inform OR PLease inform Dr. R. Tumbocon for AA Please inform APs Refer  Dr. Baldovino/Echipare""")
        print("✅ Sample file created!\n")

    # 2. Read the documents (split by double newline)
    with open("documents.txt", "r", encoding="utf-8") as f:
        content = f.read()
        documents = [doc.strip() for doc in content.split("\n\n") if doc.strip()]

    print(f"📄 Loaded {len(documents)} documents from documents.txt\n")

    # 3/4. Load the embedding model and encode all documents in one batch
    print(f"🔄 Loading embedding model from: {EMBED_MODEL_PATH}")
    print("🔄 Embedding documents...")
    total_start = time.time()
    doc_embeddings = embed_texts(documents, show_progress_bar=True)
    total_elapsed = time.time() - total_start

    # Performance summary
    print("\n" + "=" * 60)
    print("📊 EMBEDDING PERFORMANCE SUMMARY")
    print("=" * 60)
    print(f"📄 Total documents embedded: {len(documents)}")
    print(f"⏱️  Total time: {total_elapsed:.2f} seconds")
    avg_time = total_elapsed / len(documents) if documents else 0
    print(f"⚡ Average time per document: {avg_time:.4f} seconds")
    print(f"📈 Throughput: {len(documents) / total_elapsed:.2f} documents/second")
    print("=" * 60)
    print("💡 Note: Batching greatly reduces per‑document overhead compared to one‑by‑one API calls.\n")

    # 5. Interactive Query Loop
    print("🔍 RAG Retrieval Test - Type a query to find similar documents.")
    print("   (Type 'quit' or 'exit' to stop)\n")

    while True:
        query = input("Query: ").strip()
        if query.lower() in ["quit", "exit", "q"]:
            print("Goodbye!")
            break
        if not query:
            continue

        start_time = time.time()
        query_embedding = embed_one(query)
        elapsed = time.time() - start_time

        scores = []
        for idx, doc_emb in enumerate(doc_embeddings):
            sim = cosine_similarity(query_embedding, doc_emb)
            scores.append((idx, sim))

        scores.sort(key=lambda x: x[1], reverse=True)

        print(f"\n📊 Top 3 most similar documents (Query took {elapsed:.3f}s):\n")
        for rank, (idx, score) in enumerate(scores[:3], 1):
            print(f"Rank #{rank} | Similarity: {score:.4f}")
            print(f"  {documents[idx]}")
            print("-" * 60)
        print()

if __name__ == "__main__":
    main()