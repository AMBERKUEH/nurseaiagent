"""
Agent 1: Scheduling Agent
Generates and explains nurse schedules using Groq API.
"""

import os
import json
from typing import Dict, List, Any


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
        model="llama-3.1-8b-instant",  # Fast and cost-effective
        messages=[
            {"role": "system", "content": "You are an expert nurse scheduling AI for a hospital."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
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
        prompt = f"""You are an expert nurse scheduling AI for a hospital.

Generate an optimal weekly nurse schedule.

NURSES:
{json.dumps(nurses, indent=2, ensure_ascii=False)}

RULES:
{json.dumps(rules, indent=2, ensure_ascii=False)}

STAFFING REQUIREMENTS (min nurses per shift):
{json.dumps(staffing_requirements, indent=2, ensure_ascii=False)}

CONSTRAINTS:
- Respect unavailable_days - do NOT schedule on those days
- Do NOT exceed max_shifts_per_week
- Meet minimum staffing requirements per shift
- Distribute shifts fairly
- Consider skill levels (N4 > N3 > N2 > N1)

OUTPUT: Return ONLY valid JSON with this structure:
{{
  "Monday": {{"morning": ["name1", "name2"], "afternoon": ["name3"], "night": ["name4"]}},
  "Tuesday": {{"morning": [], "afternoon": [], "night": []}},
  ... through Sunday
}}

No explanation, only JSON."""
        
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
