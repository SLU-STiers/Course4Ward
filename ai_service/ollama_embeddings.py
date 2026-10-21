import os
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
