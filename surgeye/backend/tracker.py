"""
SurgEye: Instrument Tracker Module
Tracks instrument counts and triggers alerts for missing items.
"""

from typing import Dict, List, Optional
from datetime import datetime


class InstrumentTracker:
    """
    Tracks surgical instrument state throughout the procedure.
    Detects missing instruments by comparing current counts to baseline.
    """
    
    def __init__(self):
        self.baseline: Dict[str, int] = {}  # Set at pre-op
        self.current: Dict[str, int] = {}   # Current frame counts
        self.alerts: List[str] = []         # Active alerts
        self.alert_history: List[Dict] = [] # All alerts with timestamps
        self.procedure_started = False
        self.procedure_ended = False
        
    def set_baseline(self, counts: Dict[str, int]):
        """
        Set the baseline instrument count at the start of procedure.
        
        Args:
            counts: Dictionary mapping instrument class to count
        """
        self.baseline = counts.copy()
        self.procedure_started = True
        self.procedure_ended = False
        self.alerts = []
        print(f"[SurgEye] Baseline set: {self.baseline}")
        
    def update(self, counts: Dict[str, int]) -> List[str]:
        """
        Update current counts and generate alerts for missing instruments.
        
        Args:
            counts: Current instrument counts from detection
            
        Returns:
            List of alert messages
        """
        if not self.procedure_started:
            return ["⚠️ No baseline set - cannot track instruments"]
        
        self.current = counts.copy()
        new_alerts = []
        
        # Check for missing instruments
        for cls, expected in self.baseline.items():
            actual = counts.get(cls, 0)
            if actual < expected:
                missing = expected - actual
                alert_msg = f"MISSING: {missing}x {cls}"
                if alert_msg not in self.alerts:
                    new_alerts.append(alert_msg)
                    self.alert_history.append({
                        'timestamp': datetime.now().isoformat(),
                        'message': alert_msg,
                        'expected': expected,
                        'actual': actual
                    })
        
        # Check for unexpected instruments (possible contamination)
        for cls, actual in counts.items():
            expected = self.baseline.get(cls, 0)
            if actual > expected:
                extra = actual - expected
                alert_msg = f"EXTRA: {extra}x {cls} (not in baseline)"
                if alert_msg not in self.alerts:
                    new_alerts.append(alert_msg)
        
        self.alerts = new_alerts
        return new_alerts
    
    def check_postop(self) -> Dict:
        """
        Perform post-operative instrument count check.
        
        Returns:
            Dictionary with check results
        """
        if not self.procedure_started:
            return {
                'passed': False,
                'error': 'No baseline set'
            }
        
        self.procedure_ended = True
        
        # Compare current to baseline
        mismatches = []
        all_match = True
        
        for cls, expected in self.baseline.items():
            actual = self.current.get(cls, 0)
            if actual != expected:
                all_match = False
                mismatches.append({
                    'class': cls,
                    'expected': expected,
                    'actual': actual,
                    'difference': actual - expected
                })
        
        return {
            'passed': all_match,
            'baseline': self.baseline,
            'final': self.current,
            'mismatches': mismatches,
            'alerts': self.alerts,
            'alert_history': self.alert_history
        }
    
    def get_status(self) -> Dict:
        """
        Get current tracking status.
        
        Returns:
            Status dictionary
        """
        return {
            'procedure_started': self.procedure_started,
            'procedure_ended': self.procedure_ended,
            'baseline': self.baseline,
            'current': self.current,
            'alerts': self.alerts,
            'alert_count': len(self.alerts)
        }
    
    def reset(self):
        """Reset tracker for new procedure."""
        self.baseline = {}
        self.current = {}
        self.alerts = []
        self.alert_history = []
        self.procedure_started = False
        self.procedure_ended = False


# Global tracker instance
tracker = InstrumentTracker()
