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
        model="llama-3.3-70b-versatile",  # Better quality for complex JSON
        messages=[
            {"role": "system", "content": "You are an expert nurse scheduling AI for a Malaysian hospital following KKM guidelines."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,  # Lower temperature for strict rule-following
        max_tokens=2048
    )
    
    return response.choices[0].message.content


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

SHIFT NAMES TO USE:
- "morning" (AM 7am-3pm)
- "afternoon" (DA 3pm-11pm)
- "night" (EV 11pm-7am)

NURSES:
{json.dumps(nurses, indent=2, ensure_ascii=False)}

RULES:
{json.dumps(rules, indent=2, ensure_ascii=False)}

STAFFING REQUIREMENTS (min nurses per shift):
{json.dumps(staffing_requirements, indent=2, ensure_ascii=False)}

MANDATORY RULES YOU MUST FOLLOW:

1. EVERY NURSE MUST HAVE EXACTLY 1 DAY OFF (DO)
   - Each nurse must have exactly 1 day with NO shifts assigned
   - This is their DO (day off) - mandatory under Malaysian labour law

2. NIGHT SHIFT PATTERN (EV SHIFTS)
   - If assigning night shifts to a nurse, assign EXACTLY 3 CONSECUTIVE nights
   - After 3 consecutive nights, the next day must be SD (sleeping day - no shifts)
   - Then the following day must be DO (day off - no shifts)
   - Pattern: EV + EV + EV + SD + DO

3. CONSECUTIVE SHIFT LIMITS
   - Never assign more than 3 consecutive morning-only shifts to one nurse
   - Never assign more than 3 consecutive afternoon-only shifts to one nurse
   - Break the pattern with a different shift type or day off

4. MINIMUM 3 NURSES PER SHIFT
   - Each shift must have at least 3 nurses assigned
   - No exceptions - patient safety requirement

5. SENIOR NURSE RATIO (55% MINIMUM)
   - Each shift must have at least 55% senior nurses (skill level N3 or N4)
   - Calculate: (number of N3+N4 nurses) / (total nurses in shift) >= 0.55
   - Round up - if 3 nurses needed, at least 2 must be senior

6. RESPECT UNAVAILABLE DAYS
   - Never assign shifts on days marked in unavailable_days
   - These are the nurse's confirmed days off

7. MAXIMUM 5 SHIFTS PER WEEK
   - No nurse can work more than 5 shifts total per week
   - This includes all shift types combined

8. FAIR DISTRIBUTION
   - Distribute shifts across ALL nurses fairly
   - Don't overload some nurses while others have minimal shifts
   - Consider skill levels when assigning (N4 > N3 > N2 > N1 for complex cases)

OUTPUT: Return ONLY valid JSON with this structure:
{{
  "Monday": {{"morning": ["name1", "name2", "name3"], "afternoon": ["name4", "name5", "name6"], "night": ["name7", "name8", "name9"]}},
  "Tuesday": {{"morning": [], "afternoon": [], "night": []}},
  ... through Sunday
}}

Ensure ALL 7 days are included. No explanation, only JSON."""
        
        response = call_llm(prompt)
        
        # Extract JSON from response
        text = response.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        schedule = json.loads(text)
        
        # Ensure all days and shifts exist
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        shifts = ["morning", "afternoon", "night"]
        
        for day in days:
            if day not in schedule:
                schedule[day] = {}
            for shift in shifts:
                if shift not in schedule[day]:
                    schedule[day][shift] = []
        
        return schedule
    
    def explain(self, nurse_name: str, schedule: Dict[str, Dict[str, List[str]]]) -> str:
        """Generate a 2-sentence explanation for a nurse's schedule."""
        # Extract nurse's assigned shifts
        assigned_shifts = []
        for day, shifts in schedule.items():
            for shift_type, nurses in shifts.items():
                if nurse_name in nurses:
                    assigned_shifts.append(f"{day} {shift_type}")
        
        prompt = f"""Explain why {nurse_name} was assigned these shifts.

Assigned Shifts ({len(assigned_shifts)}):
{chr(10).join(f"- {s}" for s in assigned_shifts) if assigned_shifts else "No shifts assigned"}

Full Schedule:
{json.dumps(schedule, indent=2, ensure_ascii=False)}

Write exactly 2 sentences explaining the scheduling decision based on fairness, skills, or staffing needs. No bullet points."""
        
        response = call_llm(prompt)
        return response.strip()


if __name__ == "__main__":
    # Sample test data
    sample_nurses = [
        {"name": "Zhang Wei", "skill": "N4", "ward": "ICU", "unavailable_days": ["Saturday", "Sunday"]},
        {"name": "Li Hua", "skill": "N3", "ward": "ICU", "unavailable_days": []},
        {"name": "Wang Fang", "skill": "N3", "ward": "ER", "unavailable_days": ["Monday"]},
        {"name": "Liu Ming", "skill": "N2", "ward": "ER", "unavailable_days": []},
        {"name": "Chen Jing", "skill": "N2", "ward": "General", "unavailable_days": ["Wednesday"]},
        {"name": "Yang Li", "skill": "N1", "ward": "General", "unavailable_days": []},
        {"name": "Zhao Qiang", "skill": "N4", "ward": "ICU", "unavailable_days": ["Friday"]},
        {"name": "Wu Ying", "skill": "N3", "ward": "ER", "unavailable_days": []},
    ]
    
    sample_rules = {
        "max_shifts_per_week": 5,
        "ward_skill_requirements": {
            "ICU": {"min_skill": "N3"},
            "ER": {"min_skill": "N2"},
            "General": {"min_skill": "N1"}
        }
    }
    
    sample_staffing = {
        "Monday": {"morning": 3, "afternoon": 3, "night": 2},
        "Tuesday": {"morning": 3, "afternoon": 3, "night": 2},
        "Wednesday": {"morning": 3, "afternoon": 3, "night": 2},
        "Thursday": {"morning": 3, "afternoon": 3, "night": 2},
        "Friday": {"morning": 3, "afternoon": 3, "night": 2},
        "Saturday": {"morning": 2, "afternoon": 2, "night": 2},
        "Sunday": {"morning": 2, "afternoon": 2, "night": 2},
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
                nurses = schedule[day][shift]
                print(f"  {shift.capitalize()}: {', '.join(nurses) if nurses else '(no nurses)'}")
        
        # Test explanation
        print("\n" + "=" * 60)
        print("EXPLANATION FOR Zhang Wei:")
        print("=" * 60)
        explanation = agent.explain("Zhang Wei", schedule)
        print(explanation)
        
    except Exception as e:
        print(f"Error: {e}")
        print("\nNote: Make sure to set GROQ_API_KEY environment variable.")
