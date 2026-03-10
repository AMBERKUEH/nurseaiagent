"""
Agent 1: Scheduling Agent
Generates and explains nurse schedules using Groq API.
"""

from dotenv import load_dotenv
import os
import json
from typing import Dict, List, Any

load_dotenv()


def call_llm(prompt: str) -> str:
    """Call Groq API with the given prompt."""
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
        max_tokens=2048
    )
    
    return response.choices[0].message.content


def enforce_minimum_coverage(
    schedule: Dict[str, Dict[str, List[str]]],
    nurses: List[Dict[str, Any]],
    min_per_shift: int = 3
) -> Dict[str, Dict[str, List[str]]]:
    """
    Post-processing: guarantee every shift has at least min_per_shift nurses.
    Priority order for gap-filling:
      1. Nurses not scheduled on that day at all (fresh)
      2. Nurses already on a different shift that day (add as extra only if under weekly limit)
    Never assign a nurse to the same shift twice on the same day.
    """
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    shifts = ["morning", "afternoon", "night"]

    # Build weekly shift count per nurse
    weekly_count: Dict[str, int] = {n["name"]: 0 for n in nurses}
    for day in days:
        for shift in shifts:
            for name in schedule[day].get(shift, []):
                weekly_count[name] = weekly_count.get(name, 0) + 1

    nurse_list = [n["name"] for n in nurses]
    nurse_unavail = {n["name"]: set(n.get("unavailable_days", [])) for n in nurses}

    for day in days:
        for shift in shifts:
            current = schedule[day].get(shift, [])
            if len(current) >= min_per_shift:
                continue  # Already covered

            # Who is assigned to anything on this day?
            assigned_today = set()
            for s in shifts:
                assigned_today.update(schedule[day].get(s, []))

            # Phase 1: nurses not working at all today and available and under weekly limit
            candidates_fresh = [
                n for n in nurse_list
                if n not in assigned_today
                and day not in nurse_unavail.get(n, set())
                and weekly_count.get(n, 0) < 5
                and n not in current
            ]

            # Phase 2: nurses already working today but not on this shift (double-shift fallback)
            candidates_extra = [
                n for n in nurse_list
                if n in assigned_today
                and n not in current
                and day not in nurse_unavail.get(n, set())
                and weekly_count.get(n, 0) < 5
            ]

            pool = candidates_fresh + candidates_extra

            while len(schedule[day][shift]) < min_per_shift and pool:
                chosen = pool.pop(0)
                schedule[day][shift].append(chosen)
                weekly_count[chosen] = weekly_count.get(chosen, 0) + 1

    return schedule


