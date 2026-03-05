import os

class EmergencyAgent:
    def __init__(self, gemini_api_key=None):
        self.gemini_api_key = gemini_api_key or os.getenv('GEMINI_API_KEY')
        self.gemini_endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"

    def _call_gemini(self, disruption):
        import requests

        prompt = (
            "Extract the following structured information from the description below:\n"
            "disruption: '{}'\n"
            "Respond in JSON with fields: affected_nurse (string or null), affected_day (string), "
            "affected_shift (morning/afternoon/night), affected_ward (string)."
        ).format(disruption)

        headers = {
            "Content-Type": "application/json",
        }
        if self.gemini_api_key:
            headers["Authorization"] = f"Bearer {self.gemini_api_key}"

        data = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ]
        }
        resp = requests.post(f"{self.gemini_endpoint}?key={self.gemini_api_key}", json=data, headers=headers)
        resp.raise_for_status()
        try:
            response_text = (
                resp.json()
                .get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "{}")
            )
            import json
            return json.loads(response_text)
        except Exception:
            # fallback in case of bad response
            return {
                "affected_nurse": None,
                "affected_day": None,
                "affected_shift": None,
                "affected_ward": None
            }

    def _get_severity(self, ward):
        if ward is None:
            return "LOW"
        severity_mapping = {
            "ICU": "HIGH",
            "ER": "HIGH",
            "Emergency": "HIGH",
            "Operating Room": "HIGH",
            "CCU": "HIGH",
            "Surgery": "HIGH",
            "Ward 1": "MEDIUM",
            "Ward 2": "MEDIUM",
            "General": "LOW",
        }
        return severity_mapping.get(ward.strip().upper(), "LOW")

    def _find_replacement(self, affected_nurse, day, shift, ward, current_schedule, nurses):
        # ICU & similar need N3 or higher, else any skill.
        critical_wards = set(["ICU", "CCU", "ER", "Emergency", "Operating Room", "Surgery"])
        nurse_skill_rank = {"N1": 1, "N2": 2, "N3": 3, "N4": 4}

        required_skill = None
        if ward and ward.strip().upper() in critical_wards:
            required_skill = "N3"
        # Find slot in schedule for this nurse & shift
        slot_found = False
        updated_schedule = []
        target_assignment = None

        # locate affected assignment and prepare updated schedule
        for item in current_schedule:
            # assuming item: {"nurse": "...", "day": "...", "shift": "...", "ward": "..."}
            if (
                item["nurse"] == affected_nurse
                and item["day"] == day
                and item["shift"].lower() == shift.lower()
                and item["ward"].lower() == ward.lower()
            ):
                slot_found = True
                target_assignment = item
            else:
                updated_schedule.append(item)
        if not slot_found:
            # assignment may not exist; search by day/shift/ward only
            for item in current_schedule:
                if (
                    item["day"] == day
                    and item["shift"].lower() == shift.lower()
                    and item["ward"].lower() == ward.lower()
                ):
                    slot_found = True
                    target_assignment = item
                    updated_schedule = [i for i in current_schedule if i != item]
                    break
        # Find replacement nurse
        assigned_nurses = {
            (entry["day"], entry["shift"].lower(), entry["ward"].lower()): entry["nurse"] for entry in current_schedule
        }
        replacement = None
        for nurse in nurses:
            n_name = nurse["name"]
            n_skill = nurse.get("skill", "N1")
            # skip affected nurse
            if n_name == affected_nurse:
                continue
            # check skill level
            if required_skill is not None:
                if nurse_skill_rank.get(n_skill, 0) < nurse_skill_rank[required_skill]:
                    continue
            # make sure not already assigned to this shift/ward
            if (day, shift.lower(), ward.lower()) in assigned_nurses and assigned_nurses[(day, shift.lower(), ward.lower())] == n_name:
                continue
            # passed checks
            replacement = nurse
            break
        # allocate
        if replacement and target_assignment:
            new_assignment = dict(target_assignment)
            new_assignment["nurse"] = replacement["name"]
            updated_schedule.append(new_assignment)
            action = f"Reassigned {replacement['name']} to cover {ward} on {day} ({shift}) due to {affected_nurse}'s disruption."
        elif replacement:
            new_assignment = {
                "nurse": replacement["name"],
                "day": day,
                "shift": shift,
                "ward": ward
            }
            updated_schedule.append(new_assignment)
            action = f"Assigned {replacement['name']} to cover {ward} on {day} ({shift}) as a new shift; original nurse unavailable."
        else:
            # no replacement found, keep schedule as is
            updated_schedule = current_schedule
            action = f"No suitable replacement nurse found for {ward} on {day} ({shift})."
        return updated_schedule, action

    def handle(self, disruption, current_schedule, nurses):
        # 1. Use Gemini to extract structured info
        res = self._call_gemini(disruption)
        affected_nurse = res.get("affected_nurse")
        affected_day = res.get("affected_day")
        affected_shift = res.get("affected_shift")
        affected_ward = res.get("affected_ward")

        # 2. Determine severity
        severity = self._get_severity(affected_ward)

        # 3. Find nurse replacement and update schedule
        updated_schedule, action_taken = self._find_replacement(
            affected_nurse, affected_day, affected_shift, affected_ward, current_schedule, nurses
        )

        return {
            "updated_schedule": updated_schedule,
            "action_taken": action_taken,
            "severity": severity,
        }
