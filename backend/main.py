"""
main.py - FastAPI server for NurseAI Multi-Agent Scheduling System

Endpoints:
- GET /api/health - Health check
- GET /api/nurses - Get hardcoded nurses list
- POST /api/generate-schedule - Generate schedule using Orchestrator
- POST /api/emergency - Handle emergency disruptions
"""

import sys
import os

# Add agents directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "agents"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from orchestrator import Orchestrator
from agent4_emergency import EmergencyAgent

# Initialize FastAPI app
app = FastAPI(
    title="NurseAI Multi-Agent Scheduling API",
    description="AI-powered nurse scheduling with Forecast, Scheduling, Compliance, and Emergency agents",
    version="1.0.0"
)

# Enable CORS for frontend (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize orchestrator
orchestrator = Orchestrator()
emergency_agent = EmergencyAgent()

# Hardcoded nurses data
HARDCODED_NURSES = [
    {
        "name": "Zhang Wei",
        "skill": "N3",
        "ward": "ICU",
        "unavailable_days": ["Tuesday"]
    },
    {
        "name": "Li Na",
        "skill": "N2",
        "ward": "General",
        "unavailable_days": []
    },
    {
        "name": "Wang Fang",
        "skill": "N4",
        "ward": "ER",
        "unavailable_days": ["Friday"]
    },
    {
        "name": "Chen Jing",
        "skill": "N2",
        "ward": "Pediatrics",
        "unavailable_days": ["Wednesday"]
    },
    {
        "name": "Liu Yang",
        "skill": "N3",
        "ward": "ICU",
        "unavailable_days": []
    }
]

# Default scheduling rules
DEFAULT_RULES = {
    "max_shifts_per_week": 5,
    "min_rest_hours": 12,
    "ward_skill_requirements": {
        "ICU": "N3",
        "ER": "N3",
        "General": "N2",
        "Pediatrics": "N2"
    }
}


# Pydantic models for request/response
class GenerateScheduleRequest(BaseModel):
    nurses: Optional[List[Dict[str, Any]]] = None
    rules: Optional[Dict[str, Any]] = None


class EmergencyRequest(BaseModel):
    disruption: str


class EmergencyResponse(BaseModel):
    alerts: List[str]
    reassignments: List[str]
    severity: str
    action_taken: str


# Health check endpoint
@app.get("/api/health")
def health_check():
    """
    Health check endpoint.
    
    Returns:
        {"status": "ok"}
    """
    return {"status": "ok"}


# Get nurses endpoint
@app.get("/api/nurses")
def get_nurses():
    """
    Get the hardcoded list of nurses.
    
    Returns:
        List of nurse objects with name, skill, ward, unavailable_days
    """
    return HARDCODED_NURSES


# Generate schedule endpoint
@app.post("/api/generate-schedule")
def generate_schedule(request: GenerateScheduleRequest):
    """
    Generate a complete schedule using all agents.
    
    Pipeline:
    1. ForecastAgent predicts staffing requirements
    2. SchedulingAgent generates schedule
    3. ComplianceAgent checks for violations
    4. EmergencyAgent checks for conflicts
    
    Args:
        request: Optional nurses and rules (uses defaults if not provided)
    
    Returns:
        Dict with schedule, staffing_requirements, compliance, and alerts
    """
    try:
        # Use provided data or defaults
        nurses = request.nurses if request.nurses else HARDCODED_NURSES
        rules = request.rules if request.rules else DEFAULT_RULES
        
        # Run orchestrator
        result = orchestrator.run(nurses, rules)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schedule generation failed: {str(e)}")


# Emergency endpoint
@app.post("/api/emergency")
def handle_emergency(request: EmergencyRequest):
    """
    Handle an emergency disruption.
    
    Args:
        request: EmergencyRequest with disruption description
    
    Returns:
        EmergencyResponse with alerts, reassignments, severity, and action
    """
    try:
        # Get current schedule first (generate one)
        schedule_result = orchestrator.run(HARDCODED_NURSES, DEFAULT_RULES)
        current_schedule = schedule_result["schedule"]
        
        # Handle emergency
        result = orchestrator.handle_emergency(
            disruption=request.disruption,
            current_schedule=current_schedule,
            nurses=HARDCODED_NURSES
        )
        
        return EmergencyResponse(
            alerts=result["alerts"],
            reassignments=result["reassignments"],
            severity=result["severity"],
            action_taken=result["action_taken"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Emergency handling failed: {str(e)}")


# Root endpoint
@app.get("/")
def root():
    """
    Root endpoint - API info.
    """
    return {
        "name": "NurseAI Multi-Agent Scheduling API",
        "version": "1.0.0",
        "agents": [
            "ForecastAgent",
            "SchedulingAgent",
            "ComplianceAgent",
            "EmergencyAgent"
        ],
        "endpoints": [
            "/api/health",
            "/api/nurses",
            "/api/generate-schedule",
            "/api/emergency"
        ]
    }


# Run server if executed directly
if __name__ == "__main__":
    import uvicorn
    print("Starting NurseAI API Server...")
    print("Available endpoints:")
    print("  - GET  /api/health")
    print("  - GET  /api/nurses")
    print("  - POST /api/generate-schedule")
    print("  - POST /api/emergency")
    print("\nServer running at http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
