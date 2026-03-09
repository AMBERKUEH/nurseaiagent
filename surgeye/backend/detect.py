"""
SurgEye: Surgical Instrument Detection Module
Core inference loop using YOLOv8 for real-time instrument detection.
"""

from ultralytics import YOLO
import cv2
import numpy as np
from typing import List, Dict, Tuple, Any

# Surgical instrument classes (expand based on your dataset)
CLASSES = [
    'forceps', 'scissors', 'retractor', 'clamp', 'needle_holder',
    'scalpel', 'surgical_sponge', 'gauze', 'towel_clip', 'hemostat'
]

# Load YOLOv8 model (auto-downloads if not present)
# For CPU-only: model = YOLO('yolov8s.onnx') after exporting
model = YOLO('yolov8s.pt')


def detect_frame(frame: np.ndarray, conf_threshold: float = 0.4) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    Detect surgical instruments in a single frame.
    
    Args:
        frame: Input image/frame (numpy array)
        conf_threshold: Confidence threshold for detections
        
    Returns:
        Tuple of (annotated_frame, detections_list)
    """
    # Run inference
    results = model(frame, conf=conf_threshold)[0]
    
    detections = []
    for box in results.boxes:
        class_id = int(box.cls)
        class_name = CLASSES[class_id] if class_id < len(CLASSES) else f'class_{class_id}'
        
        detection = {
            'class': class_name,
            'confidence': round(float(box.conf), 2),
            'bbox': box.xyxy[0].tolist(),  # [x1, y1, x2, y2]
            'center': box.xywh[0][:2].tolist()  # [cx, cy]
        }
        detections.append(detection)
    
    # Get annotated frame with bounding boxes
    annotated = results.plot()
    
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
