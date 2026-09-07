import os
import time
import uuid
from datetime import date, datetime
from typing import List, Optional

import requests
from fastapi import FastAPI, HTTPException
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

# ------------------ Configuration (can be set via .env) ------------------
OLLAMA_CHAT_URL = os.getenv("OLLAMA_CHAT_URL", "http://localhost:11434/api/chat")
MODEL = os.getenv("MODEL", "qwen3.5:4b")       # change as needed

# ------------------ FastAPI App ------------------------------------------
app = FastAPI(title="Doctor's Orders Summarizer – Batch")

# ------------------ Request / Response Models ----------------------------
class OrderItem(BaseModel):
    """A single physician order, nested inside an admission."""
    model_config = ConfigDict(populate_by_name=True)

    id: str                     # matches a PostgreSQL UUID or other string primary key
    text: str                   # raw doctor's orders
    date_created: Optional[str] = Field(
        None,
        description="When the order was written (Prisma PhysicianOrder.dateCreated, ISO 8601 date/datetime)",
        validation_alias=AliasChoices("date_created", "dateCreated", "order_date", "orderDate"),
    )


class AdmissionItem(BaseModel):
    """One patient admission together with all of its orders."""
    model_config = ConfigDict(populate_by_name=True)

    admissionId: str            # Prisma PatientAdmission.id
    admissionDate: Optional[str] = Field(
        None,
        description="Admission start date (Prisma PatientAdmission.admissionDate, ISO 8601); used to compute 'Day N of Admission'",
        validation_alias=AliasChoices("admission_date", "admissionDate"),
    )
    orders: List[OrderItem]


class BatchSummaryRequest(BaseModel):
    temperature: Optional[float] = Field(0.1, ge=0.0, le=1.0)
    admissions: List[AdmissionItem]


class GroupResult(BaseModel):
    """Result of summarizing ONE admission-day group."""
    group_id: str
    summary: Optional[str]
    orders: List[dict]         
    success: bool
    processing_time_seconds: float
    error: Optional[str]


class BatchSummaryResponse(BaseModel):
    batch_id: str
    total_groups: int
    successful: int
    failed: int
    results: List[GroupResult]

