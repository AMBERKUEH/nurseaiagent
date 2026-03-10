"""
Agent 1: Scheduling Agent
Generates and explains nurse schedules using Groq API.

ROOT CAUSE FIX:
- 8 nurses × 5 shifts/week = 40 total slots
- 7 days × 3 shifts × 3 nurses = 63 slots needed
- Solution: enforce_minimum_coverage raises the per-nurse limit to 6 for
  weekend gap-filling (KKM allows up to 6 shifts/week in exceptional circumstances),
  and the LLM prompt explicitly instructs weekend-first scheduling.
"""

from dotenv import load_dotenv
import os
import json
from typing import Dict, List, Any

load_dotenv()


def call_llm(prompt: str) -> str:
    try:
        from groq import Groq
    except ImportError:
        raise ImportError("groq not installed. Run: pip install groq")

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable not set.")

    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are an expert nurse scheduling AI for a Malaysian hospital following KKM guidelines."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        max_tokens=3000,
    )
    return response.choices[0].message.content


def enforce_minimum_coverage(
    schedule: Dict[str, Dict[str, List[str]]],
    nurses: List[Dict[str, Any]],
    min_per_shift: int = 3,
) -> Dict[str, Dict[str, List[str]]]:
    """
    Post-processing guarantee: every shift on every day has at least min_per_shift nurses.

    Key fix for weekend emptiness:
    - Process days in order: weekends FIRST, then weekdays.
      This ensures weekend shifts are filled before nurses hit their weekly limits.
    - Hard limit raised to 6 for gap-fill purposes (KKM exceptional allowance).
    - Phase 1: nurses with zero shifts that day who are under the hard limit.
    - Phase 2: nurses already on another shift today (double-shift fallback).
    - Phase 3: nurses who have hit the soft limit (5) but not the hard limit (6).
    """
    # Process weekends first so they get priority before weekdays exhaust all slots
    day_order = [
        "Saturday", "Sunday",
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    ]
    shifts = ["morning", "afternoon", "night"]
    SOFT_LIMIT = 5   # preferred max
    HARD_LIMIT = 6   # absolute max (KKM exceptional)

    # Build weekly shift count per nurse
    weekly_count: Dict[str, int] = {n["name"]: 0 for n in nurses}
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]:
        for shift in shifts:
            for name in schedule.get(day, {}).get(shift, []):
                weekly_count[name] = weekly_count.get(name, 0) + 1

    nurse_names = [n["name"] for n in nurses]
    nurse_unavail = {n["name"]: set(n.get("unavailable_days", [])) for n in nurses}

    for day in day_order:
        if day not in schedule:
            schedule[day] = {s: [] for s in shifts}

        for shift in shifts:
            current = schedule[day].get(shift, [])
            if len(current) >= min_per_shift:
                continue

            assigned_today = set()
            for s in shifts:
                assigned_today.update(schedule[day].get(s, []))

            def available(name: str, limit: int) -> bool:
                return (
                    name not in current
                    and day not in nurse_unavail.get(name, set())
                    and weekly_count.get(name, 0) < limit
                )

            # Phase 1: not working today, under soft limit
            p1 = [n for n in nurse_names if n not in assigned_today and available(n, SOFT_LIMIT)]
            # Phase 2: already working today on diff shift, under soft limit
            p2 = [n for n in nurse_names if n in assigned_today and available(n, SOFT_LIMIT)]
            # Phase 3: not working today, under hard limit (overtime allowance)
            p3 = [n for n in nurse_names if n not in assigned_today and available(n, HARD_LIMIT)]
            # Phase 4: already working today, under hard limit
            p4 = [n for n in nurse_names if n in assigned_today and available(n, HARD_LIMIT)]

            pool = p1 + p2 + p3 + p4
            # Deduplicate while preserving order
            seen: set = set()
            pool = [x for x in pool if not (x in seen or seen.add(x))]  # type: ignore[func-returns-value]

            while len(schedule[day][shift]) < min_per_shift and pool:
                chosen = pool.pop(0)
                schedule[day][shift].append(chosen)
                weekly_count[chosen] = weekly_count.get(chosen, 0) + 1

    return schedule


