import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class ComplianceAgent:

    def check(self, schedule, nurses):

        violations = []
        rules_passed = 0
        total_rules = 9

        # Track shifts
        shift_counts = {n["name"]:0 for n in nurses}
        night_counts = {n["name"]:[] for n in nurses}
        nurse_skills = {n["name"]:n["skill"] for n in nurses}

        days = list(schedule.keys())

        # Rule 1 + 2 + 3 checks
        for d_index, day in enumerate(days):
            for shift in ["morning","afternoon","night"]:

                assigned = schedule[day][shift]

                # rule: minimum nurses
                if len(assigned) < 2:
                    violations.append(f"{day} {shift} has less than 2 nurses")

                for nurse in assigned:

                    shift_counts[nurse]+=1

                    # rule: ICU skill
                    if "ICU" in day.upper():
                        if nurse_skills[nurse] not in ["N3","N4"]:
                            violations.append(f"{nurse} not qualified for ICU")

                    # track nights
                    if shift == "night":
                        night_counts[nurse].append(d_index)

        # rule: max 5 shifts
        for nurse,count in shift_counts.items():
            if count > 5:
                violations.append(f"{nurse} assigned {count} shifts")

        # rule: consecutive nights
        for nurse, nights in night_counts.items():
            nights.sort()
            streak=1
            for i in range(1,len(nights)):
                if nights[i]==nights[i-1]+1:
                    streak+=1
                    if streak>2:
                        violations.append(f"{nurse} works >2 consecutive nights")
                else:
                    streak=1

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
                if not any(nurse_skills[n] in ["N3","N4"] for n in assigned):
                    violations.append(f"{day} {shift} has no senior nurse")

        # rule: no duplicate nurse in same shift
        for day in schedule:
            for shift in schedule[day]:
                assigned = schedule[day][shift]
                if len(assigned) != len(set(assigned)):
                    violations.append(f"{day} {shift} contains duplicate nurse assignment")

        violations = list(set(violations))
        
        passed = len(violations)==0

        score = max(0, int((1 - len(violations)/total_rules) * 100))

        return {
            "passed":passed,
            "violations":violations,
            "compliance_score":score
        }


    def suggest_fix(self, violation):

        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = f"""
        Give a one sentence fix for this hospital schedule violation:
        {violation}
        """

        response = model.generate_content(prompt)
        return response.text.strip()


# test run
if __name__ == "__main__":

    nurses = [
        {"name":"Zhang Wei","skill":"N3"},
        {"name":"Li Mei","skill":"N2"},
        {"name":"Arun","skill":"N4"},
        {"name":"Sara","skill":"N1"}
    ]

    # schedule = {
    #     "Monday":{
    #         "morning":["Zhang Wei","Li Mei"],
    #         "afternoon":["Arun","Sara"],
    #         "night":["Zhang Wei","Arun"]
    #     }
    # }

    schedule = {
        "Monday":{
            "morning":["Zhang Wei"],  # only 1 nurse
            "afternoon":["Sara","Li Mei"],
            "night":["Sara","Sara"]   # duplicate + low skill
        }
    }

    agent = ComplianceAgent()
    result = agent.check(schedule,nurses)

    print(result)