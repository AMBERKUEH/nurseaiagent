"""
SurgEye: Surgical Instrument Detection Module
Core inference loop using Roboflow Inference API with Abhinav's pretrained model.
"""

from inference import get_model
import cv2
import numpy as np
from typing import List, Dict, Tuple, Any

# Roboflow API Configuration
ROBOFLOW_API_KEY = "bX5IkiMxH6IOh59gH6Ku"
MODEL_ID = "abhinav-ytcui/surgical-instruments-zmagm/1"

# Surgical instrument classes from Abhinav's model
CLASSES = [
    'Army_navy', 'Bulldog', 'Castroviejo', 'Forceps',
    'Frazier', 'Hemostat', 'IrisNeedle', 'Mayo_metz', 'Potts'
]

# Load Roboflow pretrained model
print("[SurgEye] Loading Roboflow surgical instruments model...")
model = get_model(
    model_id=MODEL_ID,
    api_key=ROBOFLOW_API_KEY
)
print("[SurgEye] Model loaded successfully!")


def detect_frame(frame: np.ndarray, conf_threshold: float = 0.4) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Detect surgical instruments in a single frame using Roboflow Inference API.
    
    Args:
        frame: Input image/frame (numpy array)
        conf_threshold: Confidence threshold for detections
        
    Returns:
        Tuple of (annotated_frame, detections_list)
    """
    # Run inference with Roboflow
    results = model.infer(frame)[0]
    
    detections = []
    annotated = frame.copy()
    
    for pred in results.predictions:
        # Filter by confidence threshold
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
        
        # Draw bounding box
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 200), 2)
        
        # Draw label
        label = f"{pred.class_name} {pred.confidence:.0%}"
        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
        label_y = y1 - 10 if y1 - 10 > 10 else y1 + 20
        
        # Label background
        cv2.rectangle(annotated, 
                     (x1, label_y - label_size[1] - 4),
                     (x1 + label_size[0], label_y + 4),
                     (0, 255, 200), -1)
        
        # Label text
        cv2.putText(annotated, label,
                   (x1, label_y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
    
    return annotated, detections


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