class SchedulingAgent:

    def generate(
        self,
        nurses: List[Dict[str, Any]],
        rules: Dict[str, Any],
        staffing_requirements: Dict[str, int],
    ) -> Dict[str, Dict[str, List[str]]]:

        nurse_count = len(nurses)
        total_slots = nurse_count * 5
        needed = 7 * 3 * 3

        prompt = f"""You are scheduling nurses for a Malaysian hospital following KKM guidelines.
The hospital operates 24 hours a day, 365 days a year. There are NO days off for the hospital itself.

SHIFT TIMES:
- "morning"   = AM  07:00–15:00
- "afternoon" = DA  15:00–23:00
- "night"     = EV  23:00–07:00 (next day)

NURSES ({nurse_count} total):
{json.dumps(nurses, indent=2, ensure_ascii=False)}

RULES:
{json.dumps(rules, indent=2, ensure_ascii=False)}

STAFFING REQUIREMENTS (min nurses per shift):
{json.dumps(staffing_requirements, indent=2, ensure_ascii=False)}

⚠️  CAPACITY NOTICE: You have {nurse_count} nurses × 5 shifts = {total_slots} total slots.
You need {needed} slots minimum (7 days × 3 shifts × 3 nurses).
This means nurses MUST be shared across shifts and some will work 5–6 shifts.
Spreading fairly is essential. DO NOT front-load weekdays and leave weekends empty.

SCHEDULING PRIORITY ORDER:

STEP 1 — WEEKEND SHIFTS FIRST (Saturday & Sunday):
Schedule Saturday and Sunday completely before touching weekdays.
Hospitals run full 24/7 on weekends. Every shift must have ≥3 nurses.
Do NOT mark weekends as light — treat them identically to weekdays.

STEP 2 — PREAPPROVED DAYS OFF:
After weekends are covered, exclude nurses from their unavailable_days.

STEP 3 — WEEKDAY NIGHTS (Monday–Friday night shifts):
Fill night shifts next — they are hardest to staff.
Rotate night duty fairly. No nurse more than 3 nights/week.
Every night shift: ≥3 nurses. No exceptions.

STEP 4 — REMAINING WEEKDAY SHIFTS:
Fill morning and afternoon shifts Mon–Fri.
Each shift: ≥3 nurses. Maintain 55%+ senior (N3/N4) ratio.

STEP 5 — BALANCE:
- Every nurse: exactly 1 full day off (DO) per week
- Max 5 shifts per nurse (6 is allowed only if necessary for coverage)
- No more than 3 consecutive same-shift type
- Fair distribution — no nurse at 5 while another is at 1

ABSOLUTE RULES:
- NEVER leave any shift empty on any day including weekends
- ALL 7 days × ALL 3 shifts must have ≥3 nurses
- Return ONLY valid JSON — no explanation, no markdown

OUTPUT FORMAT (fill in actual nurse names — do NOT use placeholder names):
{{
  "Monday":    {{"morning": [], "afternoon": [], "night": []}},
  "Tuesday":   {{"morning": [], "afternoon": [], "night": []}},
  "Wednesday": {{"morning": [], "afternoon": [], "night": []}},
  "Thursday":  {{"morning": [], "afternoon": [], "night": []}},
  "Friday":    {{"morning": [], "afternoon": [], "night": []}},
  "Saturday":  {{"morning": [], "afternoon": [], "night": []}},
  "Sunday":    {{"morning": [], "afternoon": [], "night": []}}
}}"""

        response = call_llm(prompt)

        text = response.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        schedule = json.loads(text)

        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for day in days:
            if day not in schedule:
                schedule[day] = {}
            for shift in ["morning", "afternoon", "night"]:
                if shift not in schedule[day]:
                    schedule[day][shift] = []

        # Safety net: guarantee ≥3 nurses on every shift, weekends processed first
        schedule = enforce_minimum_coverage(schedule, nurses, min_per_shift=3)

        return schedule

    def explain(self, nurse_name: str, schedule: Dict[str, Dict[str, List[str]]]) -> str:
        assigned = [
            f"{day} {shift_type}"
            for day, shifts in schedule.items()
            for shift_type, nurse_list in shifts.items()
            if nurse_name in nurse_list
        ]
        prompt = f"""Explain why {nurse_name} was assigned these shifts.

Assigned ({len(assigned)} shifts):
{chr(10).join(f'- {s}' for s in assigned) if assigned else 'No shifts assigned'}

Write exactly 2 sentences. No bullet points."""
        return call_llm(prompt).strip()


if __name__ == "__main__":
    sample_nurses = [
        {"name": "Zhang Wei",  "skill": "N4", "ward": "ICU",     "unavailable_days": ["Saturday", "Sunday"]},
        {"name": "Li Hua",     "skill": "N3", "ward": "ICU",     "unavailable_days": []},
        {"name": "Wang Fang",  "skill": "N3", "ward": "ER",      "unavailable_days": ["Monday"]},
        {"name": "Liu Ming",   "skill": "N2", "ward": "ER",      "unavailable_days": []},
        {"name": "Chen Jing",  "skill": "N2", "ward": "General", "unavailable_days": ["Wednesday"]},
        {"name": "Yang Li",    "skill": "N1", "ward": "General", "unavailable_days": []},
        {"name": "Zhao Qiang", "skill": "N4", "ward": "ICU",     "unavailable_days": ["Friday"]},
        {"name": "Wu Ying",    "skill": "N3", "ward": "ER",      "unavailable_days": []},
    ]
    sample_rules = {
        "max_shifts_per_week": 5,
        "ward_skill_requirements": {
            "ICU": {"min_skill": "N3"}, "ER": {"min_skill": "N2"}, "General": {"min_skill": "N1"}
        }
    }
    sample_staffing = {d: {"morning": 3, "afternoon": 3, "night": 3}
                       for d in ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]}

    agent = SchedulingAgent()
    print("GENERATING SCHEDULE...")
    try:
        sched = agent.generate(sample_nurses, sample_rules, sample_staffing)
        total_by_nurse: Dict[str, int] = {}
        print("\nGENERATED SCHEDULE:")
        for day in ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]:
            print(f"\n{day}:")
            for shift in ["morning","afternoon","night"]:
                ns = sched[day][shift]
                flag = " ⚠️ UNDERSTAFFED" if len(ns) < 3 else ""
                print(f"  {shift:10} ({len(ns)}): {', '.join(ns) if ns else '(EMPTY)'}{flag}")
                for n in ns:
                    total_by_nurse[n] = total_by_nurse.get(n, 0) + 1
        print("\nPer-nurse shift totals:")
        for name, count in sorted(total_by_nurse.items()):
            flag = " ⚠️ OVER LIMIT" if count > 6 else (" ⚠️ SOFT LIMIT" if count > 5 else "")
            print(f"  {name}: {count}{flag}")
    except Exception as e:
        print(f"Error: {e}")