"""
SurgEye Rostering Agent
Integrates with NurseAI to remove nurses from roster when instruments go missing.
"""

import sys
import os
from datetime import datetime
from typing import Dict, List, Any

# Add NurseAI backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

class RosteringAgent:
    """
    AI Agent that handles nurse rostering when equipment violations occur.
    
    Perceive: Missing instruments detected
    Reason: Nurse violated protocol → must be investigated
    Act: Remove from roster, find replacement, log evidence
    """
    
    def __init__(self):
        self.investigations = []
        
    async def handle_missing_instruments(
        self, 
        missing_items: Dict[str, int],
        nurse_id: str,
        nurse_name: str,
        session_id: str,
        evidence: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle missing instrument violation.
        
        Args:
            missing_items: Dict of instrument class -> count missing
            nurse_id: Nurse ID
            nurse_name: Nurse name
            session_id: Surgery session ID
            evidence: Dict with baseline_image, postop_image, timeline
            
        Returns:
            Action summary
        """
        print(f"\n[🚨 ROSTERING AGENT] Missing instruments detected!")
        print(f"   Nurse: {nurse_name} (ID: {nurse_id})")
        print(f"   Missing: {missing_items}")
        
        actions_taken = []
        
        # 1. Flag nurse in system
        self._flag_nurse(nurse_id, nurse_name, missing_items, session_id)
        actions_taken.append(f"Flagged nurse {nurse_name} for investigation")
        
        # 2. Remove from upcoming shifts
        removed_shifts = await self._remove_from_roster(nurse_id)
        actions_taken.append(f"Removed from {len(removed_shifts)} upcoming shifts")
        
        # 3. Find replacements for each shift
        replacements = []
        for shift in removed_shifts:
            replacement = await self._find_replacement(shift)
            if replacement:
                replacements.append({
                    'shift': shift,
                    'replacement': replacement
                })
        actions_taken.append(f"Found {len(replacements)} replacement nurses")
        
        # 4. Create investigation record with evidence
        investigation_id = self._create_investigation(
            nurse_id=nurse_id,
            nurse_name=nurse_name,
            missing_items=missing_items,
            evidence=evidence,
            session_id=session_id
        )
        actions_taken.append(f"Created investigation #{investigation_id}")
        
        # 5. Store in database (if available)
        try:
            await self._store_in_database(
                nurse_id=nurse_id,
                missing_items=missing_items,
                investigation_id=investigation_id,
                evidence=evidence
            )
            actions_taken.append("Stored evidence in database")
        except Exception as e:
            print(f"[RosteringAgent] DB storage failed: {e}")
        
        result = {
            "status": "NURSE_REMOVED_FROM_ROSTER",
            "nurse_id": nurse_id,
            "nurse_name": nurse_name,
            "missing_items": missing_items,
            "investigation_id": investigation_id,
            "actions_taken": actions_taken,
            "removed_shifts": removed_shifts,
            "replacements": replacements,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"\n[✅ ROSTERING AGENT] Actions completed:")
        for action in actions_taken:
            print(f"   • {action}")
        
        return result
    
    def _flag_nurse(self, nurse_id: str, nurse_name: str, missing_items: Dict, session_id: str):
        """Flag nurse for investigation."""
        flag_record = {
            "nurse_id": nurse_id,
            "nurse_name": nurse_name,
            "reason": "MISSING_SURGICAL_INSTRUMENTS",
            "missing_items": missing_items,
            "session_id": session_id,
            "flagged_at": datetime.now().isoformat(),
            "status": "UNDER_INVESTIGATION"
        }
        self.investigations.append(flag_record)
        print(f"[RosteringAgent] Flagged nurse {nurse_name}")
    
    async def _remove_from_roster(self, nurse_id: str) -> List[Dict]:
        """Remove nurse from upcoming shifts."""
        # TODO: Integrate with NurseAI database
        # For now, return mock data
        removed_shifts = [
            {"id": "shift_001", "date": "2026-03-04", "time": "08:00-16:00"},
            {"id": "shift_002", "date": "2026-03-05", "time": "16:00-00:00"},
        ]
        print(f"[RosteringAgent] Removed from {len(removed_shifts)} shifts")
        return removed_shifts
    
    async def _find_replacement(self, shift: Dict) -> Dict:
        """Find replacement nurse for shift."""
        # TODO: Call NurseAI SchedulingAgent
        # For now, return mock replacement
        replacement = {
            "id": "nurse_999",
            "name": "Backup Nurse",
            "grade": "N3"
        }
        print(f"[RosteringAgent] Found replacement for shift {shift['id']}")
        return replacement
    
    def _create_investigation(
        self, 
        nurse_id: str, 
        nurse_name: str,
        missing_items: Dict, 
        evidence: Dict,
        session_id: str
    ) -> str:
        """Create investigation record with evidence."""
        investigation_id = f"INV_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        investigation = {
            "id": investigation_id,
            "nurse_id": nurse_id,
            "nurse_name": nurse_name,
            "type": "SURGICAL_INSTRUMENT_MISCOUNT",
            "missing_items": missing_items,
            "evidence": {
                "baseline_image": evidence.get("baseline_image"),
                "postop_image": evidence.get("postop_image"),
                "timeline": evidence.get("timeline", []),
                "session_id": session_id
            },
            "created_at": datetime.now().isoformat(),
            "status": "PENDING_REVIEW"
        }
        
        self.investigations.append(investigation)
        print(f"[RosteringAgent] Created investigation {investigation_id}")
        return investigation_id
    
    async def _store_in_database(self, nurse_id: str, missing_items: Dict, investigation_id: str, evidence: Dict):
        """Store evidence in NurseAI database."""
        # TODO: Integrate with actual NurseAI database
        # This would call the MemoryAgent or database API
        print(f"[RosteringAgent] Stored evidence in database")
    
    def get_investigations(self, nurse_id: str = None) -> List[Dict]:
        """Get all investigations, optionally filtered by nurse."""
        if nurse_id:
            return [inv for inv in self.investigations if inv.get("nurse_id") == nurse_id]
        return self.investigations


# Global instance
rostering_agent = RosteringAgent()


async def trigger_rostering_alert(missing_items: Dict, nurse_id: str, nurse_name: str = "Unknown"):
    """
    Convenience function to trigger rostering agent.
    Called from scan-postop endpoint when instruments are missing.
    """
    evidence = {
        "baseline_image": None,  # Would be populated from scan
        "postop_image": None,
        "timeline": []
    }
    
    return await rostering_agent.handle_missing_instruments(
        missing_items=missing_items,
        nurse_id=nurse_id,
        nurse_name=nurse_name,
        session_id=f"SESSION_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        evidence=evidence
    )


if __name__ == "__main__":
    # Test the agent
    import asyncio
    
    async def test():
        result = await trigger_rostering_alert(
            missing_items={"Forceps": 1, "Scalpel": 1},
            nurse_id="NURSE_001",
            nurse_name="Sarah Chen"
        )
        print("\n" + "="*60)
        print("TEST RESULT:")
        print("="*60)
        print(result)
    
    asyncio.run(test())
