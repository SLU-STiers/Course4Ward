import requests
import json
import time  

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
#MODEL = "medgemma1.5:latest"
#MODEL = "llama3.1:8b"
MODEL = "qwen3.5:4b"
#MODEL = "gemma4:e4b"

def generate_summary(doctor_orders, temperature=0.1):
    user_content = f"""
You are an expert clinical documentation specialist familiar with Philippine healthcare standards. Your task is to process raw doctor's orders and summarize them for the "Course in the Ward" section of PhilHealth CF4.

RULES (FOLLOW THESE STRICTLY):
1. TENSE & VOICE (MANDATORY): Every sentence MUST be in past tense and passive voice. Change verbs: "start" -> "was started", "administer" -> "was administered", "obtain" -> "was obtained", "refer" -> "was referred", "consult" -> "was consulted". Do NOT use present tense ("is given", "are ordered") or imperative mood.
2. OUTPUT LENGTH: Exactly 5 sentences. Group related orders into the same sentence using "and", "while", or semicolons. Do not use bullet points or numbered lists.
3. COMPLETENESS: Include EVERY exact detail from the orders: medications (dose, route, frequency), diagnostics, fluids, oxygen, labs, referrals, PRN conditions, monitoring, consult criteria. Do not omit anything.
4. NO ADDITIONS: Do not add diagnoses, outcomes, or context not present in the orders.



EXAMPLE OF CORRECT STYLE (DO NOT COPY THE CONTENT – ONLY THE GRAMMAR AND SENTENCE LENGTH):

IMPORTANT: The above example is for ILLUSTRATION ONLY. Your summary must be about the CURRENT DOCTOR'S ORDERS below – do NOT include any mention of colonoscopy, NPO, PEG, Metformin, or Anesthesia.
CURRENT DOCTOR'S ORDERS:
{doctor_orders}

FINAL REMINDER: Output ONLY the summary paragraph. No extra text, no greetings, no bullet points.
"""
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": user_content}
        ],
        "stream": False,
        "think": False,
        "options": {
            "temperature": temperature
        }
    }

    start_time = time.time()  # start timer
    response = requests.post(OLLAMA_CHAT_URL, json=payload)
    elapsed = time.time() - start_time  # end timer

    if response.status_code != 200:
        print("Error:", response.text)
        return None, elapsed  # still return elapsed time

    data = response.json()
    summary = data.get("message", {}).get("content", "").strip()
    return summary, elapsed

if __name__ == "__main__":
    orders = """
"1. Revise mannitol to 150ml q4.
2. [IM IDS] Include fungal CS and Cryptococcal Antigen Latex Agglutination System to CSF analysis.  Dr. E. Geronimo/ Licdan
3. NEURO For lumbar puncture care of neuroanesthesiologist (dr. Lea domingo).  Kindly get cbg while simultaneous to the tap.  Get csf pressures -- opening and closing Collect specimen for csf analysis Bottle 1: cell count, differential count Bottle 2: csf gs/cs, protein. Glucose Bottle 3: save specimen for POSSIBLE biofire. Dr. K. Flores/Gohel
4. Anesthesia Noted referral for lumbar tap  NPO post 11PM IVF as ordered  Dr. Lea Domingo informed  Please prepare the following materials for lumbar tap: 1 sterile gown 2 pairs of size 6.5 gloves 1 spinal needle, gauge 23 (If not available, a spinal needle, gauge 25, will suffice) 4 towels 2 large drapes 1 manometer (if unavailable, Macroset may be used) Sterile surgical Marker set (please ask OR/CSR) 3 cc syringe Lidocaine 3 sterile bottles for CSF samples Betadine swabs or Cutasept 1 pack of 4x8 OS/gauze Cutasept/Povidone Swabsticks Tegaderm Film Dressing 1626W  Refer accordingly Dr. L. Domingo/Aurelio"
"""

    summary, elapsed = generate_summary(orders, temperature=0.1)

    print(f"\n=== MODEL OUTPUT (Processing time: {elapsed:.2f} seconds) ===\n")
    print(summary)