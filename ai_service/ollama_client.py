import time
import json
import os
import uuid
from typing import List, Optional

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ------------------ Configuration (can be set via .env) ------------------
OLLAMA_CHAT_URL = os.getenv("OLLAMA_CHAT_URL", "http://localhost:11434/api/chat")
MODEL = os.getenv("MODEL", "qwen3.5:4b")       # change as needed

# ------------------ FastAPI App ------------------------------------------
app = FastAPI(title="Doctor's Orders Summarizer – Batch")

# ------------------ Request / Response Models ----------------------------
class OrderItem(BaseModel):
    id: str                     # matches a PostgreSQL UUID or other string primary key
    text: str                   # raw doctor's orders

class BatchSummaryRequest(BaseModel):
    orders: List[OrderItem]
    temperature: Optional[float] = Field(0.1, ge=0.0, le=1.0)

class SingleResult(BaseModel):
    id: str
    summary: Optional[str]
    success: bool
    processing_time_seconds: float
    error: Optional[str]

class BatchSummaryResponse(BaseModel):
    batch_id: str
    total: int
    successful: int
    failed: int
    results: List[SingleResult]

# ------------------ Core Summarization Function --------------------------
def generate_summary(doctor_orders: str, temperature: float = 0.1):
    """
    Calls Ollama to generate a summary of the doctor's orders.
    Returns (summary_text, elapsed_seconds) or (None, elapsed) on error.
    """
    user_content = f"""
You are an expert clinical documentation specialist familiar with Philippine healthcare standards. Your task is to process raw doctor's orders and summarize them for the "Course in the Ward" section of PhilHealth CF4.

RULES (FOLLOW THESE STRICTLY):
1. TENSE & VOICE (MANDATORY): Every sentence MUST be in past tense and passive voice. Change verbs: "start" -> "was started", "administer" -> "was administered", "obtain" -> "was obtained", "refer" -> "was referred", "consult" -> "was consulted". Do NOT use present tense ("is given", "are ordered") or imperative mood.
2. OUTPUT LENGTH: Exactly 5 sentences. Group related orders into the same sentence using "and", "while", or semicolons. Do not use bullet points or numbered lists.
3. COMPLETENESS: Include EVERY exact detail from the orders: medications (dose, route, frequency), diagnostics, fluids, oxygen, labs, referrals, PRN conditions, monitoring, consult criteria. Do not omit anything.
4. NO ADDITIONS: Do not add diagnoses, outcomes, or context not present in the orders.

CURRENT DOCTOR'S ORDERS:
{doctor_orders}

FINAL REMINDER: Output ONLY the summary paragraph. No extra text, no greetings, no bullet points.
"""
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": user_content}],
        "stream": False,
        "think": False,
        "options": {"temperature": temperature}
    }

    start_time = time.time()
    try:
        response = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=120)
    except requests.exceptions.RequestException as e:
        elapsed = time.time() - start_time
        print(f"Request error: {e}")
        return None, elapsed

    elapsed = time.time() - start_time

    if response.status_code != 200:
        print(f"Ollama error (status {response.status_code}): {response.text}")
        return None, elapsed

    data = response.json()
    summary = data.get("message", {}).get("content", "").strip()
    return summary, elapsed

# ------------------ Batch Endpoint ---------------------------------------
@app.post("/generate-summary/batch", response_model=BatchSummaryResponse)
async def generate_summary_batch(req: BatchSummaryRequest):
    """
    Process multiple doctor's orders in one request.
    Each order must have an `id` (your DB primary key) and the `text`.
    Returns a list of results with the same IDs.
    """
    batch_id = str(uuid.uuid4())
    results = []

    for item in req.orders:
        summary, elapsed = generate_summary(item.text, req.temperature)
        results.append({
            "id": item.id,
            "summary": summary,
            "success": summary is not None,
            "processing_time_seconds": round(elapsed, 2),
            "error": None if summary else "Failed to generate summary (check Ollama logs)"
        })

    return {
        "batch_id": batch_id,
        "total": len(req.orders),
        "successful": sum(1 for r in results if r["success"]),
        "failed": sum(1 for r in results if not r["success"]),
        "results": results
    }

# ------------------ Health Check -----------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "ok", "model": MODEL}

# ------------------ (Optional) Run directly ------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)