# ------------------ Core Summarization Function --------------------------
def generate_summary(doctor_orders: str, temperature: float = 0.1, group_label: Optional[str] = None):
    """
    Calls Ollama to generate a summary of the doctor's orders.
    `group_label`, when provided, tells the model which day/admission group the
    orders belong to (e.g. "Day 1 of Admission #..."). The output paragraph
    format is unchanged.
    Returns (summary_text, elapsed_seconds) or (None, elapsed) on error.
    """
    context_block = (
        f"ORDERS BELONG TO: {group_label} (these orders were written on the same "
        "day of the same admission and must be summarized together).\n\n"
        if group_label
        else ""
    )

    user_content = f"""
You are an expert clinical documentation specialist familiar with Philippine healthcare standards. Your task is to process raw doctor's orders and summarize them for the "Course in the Ward" section of PhilHealth CF4.

RULES (FOLLOW THESE STRICTLY):
1. TENSE & VOICE (MANDATORY): Every sentence MUST be in past tense and passive voice. Change verbs: "start" -> "was started", "administer" -> "was administered", "obtain" -> "was obtained", "refer" -> "was referred", "consult" -> "was consulted". Do NOT use present tense ("is given", "are ordered") or imperative mood.
2. OUTPUT LENGTH: Exactly 5 sentences. Group related orders into the same sentence using "and", "while", or semicolons. Do not use bullet points or numbered lists.
3. COMPLETENESS: Include EVERY exact detail from the orders: medications (dose, route, frequency), diagnostics, fluids, oxygen, labs, referrals, PRN conditions, monitoring, consult criteria. Do not omit anything.
4. NO ADDITIONS: Do not add diagnoses, outcomes, or context not present in the orders.

{context_block}CURRENT DOCTOR'S ORDERS:
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

# ------------------ Grouping Helpers --------------------------------------
def _parse_iso_date(value: Optional[str]):
    """
    Best-effort parse of an ISO 8601 date/datetime string into a `date`.
    Returns None when the value is missing or unparseable.
    """
    if not value:
        return None
    text = str(value).strip()
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        try:
            return date.fromisoformat(text[:10])  
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _day_number(order_date: date, admission_date: Optional[date]) -> Optional[int]:
    """
    Ordinal day of the admission for `order_date`:
        (order_date - admission_date).days + 1
    Returns None when the admission date is unknown or the order precedes it
    (the caller then falls back to a sequential index of distinct order dates).
    """
    if admission_date is None:
        return None
    day = (order_date - admission_date).days + 1
    return day if day >= 1 else None


def _day_label(admission_id: str, order_date: date, admission_date: Optional[date]) -> str:
    """
    Human-readable label for one admission-day group, e.g.
    "Day 2 of Admission #<id> (2025-06-01)".
    Falls back to a plain admission + date label when no admission date is known.
    """
    if admission_date is not None:
        day_number = (order_date - admission_date).days + 1
        if day_number >= 1:
            return f"Day {day_number} of Admission #{admission_id} ({order_date.isoformat()})"
    return f"Admission #{admission_id} - orders of {order_date.isoformat()}"


def _build_group_id(admission_id: str, day_number: Optional[int]) -> str:
    """Stable id of one admission-day group, e.g. '<admissionId>-day-1'."""
    if day_number is None:
        return f"{admission_id}-no-date"
    return f"{admission_id}-day-{day_number}"


def group_admission_orders(admission: AdmissionItem):
    """
    Split ONE admission's orders into per-day groups by calendar day of
    `date_created` (reference: Prisma PhysicianOrder.dateCreated).

    Day number:
      - ordinal since PatientAdmission.admissionDate ("day 1", "day 2", ...) when
        admissionDate is known and the order is not before it; otherwise
      - a 1-based sequential index across the admission's distinct order dates.

    Returns a list of tuples: (day_number, date_iso, member_orders) ordered
    chronologically; orders without a usable date form a trailing group with
    day_number None.
    """
    buckets = {}  # plain dict preserves insertion order
    for item in admission.orders:
        parsed = _parse_iso_date(item.date_created)
        buckets.setdefault(parsed if parsed else "__no_date__", []).append(item)

    dated_keys = sorted((key for key in buckets if key != "__no_date__"))
    admission_date = _parse_iso_date(admission.admissionDate)

    groups = []
    sequential = 0
    for key in dated_keys:
        members = buckets[key]
        ordinal = _day_number(key, admission_date) if admission_date else None
        if ordinal is None:
            sequential += 1
            ordinal = sequential
        groups.append((ordinal, key.isoformat(), members))

    no_date_members = buckets.get("__no_date__", [])
    if no_date_members:
        groups.append((None, None, no_date_members))

    return groups

# ------------------ Batch Endpoint ---------------------------------------
@app.post("/generate-summary/batch", response_model=BatchSummaryResponse)
async def generate_summary_batch(req: BatchSummaryRequest):
    """
    Summarize doctor's orders grouped PER ADMISSION and PER DAY of that
    admission.

    Request shape (camelCase keys, snake_case aliases also accepted):
      { temperature, admissions: [
          { admissionId, admissionDate?, orders: [{ id, text, dateCreated? }] }
        ] }

    Every order of an admission written on the same calendar day is combined
    into a single summarization call ("Day N of Admission #..."). Each
    (admission, day) group yields ONE result carrying:
      group_id = '<admissionId>-day-<N>'
    plus the summary, an echo of the group's member orders, and per-group
    counts (total_groups / successful / failed).

    An empty request (no admissions, or admissions without orders) is rejected
    with HTTP 400.
    """
    total_orders = sum(len(a.orders) for a in req.admissions)
    if not req.admissions or total_orders == 0:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one admission with at least one order",
        )

    batch_id = str(uuid.uuid4())
    results: List[GroupResult] = []

    for admission in req.admissions:
        admission_date = _parse_iso_date(admission.admissionDate)

        for day_number, date_iso, members in group_admission_orders(admission):
            if len(members) == 1:
                group_text = members[0].text
            else:
                group_text = "\n".join(
                    f"{index}. {member.text}" for index, member in enumerate(members, start=1)
                )

            order_date = _parse_iso_date(members[0].date_created)
            if order_date is None:
                label = f"Admission #{admission.admissionId}"
            else:
                label = _day_label(admission.admissionId, order_date, admission_date)

            summary, elapsed = generate_summary(group_text, req.temperature, group_label=label)
            error = None if summary else "Failed to generate summary (check Ollama logs)"

            results.append(GroupResult(
                group_id=_build_group_id(admission.admissionId, day_number),
                summary=summary,
                orders=[
                    {"id": member.id, "text": member.text, "dateCreated": member.date_created}
                    for member in members
                ],
                success=summary is not None,
                processing_time_seconds=round(elapsed, 2),
                error=error,
            ))

    return BatchSummaryResponse(
        batch_id=batch_id,
        total_groups=len(results),
        successful=sum(1 for r in results if r.success),
        failed=sum(1 for r in results if not r.success),
        results=results,
    )

# ------------------ Health Check -----------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "ok", "model": MODEL}

# ------------------ (Optional) Run directly ------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
