"""
Agent 3: Compliance Agent
Checks schedule compliance using Gemini API.
"""

import os
import json
from typing import Dict, List, Any


def call_llm(prompt: str) -> str:
    """Call Gemini API with the given prompt."""
    try:
        from google import genai
    except ImportError:
        raise ImportError("google-genai not installed. Run: pip install google-genai")
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set.")
    
    client = genai.Client(api_key=api_key)
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"You are a hospital scheduling compliance expert.\n\n{prompt}"
    )
    
    return response.text


class ComplianceAgent:
    """Checks schedule for compliance violations."""

    def check(self, schedule, nurses):
        """Check schedule compliance and return violations."""
        violations = []
        rules_passed = 0
        total_rules = 9

        # Track shifts
        shift_counts = {n["name"]: 0 for n in nurses}
        night_counts = {n["name"]: [] for n in nurses}
        nurse_skills = {n["name"]: n["skill"] for n in nurses}

        days = list(schedule.keys())

        # Rule 1 + 2 + 3 checks
        for d_index, day in enumerate(days):
            for shift in ["morning", "afternoon", "night"]:
                assigned = schedule[day][shift]

                # rule: minimum nurses
                if len(assigned) < 2:
                    violations.append(f"{day} {shift} has less than 2 nurses")

                for nurse in assigned:
                    shift_counts[nurse] += 1

                    # rule: ICU skill
                    if "ICU" in day.upper():
                        if nurse_skills[nurse] not in ["N3", "N4"]:
                            violations.append(f"{nurse} not qualified for ICU")

                    # track nights
                    if shift == "night":
                        night_counts[nurse].append(d_index)

        # rule: max 5 shifts
        for nurse, count in shift_counts.items():
            if count > 5:
                violations.append(f"{nurse} assigned {count} shifts")

        # rule: consecutive nights
        for nurse, nights in night_counts.items():
            nights.sort()
            streak = 1
            for i in range(1, len(nights)):
                if nights[i] == nights[i - 1] + 1:
                    streak += 1
                    if streak > 2:
                        violations.append(f"{nurse} works >2 consecutive nights")
                else:
                    streak = 1

        # rule: no double shifts same day
        daily_counts = {}
        for day in schedule:
            for shift in schedule[day]:
                for nurse in schedule[day][shift]:
                    daily_counts.setdefault((nurse, day), 0)
                    daily_counts[(nurse, day)] += 1

        for (nurse, day), count in daily_counts.items():
            if count > 1:
                violations.append(f"{nurse} assigned multiple shifts on {day}")

        # rule: rest after night shift (no morning next day)
        for nurse, nights in night_counts.items():
            for night_index in nights:
                next_day = night_index + 1
                if next_day < len(days):
                    next_day_name = days[next_day]
                    if nurse in schedule[next_day_name]["morning"]:
                        violations.append(f"{nurse} works night then morning next day")

        # rule: max 3 night shifts per week
        for nurse, nights in night_counts.items():
            if len(nights) > 3:
                violations.append(f"{nurse} assigned too many night shifts")

        # rule: shift must include at least one senior nurse (N3 or N4)
        for day in schedule:
            for shift in schedule[day]:
                assigned = schedule[day][shift]
                if not any(nurse_skills[n] in ["N3", "N4"] for n in assigned):
                    violations.append(f"{day} {shift} has no senior nurse")

        # rule: no duplicate nurse in same shift
        for day in schedule:
            for shift in schedule[day]:
                assigned = schedule[day][shift]
                if len(assigned) != len(set(assigned)):
                    violations.append(f"{day} {shift} contains duplicate nurse assignment")

        violations = list(set(violations))
        passed = len(violations) == 0
        score = max(0, int((1 - len(violations) / total_rules) * 100))

        return {
            "passed": passed,
            "violations": violations,
            "compliance_score": score
        }

    def suggest_fix(self, violation):
        """Suggest a fix for a violation using Groq."""
        try:
            prompt = f"""
You are a hospital scheduling compliance expert.

Give a one sentence fix for this schedule violation:
{violation}

Respond with ONLY the fix suggestion, no explanation."""

            response = call_llm(prompt)
            return response.strip()
        except Exception as e:
            print(f"Groq suggestion failed: {e}")
            # Fallback suggestions
            if "less than 2 nurses" in violation:
                return "Add more nurses to this shift to meet minimum staffing requirements."
            elif "not qualified" in violation:
                return "Replace with a nurse who has the required skill level (N3 or higher)."
            elif "consecutive nights" in violation:
                return "Give the nurse a day off after night shifts to ensure adequate rest."
            elif "night then morning" in violation:
                return "Ensure 12-hour rest period between night shift and next morning shift."
            elif "too many night shifts" in violation:
                return "Redistribute night shifts among more nurses to balance workload."
            elif "no senior nurse" in violation:
                return "Assign at least one N3 or N4 nurse to supervise this shift."
            else:
                return "Review and adjust the schedule to resolve this violation."


# Test run
if __name__ == "__main__":
    nurses = [
        {"name": "Zhang Wei", "skill": "N3"},
        {"name": "Li Mei", "skill": "N2"},
        {"name": "Arun", "skill": "N4"},
        {"name": "Sara", "skill": "N1"}
    ]

    schedule = {
        "Monday": {
            "morning": ["Zhang Wei"],  # only 1 nurse
            "afternoon": ["Sara", "Li Mei"],
            "night": ["Sara", "Sara"]  # duplicate + low skill
        }
    }

    agent = ComplianceAgent()
    result = agent.check(schedule, nurses)
    print(result)
