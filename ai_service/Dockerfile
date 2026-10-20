FROM python:3.12-slim

WORKDIR /app

# CPU-only torch first, so sentence_transformers doesn't pull the multi-GB CUDA build.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./

EXPOSE 8000
CMD ["uvicorn", "ollama_client:app", "--host", "0.0.0.0", "--port", "8000"]
