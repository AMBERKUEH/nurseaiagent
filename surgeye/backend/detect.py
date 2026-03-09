"""
SurgEye: Surgical Instrument Detection Module
Enhanced with confidence filtering, stability tracking, timeline logging, and screenshot alerts.
"""

from inference import get_model
import cv2
import numpy as np
import os
from datetime import datetime
from typing import List, Dict, Tuple, Any
from collections import Counter, deque

# Roboflow API Configuration
ROBOFLOW_API_KEY = "bX5IkiMxH6IOh59gH6Ku"
MODEL_ID = "abhinav-ytcui/surgical-instruments-zmagm/1"

# Surgical instrument classes from Abhinav's model
CLASSES = [
    'Army_navy', 'Bulldog', 'Castroviejo', 'Forceps',
    'Frazier', 'Hemostat', 'IrisNeedle', 'Mayo_metz', 'Potts'
]

# Detection stability buffer (for 3-frame confirmation)
STABILITY_FRAMES = 3
frame_buffer = deque(maxlen=STABILITY_FRAMES)

# Instrument timeline log
instrument_log: List[Dict[str, Any]] = []

# Create alerts directory
os.makedirs('alerts', exist_ok=True)

# Load Roboflow pretrained model
print("[SurgEye] Loading Roboflow surgical instruments model...")
model = get_model(
    model_id=MODEL_ID,
    api_key=ROBOFLOW_API_KEY
)
print("[SurgEye] Model loaded successfully!")


def detect_frame(frame: np.ndarray, conf_threshold: float = 0.5) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Detect surgical instruments with confidence filtering.
    
    Args:
        frame: Input image/frame (numpy array)
        conf_threshold: Confidence threshold for detections (default 50%)
        
    Returns:
        Tuple of (annotated_frame, detections_list)
    """
    # Run inference with Roboflow
    results = model.infer(frame)[0]
    
    detections = []
    annotated = frame.copy()
    
    for pred in results.predictions:
        # Filter by confidence threshold (default 50%)
        if pred.confidence < conf_threshold:
            continue
            
        # Calculate bounding box coordinates
        x1 = int(pred.x - pred.width / 2)
        y1 = int(pred.y - pred.height / 2)
        x2 = int(pred.x + pred.width / 2)
        y2 = int(pred.y + pred.height / 2)
        
        detection = {
            'class': pred.class_name,
            'confidence': round(pred.confidence, 2),
            'bbox': [x1, y1, x2, y2],
            'center': [int(pred.x), int(pred.y)]
        }
        detections.append(detection)
        
        # Draw bounding box with confidence-based color
        confidence_color = get_confidence_color(pred.confidence)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), confidence_color, 2)
        
        # Draw label with confidence percentage
        label = f"{pred.class_name} {pred.confidence:.0%}"
        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
        label_y = y1 - 10 if y1 - 10 > 10 else y1 + 20
        
        # Label background
        cv2.rectangle(annotated, 
                     (x1, label_y - label_size[1] - 4),
                     (x1 + label_size[0], label_y + 4),
                     confidence_color, -1)
        
        # Label text
        cv2.putText(annotated, label,
                   (x1, label_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
    
    return annotated, detections


def get_confidence_color(confidence: float) -> Tuple[int, int, int]:
    """Get color based on confidence level."""
    if confidence >= 0.8:
        return (0, 255, 0)  # Green - High confidence
    elif confidence >= 0.6:
        return (0, 255, 200)  # Teal - Medium confidence
    else:
        return (0, 165, 255)  # Orange - Low confidence


def get_stable_detections(detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Get stable detections that appear in consecutive frames.
    Reduces flickering by requiring 3-frame confirmation.
    """
    frame_buffer.append(detections)
    
    if len(frame_buffer) < STABILITY_FRAMES:
        return detections  # Not enough frames yet
    
    # Count occurrences of each instrument class across frames
    all_detections = []
    for frame_dets in frame_buffer:
        all_detections.extend(frame_dets)
    
    # Group by class and find stable detections
    class_groups = {}
    for det in all_detections:
        cls = det['class']
        if cls not in class_groups:
            class_groups[cls] = []
        class_groups[cls].append(det)
    
    stable_detections = []
    for cls, dets in class_groups.items():
        if len(dets) >= STABILITY_FRAMES:
            # Use the detection with highest confidence
            best_det = max(dets, key=lambda x: x['confidence'])
            stable_detections.append(best_det)
    
    return stable_detections


