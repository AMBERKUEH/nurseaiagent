"""
Orchestrator: Coordinates all agents for nurse scheduling workflow.
Integrates MemoryAgent, BrightDataAgent, and SchedulingAgent.
"""

import json
from typing import Dict, List, Any, Optional

from agent_memory import MemoryAgent
from agent1_scheduler import SchedulingAgent
from agent_brightdata import BrightDataAgent


class SchedulingOrchestrator:
    """
    Orchestrates the nurse scheduling workflow:
    1. Recalls past problem days from memory
    2. Generates schedule with context
    3. Learns from approved schedule
    """
    
    def __init__(self, city: str = "Shanghai"):
        """Initialize orchestrator with all agents."""
        self.memory_agent = MemoryAgent()
        self.scheduling_agent = SchedulingAgent()
        self.brightdata_agent = BrightDataAgent()
        self.city = city
        self.external_signals = None
        print("SchedulingOrchestrator initialized")
    
    def generate_schedule(
        self,
        nurses: List[Dict[str, Any]],
        rules: Dict[str, Any],
        staffing_requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a schedule with memory context.
        
        Workflow:
        1. Recall problem days and fatigue risks from memory
        2. Pass context to scheduling agent
        3. Return generated schedule with metadata
        
        Args:
            nurses: List of nurse dicts
            rules: Scheduling rules
            staffing_requirements: Minimum staffing per shift
        
        Returns:
            Dict with schedule and context used
        """
        print("\n" + "=" * 60)
        print("ORCHESTRATOR: Generating Schedule")
        print("=" * 60)
        
        # Step 1: Recall memory context
        print("\n[1/3] Recalling memory context...")
        context = self.memory_agent.get_scheduling_context()
        
        problem_days = context.get("problem_days", [])
        fatigue_risks = context.get("fatigue_risk_nurses", [])
        compliance_history = context.get("compliance_history", [])
        
        print(f"  - Problem days from history: {problem_days}")
        print(f"  - High fatigue risk nurses: {[n['name'] for n in fatigue_risks]}")
        if compliance_history:
            last_score = compliance_history[-1].get("score", "N/A")
            print(f"  - Last compliance score: {last_score}")
        
        # Step 2: Enhance rules with memory context
        print("\n[2/3] Enhancing rules with memory context...")
        enhanced_rules = self._enhance_rules_with_memory(rules, context)
        
        # Step 3: Generate schedule
        print("\n[3/3] Calling SchedulingAgent...")
        schedule = self.scheduling_agent.generate(nurses, enhanced_rules, staffing_requirements)
        
        result = {
            "schedule": schedule,
            "context_used": {
                "problem_days_avoided": problem_days,
                "fatigue_risk_nurses": fatigue_risks,
                "compliance_history_count": len(compliance_history)
            },
            "metadata": {
                "nurses_count": len(nurses),
                "rules_applied": list(enhanced_rules.keys())
            }
        }
        
        print("\nSchedule generated successfully!")
        return result
    
    def _enhance_rules_with_memory(
        self,
        rules: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Enhance scheduling rules with memory context.
        
        Args:
            rules: Base scheduling rules
            context: Memory context
        
        Returns:
            Enhanced rules dict
        """
        enhanced = rules.copy()
        
        # Add problem days as soft constraints
        problem_days = context.get("problem_days", [])
        if problem_days:
            enhanced["problem_days_history"] = problem_days
            enhanced["problem_days_note"] = (
                f"These days had compliance violations before: {', '.join(problem_days)}. "
                "Consider extra staffing or careful assignment on these days."
            )
        
        # Add fatigue risk nurse constraints
        fatigue_risks = context.get("fatigue_risk_nurses", [])
        if fatigue_risks:
            high_risk_nurses = [n["name"] for n in fatigue_risks if n.get("risk_level") == "HIGH"]
            if high_risk_nurses:
                enhanced["fatigue_risk_nurses"] = high_risk_nurses
                enhanced["fatigue_note"] = (
                    f"These nurses had excessive night shifts: {', '.join(high_risk_nurses)}. "
                    "Limit their night shifts this week."
                )
        
        return enhanced
    
    def approve_and_learn(
        self,
        schedule: Dict[str, Dict[str, List[str]]],
        compliance_report: Dict[str, Any],
        nurses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Approve a schedule and learn from it.
        
        Args:
            schedule: The approved schedule
            compliance_report: Compliance analysis with violations
            nurses: Nurse data for context
        
        Returns:
            Insights extracted and stored
        """
        print("\n" + "=" * 60)
        print("ORCHESTRATOR: Learning from Approved Schedule")
        print("=" * 60)
        
        insights = self.memory_agent.learn_from_schedule(
            schedule,
            compliance_report,
            nurses
        )
        
        print("\nLearning complete. Insights stored in memory.")
        return insights
    
    def explain_nurse_schedule(
        self,
        nurse_name: str,
        schedule: Dict[str, Dict[str, List[str]]]
    ) -> str:
        """
        Get explanation for a nurse's schedule assignments.
        
        Args:
            nurse_name: Name of nurse to explain
            schedule: The schedule
        
        Returns:
            2-sentence explanation
        """
        return self.scheduling_agent.explain(nurse_name, schedule)
    
    def get_memory_summary(self) -> Dict[str, Any]:
        """Get summary of stored memory."""
        return self.memory_agent.get_scheduling_context()


def run_scheduling_workflow(
    nurses: List[Dict[str, Any]],
    rules: Dict[str, Any],
    staffing_requirements: Dict[str, Any],
    city: str = "Shanghai",
    simulate_approval: bool = True
) -> Dict[str, Any]:
    """
    Run the complete scheduling workflow with all agents.
    
    Pipeline:
    1. BrightDataAgent: Fetch external signals (holidays, weather)
    2. MemoryAgent: Recall past problem days
    3. SchedulingAgent: Generate schedule with all context
    4. Compliance check (simulated)
    5. MemoryAgent: Learn from approved schedule
    
    Args:
        nurses: List of nurse dicts
        rules: Scheduling rules
        staffing_requirements: Staffing requirements
        city: City for external signals
        simulate_approval: If True, simulate approval and learning
    
    Returns:
        Complete workflow result
    """
    print("\n" + "=" * 60)
    print("STARTING SCHEDULING PIPELINE")
    print("=" * 60)
    
    orchestrator = SchedulingOrchestrator(city=city)
    
    # Step 1: Fetch external signals from BrightDataAgent
    print("\n[Pipeline Step 1/5] Fetching external signals...")
    external_signals = orchestrator.brightdata_agent.get_external_signals(city)
    orchestrator.external_signals = external_signals
    
    # Step 2: Generate schedule (includes memory recall internally)
    print("\n[Pipeline Step 2/5] Generating schedule with context...")
    result = orchestrator.generate_schedule(nurses, rules, staffing_requirements)
    result["external_signals"] = external_signals
    schedule = result["schedule"]
    
    # Step 3: Compliance check (simulated)
    print("\n[Pipeline Step 3/5] Running compliance check...")
    compliance_report = {
        "score": 90,
        "violations": [],
        "checks_passed": ["max_shifts", "rest_periods", "skill_coverage"],
        "external_context_used": external_signals["recommendation"]
    }
    result["compliance"] = compliance_report
    
    # Step 4: Learn from schedule (if approved)
    if simulate_approval:
        print("\n[Pipeline Step 4/5] Learning from approved schedule...")
        insights = orchestrator.approve_and_learn(schedule, compliance_report, nurses)
        result["insights"] = insights
    
    print("\n[Pipeline Step 5/5] Pipeline complete!")
    print("=" * 60)
    
    return result


if __name__ == "__main__":
    # Test the orchestrator
    print("=" * 60)
    print("ORCHESTRATOR TEST")
    print("=" * 60)
    
    # Sample data
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
    
    # Pre-populate some memory for demonstration
    orchestrator = SchedulingOrchestrator()
    orchestrator.memory_agent.remember("problem_days", ["Monday", "Friday"])
    orchestrator.memory_agent.remember("fatigue_risk_nurses", [
        {"name": "Liu Ming", "night_shifts": 4, "risk_level": "HIGH"}
    ])
    
    # Run workflow
    print("\nRunning scheduling workflow...")
    result = run_scheduling_workflow(
        sample_nurses,
        sample_rules,
        sample_staffing,
        simulate_approval=True
    )
    
    # Display results
    print("\n" + "=" * 60)
    print("WORKFLOW RESULT")
    print("=" * 60)
    
    print("\nExternal Signals (BrightDataAgent):")
    print(json.dumps(result["external_signals"], indent=2, ensure_ascii=False))
    
    print("\nMemory Context Used:")
    print(json.dumps(result["context_used"], indent=2, ensure_ascii=False))
    
    print("\nGenerated Schedule (sample):")
    for day in ["Monday", "Tuesday", "Wednesday"]:
        print(f"\n  {day}:")
        for shift in ["morning", "afternoon", "night"]:
            nurses = result["schedule"][day][shift]
            print(f"    {shift}: {', '.join(nurses) if nurses else '(empty)'}")
    
    print("\nCompliance Report:")
    print(json.dumps(result["compliance"], indent=2, ensure_ascii=False))
    
    print("\nInsights Learned:")
    print(json.dumps(result.get("insights", {}), indent=2, ensure_ascii=False))
    
    print("\n" + "=" * 60)
    print("ORCHESTRATOR TEST COMPLETE")
    print("=" * 60)