class SchedulingAgent:
    """AI Agent for generating and explaining nurse schedules."""

    def generate(
        self,
        nurses: List[Dict[str, Any]],
        rules: Dict[str, Any],
        staffing_requirements: Dict[str, int]
    ) -> Dict[str, Dict[str, List[str]]]:
        """Generate a weekly schedule for nurses."""
        prompt = f"""You are scheduling nurses for a Malaysian hospital following Kementerian Kesihatan Malaysia (KKM) rostering guidelines.

SHIFT TIMES:
- "morning"   = AM  07:00–15:00
- "afternoon" = DA  15:00–23:00  
- "night"     = EV  23:00–07:00 (next day)

CRITICAL: The hospital operates 24 hours a day, 7 days a week.
ALL THREE SHIFTS MUST BE COVERED EVERY DAY. There must NEVER be an empty night shift.

NURSES:
{json.dumps(nurses, indent=2, ensure_ascii=False)}

RULES:
{json.dumps(rules, indent=2, ensure_ascii=False)}

STAFFING REQUIREMENTS (min nurses per shift per day):
{json.dumps(staffing_requirements, indent=2, ensure_ascii=False)}

MANDATORY SCHEDULING RULES (follow in order):

STEP 1 — PREAPPROVED REQUESTS:
Never schedule a nurse on their unavailable_days. These are fixed.

STEP 2 — NIGHT SHIFT FIRST (most important):
Assign EV (night) shifts first. Night shifts are 23:00–07:00.
Every night shift MUST have at least 3 nurses.
If a nurse works 3 consecutive nights, they get the next day off (SD then DO).
Rotate night duty fairly — no nurse should work more than 3 night shifts per week.

STEP 3 — DAY SHIFTS:
Fill morning (07:00–15:00) and afternoon (15:00–23:00) shifts.
Each must have at least 3 nurses.
Maintain at least 55% senior nurses (N3/N4) per shift.

STEP 4 — DAY OFF:
Every nurse must have exactly 1 full day off (DO) with zero shifts.

STEP 5 — LIMITS:
- Max 5 shifts per nurse per week
- No more than 3 consecutive same-type shifts in a row
- Fair distribution across all nurses

IMPORTANT OUTPUT RULES:
- ALL 7 days must appear
- ALL 3 shifts per day must appear (morning, afternoon, night)
- NEVER leave night shift empty — the hospital does not close at night
- Return ONLY valid JSON, no explanation

OUTPUT FORMAT:
{{
  "Monday":    {{"morning": ["name1", "name2", "name3"], "afternoon": ["name4", "name5", "name6"], "night": ["name7", "name8", "name9"]}},
  "Tuesday":   {{"morning": [], "afternoon": [], "night": []}},
  "Wednesday": {{"morning": [], "afternoon": [], "night": []}},
  "Thursday":  {{"morning": [], "afternoon": [], "night": []}},
  "Friday":    {{"morning": [], "afternoon": [], "night": []}},
  "Saturday":  {{"morning": [], "afternoon": [], "night": []}},
  "Sunday":    {{"morning": [], "afternoon": [], "night": []}}
}}"""

        response = call_llm(prompt)

        # Extract JSON
        text = response.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        schedule = json.loads(text)

        # Ensure all days and shifts exist
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        shifts_list = ["morning", "afternoon", "night"]
        for day in days:
            if day not in schedule:
                schedule[day] = {}
            for shift in shifts_list:
                if shift not in schedule[day]:
                    schedule[day][shift] = []

        # Post-processing: enforce minimum 3 nurses on every shift
        # This is the safety net — the LLM should handle it, but we guarantee it here
        schedule = enforce_minimum_coverage(schedule, nurses, min_per_shift=3)

        return schedule

    def explain(self, nurse_name: str, schedule: Dict[str, Dict[str, List[str]]]) -> str:
        """Generate a 2-sentence explanation for a nurse's schedule."""
        assigned_shifts = []
        for day, shifts in schedule.items():
            for shift_type, nurse_list in shifts.items():
                if nurse_name in nurse_list:
                    assigned_shifts.append(f"{day} {shift_type}")

        prompt = f"""Explain why {nurse_name} was assigned these shifts.

Assigned Shifts ({len(assigned_shifts)}):
{chr(10).join(f"- {s}" for s in assigned_shifts) if assigned_shifts else "No shifts assigned"}

Write exactly 2 sentences explaining the scheduling decision based on fairness, skills, or staffing needs. No bullet points."""

        return call_llm(prompt).strip()


if __name__ == "__main__":
    sample_nurses = [
        {"name": "Zhang Wei", "skill": "N4", "ward": "ICU", "unavailable_days": ["Saturday", "Sunday"]},
        {"name": "Li Hua",    "skill": "N3", "ward": "ICU", "unavailable_days": []},
        {"name": "Wang Fang", "skill": "N3", "ward": "ER",  "unavailable_days": ["Monday"]},
        {"name": "Liu Ming",  "skill": "N2", "ward": "ER",  "unavailable_days": []},
        {"name": "Chen Jing", "skill": "N2", "ward": "General", "unavailable_days": ["Wednesday"]},
        {"name": "Yang Li",   "skill": "N1", "ward": "General", "unavailable_days": []},
        {"name": "Zhao Qiang","skill": "N4", "ward": "ICU", "unavailable_days": ["Friday"]},
        {"name": "Wu Ying",   "skill": "N3", "ward": "ER",  "unavailable_days": []},
    ]

    sample_rules = {
        "max_shifts_per_week": 5,
        "ward_skill_requirements": {
            "ICU": {"min_skill": "N3"},
            "ER":  {"min_skill": "N2"},
            "General": {"min_skill": "N1"}
        }
    }

    sample_staffing = {
        "Monday":    {"morning": 3, "afternoon": 3, "night": 3},
        "Tuesday":   {"morning": 3, "afternoon": 3, "night": 3},
        "Wednesday": {"morning": 3, "afternoon": 3, "night": 3},
        "Thursday":  {"morning": 3, "afternoon": 3, "night": 3},
        "Friday":    {"morning": 3, "afternoon": 3, "night": 3},
        "Saturday":  {"morning": 2, "afternoon": 2, "night": 2},
        "Sunday":    {"morning": 2, "afternoon": 2, "night": 2},
    }

    agent = SchedulingAgent()
    print("=" * 60)
    print("GENERATING SCHEDULE...")
    print("=" * 60)

    try:
        schedule = agent.generate(sample_nurses, sample_rules, sample_staffing)

        print("\nGENERATED SCHEDULE:")
        print("=" * 60)
        for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]:
            print(f"\n{day}:")
            for shift in ["morning", "afternoon", "night"]:
                ns = schedule[day][shift]
                count = len(ns)
                flag = " ⚠️ UNDERSTAFFED" if count < 3 else ""
                print(f"  {shift.capitalize():10} ({count}): {', '.join(ns) if ns else '(EMPTY)'}{flag}")

    except Exception as e:
        print(f"Error: {e}")