def log_event(cls: str, action: str, confidence: float = None):
    """
    Log instrument event to timeline.
    
    Args:
        cls: Instrument class name
        action: 'detected', 'removed', 'missing', or 'returned'
        confidence: Detection confidence (optional)
    """
    event = {
        'instrument': cls,
        'action': action,
        'time': datetime.now().strftime('%H:%M:%S'),
        'timestamp': datetime.now().isoformat(),
        'confidence': confidence
    }
    instrument_log.append(event)
    print(f"[SurgEye Log] {event['time']} - {cls} {action}")


def get_instrument_log() -> List[Dict[str, Any]]:
    """Get the full instrument timeline log."""
    return instrument_log.copy()


def clear_instrument_log():
    """Clear the instrument log (for new procedure)."""
    global instrument_log
    instrument_log = []
    frame_buffer.clear()


def save_alert_screenshot(frame: np.ndarray, missing_instrument: str):
    """
    Save screenshot when instrument goes missing.
    
    Args:
        frame: Current video frame
        missing_instrument: Name of missing instrument
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"alert_{missing_instrument}_{timestamp}.jpg"
    filepath = os.path.join('alerts', filename)
    
    # Add alert text to screenshot
    alert_frame = frame.copy()
    alert_text = f"ALERT: {missing_instrument} MISSING"
    cv2.putText(alert_frame, alert_text, (50, 50),
               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)
    cv2.putText(alert_frame, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), 
               (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    cv2.imwrite(filepath, alert_frame)
    print(f"[SurgEye] Alert screenshot saved: {filepath}")
    return filepath


def get_alert_screenshots() -> List[str]:
    """Get list of all alert screenshot files."""
    if not os.path.exists('alerts'):
        return []
    return sorted([f for f in os.listdir('alerts') if f.endswith('.jpg')], reverse=True)


def count_by_class(detections: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Count instruments by class with confidence info.
    
    Returns:
        Dictionary with count and average confidence per class
    """
    counts = {}
    for d in detections:
        cls = d['class']
        if cls not in counts:
            counts[cls] = {'count': 0, 'confidences': []}
        counts[cls]['count'] += 1
        counts[cls]['confidences'].append(d['confidence'])
    
    # Calculate average confidence
    for cls in counts:
        confs = counts[cls]['confidences']
        counts[cls]['avg_confidence'] = round(sum(confs) / len(confs), 2) if confs else 0
        del counts[cls]['confidences']  # Remove raw list
    
    return counts


def count_by_class(detections: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Count instruments by class.
    
    Args:
        detections: List of detection dictionaries
        
    Returns:
        Dictionary mapping class names to counts
    """
    counts = {}
    for d in detections:
        cls = d['class']
        counts[cls] = counts.get(cls, 0) + 1
    return counts


def export_to_onnx():
    """
    Export YOLO model to ONNX format for faster CPU inference.
    Run this once to generate yolov8s.onnx
    """
    model.export(format='onnx')
    print("Model exported to ONNX format: yolov8s.onnx")


if __name__ == "__main__":
    # Test with webcam
    cap = cv2.VideoCapture(0)
    
    print("SurgEye Detection Test - Press 'q' to quit")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        annotated, detections = detect_frame(frame)
        counts = count_by_class(detections)
        
        # Display counts on frame
        y_offset = 30
        for cls, count in counts.items():
            text = f"{cls}: {count}"
            cv2.putText(annotated, text, (10, y_offset), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            y_offset += 30
        
        cv2.imshow('SurgEye - Instrument Detection', annotated)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
