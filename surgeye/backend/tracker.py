"""
SurgEye: Instrument Tracker Module
Enhanced with timeline logging and screenshot capture for alerts.
"""

from typing import Dict, List, Optional
from datetime import datetime
from detect import log_event, save_alert_screenshot, get_instrument_log, clear_instrument_log, get_alert_screenshots


class InstrumentTracker:
    """
    Tracks surgical instrument state throughout the procedure.
    Detects missing instruments by comparing current counts to baseline.
    """
    
    def __init__(self):
        self.baseline: Dict[str, Dict] = {}  # Set at pre-op (with confidence)
        self.current: Dict[str, Dict] = {}   # Current frame counts (with confidence)
        self.alerts: List[str] = []          # Active alerts
        self.alert_history: List[Dict] = []  # All alerts with timestamps
        self.procedure_started = False
        self.procedure_ended = False
        self.previous_counts: Dict[str, int] = {}  # For detecting changes
        self.alert_screenshots: List[str] = []     # Paths to alert images
        
    def set_baseline(self, counts: Dict[str, Dict]):
        """
        Set the baseline instrument count at the start of procedure.
        
        Args:
            counts: Dictionary mapping instrument class to count info
        """
        self.baseline = counts.copy()
        self.procedure_started = True
        self.procedure_ended = False
        self.alerts = []
        self.alert_screenshots = []
        clear_instrument_log()
        
        # Log baseline instruments
        for cls, info in counts.items():
            log_event(cls, 'baseline_set', info.get('avg_confidence'))
        
        print(f"[SurgEye] Baseline set: {self.baseline}")
        
    def update(self, counts: Dict[str, Dict], current_frame=None) -> List[str]:
        """
        Update current counts and generate alerts for missing instruments.
        
        Args:
            counts: Current instrument counts from detection
            current_frame: Optional frame for screenshot capture
            
        Returns:
            List of alert messages
        """
        if not self.procedure_started:
            return ["⚠️ No baseline set - cannot track instruments"]
        
        self.current = counts.copy()
        new_alerts = []
        
        # Get simple counts for comparison
        current_simple = {cls: info['count'] for cls, info in counts.items()}
        baseline_simple = {cls: info['count'] for cls, info in self.baseline.items()}
        
        # Check for missing instruments
        for cls, expected_info in self.baseline.items():
            expected = expected_info['count']
            actual_info = counts.get(cls, {'count': 0})
            actual = actual_info['count']
            
            if actual < expected:
                missing = expected - actual
                alert_msg = f"MISSING: {missing}x {cls}"
                
                # Check if this is a new alert
                if alert_msg not in self.alerts:
                    new_alerts.append(alert_msg)
                    self.alert_history.append({
                        'timestamp': datetime.now().isoformat(),
                        'message': alert_msg,
                        'expected': expected,
                        'actual': actual,
                        'instrument': cls
                    })
                    
                    # Log the missing event
                    log_event(cls, 'missing', actual_info.get('avg_confidence'))
                    
                    # Save screenshot if frame provided
                    if current_frame is not None:
                        screenshot_path = save_alert_screenshot(current_frame, cls)
                        self.alert_screenshots.append(screenshot_path)
        
        # Check for returned instruments (were missing, now present)
        for cls in self.baseline:
            prev_count = self.previous_counts.get(cls, 0)
            curr_count = current_simple.get(cls, 0)
            expected = baseline_simple.get(cls, 0)
            
            if prev_count < expected and curr_count == expected:
                log_event(cls, 'returned', counts.get(cls, {}).get('avg_confidence'))
        
        # Check for unexpected instruments (possible contamination)
        for cls, actual_info in counts.items():
            actual = actual_info['count']
            expected = baseline_simple.get(cls, 0)
            if actual > expected:
                extra = actual - expected
                alert_msg = f"EXTRA: {extra}x {cls} (not in baseline)"
                if alert_msg not in self.alerts:
                    new_alerts.append(alert_msg)
        
        # Log newly detected instruments
        for cls in counts:
            if cls not in self.previous_counts or self.previous_counts.get(cls, 0) == 0:
                if counts[cls]['count'] > 0:
                    log_event(cls, 'detected', counts[cls].get('avg_confidence'))
        
        self.alerts = new_alerts
        self.previous_counts = current_simple
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
        
        baseline_simple = {cls: info['count'] for cls, info in self.baseline.items()}
        current_simple = {cls: info['count'] for cls, info in self.current.items()}
        
        for cls, expected in baseline_simple.items():
            actual = current_simple.get(cls, 0)
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
            'baseline': baseline_simple,
            'final': current_simple,
            'mismatches': mismatches,
            'alerts': self.alerts,
            'alert_history': self.alert_history,
            'timeline_log': get_instrument_log(),
            'alert_screenshots': self.alert_screenshots
        }
    
    def get_status(self) -> Dict:
        """
        Get current tracking status.
        
        Returns:
            Status dictionary
        """
        baseline_simple = {cls: info['count'] for cls, info in self.baseline.items()} if self.baseline else {}
        current_simple = {cls: info['count'] for cls, info in self.current.items()} if self.current else {}
        
        return {
            'procedure_started': self.procedure_started,
            'procedure_ended': self.procedure_ended,
            'baseline': baseline_simple,
            'current': current_simple,
            'alerts': self.alerts,
            'alert_count': len(self.alerts),
            'timeline_log': get_instrument_log(),
            'alert_screenshots': self.alert_screenshots
        }
    
    def reset(self):
        """Reset tracker for new procedure."""
        self.baseline = {}
        self.current = {}
        self.alerts = []
        self.alert_history = []
        self.previous_counts = {}
        self.alert_screenshots = []
        self.procedure_started = False
        self.procedure_ended = False
        clear_instrument_log()


# Global tracker instance
tracker = InstrumentTracker()
