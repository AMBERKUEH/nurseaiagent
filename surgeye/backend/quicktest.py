"""
Quick test for Roboflow surgical instruments model
"""
from roboflow import Roboflow
import cv2

print("[QuickTest] Loading Roboflow model...")
rf = Roboflow(api_key="bX5IkiMxH6IOh59gH6Ku")
project = rf.workspace("abhinav-ytcui").project("surgical-instruments-zmagm")
model = project.version(1).model
print("[QuickTest] Model loaded!")

# Test on webcam frame
print("[QuickTest] Capturing webcam frame...")
cap = cv2.VideoCapture(0)
ret, frame = cap.read()
cap.release()

if ret:
    # Save frame
    cv2.imwrite("test.jpg", frame)
    print("[QuickTest] Saved test.jpg")
    
    # Run prediction
    print("[QuickTest] Running prediction...")
    results = model.predict("test.jpg", confidence=30)
    
    # Print results
    data = results.json()
    print(f"\n[QuickTest] Predictions found: {len(data['predictions'])}")
    
    for pred in data['predictions']:
        print(f"  - {pred['class']}: {pred['confidence']:.1f}%")
    
    # Save output with boxes
    results.save("output.jpg")
    print("\n[QuickTest] Saved output.jpg with bounding boxes")
    print("[QuickTest] Done! Check output.jpg")
else:
    print("[QuickTest] Error: Could not capture webcam frame")
