"""
SurgEye: FastAPI WebSocket Server
Real-time instrument detection streaming with WebSocket support.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import cv2
import base64
import json
import asyncio
from typing import Optional

from detect import detect_frame, count_by_class, get_instrument_log, get_alert_screenshots
from tracker import tracker
from rostering_agent import trigger_rostering_alert

app = FastAPI(title="SurgEye API", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:5177", "http://localhost:5178"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
active_connections: list[WebSocket] = []
video_source: Optional[cv2.VideoCapture] = None


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "SurgEye API Running",
        "version": "1.0.0",
        "endpoints": [
            "/ws - WebSocket stream",
            "/baseline - Set pre-op baseline",
            "/check - Post-op check",
            "/status - Current status"
        ]
    }


@app.post("/baseline")
async def set_baseline():
    """
    Set the baseline instrument count at the start of procedure.
    Uses current detection counts as baseline.
    """
    # Get current counts from tracker
    current = tracker.current
    if not current:
        return {"status": "error", "message": "No instruments detected - cannot set baseline"}
    
    tracker.set_baseline(current)
    return {
        "status": "baseline set",
        "counts": current,
        "timestamp": tracker.alert_history[-1]['timestamp'] if tracker.alert_history else None
    }


@app.post("/check")
async def postop_check():
    """
    Perform post-operative instrument count check.
    Returns PASS or FAIL based on baseline comparison.
    """
    result = tracker.check_postop()
    return result


@app.get("/status")
async def get_status():
    """Get current tracking status."""
    return tracker.get_status()


@app.get("/timeline")
async def get_timeline():
    """Get instrument timeline log."""
    return {
        "timeline": get_instrument_log(),
        "event_count": len(get_instrument_log())
    }


@app.get("/alerts/screenshots")
async def get_screenshots():
    """Get list of alert screenshots."""
    return {
        "screenshots": get_alert_screenshots(),
        "count": len(get_alert_screenshots())
    }


@app.post("/scan-baseline")
async def scan_baseline():
    """
    Phase 1: Pre-op scan - nurse points camera at instrument tray.
    Captures 30 frames and takes most common detection as baseline.
    """
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return {"error": "Cannot open camera"}
    
    try:
        # Warm up camera
        for _ in range(5):
            cap.read()
        
        # Capture 30 frames
        all_detections = []
        for i in range(30):
            ret, frame = cap.read()
            if not ret:
                continue
            
            # Resize for speed
            frame = cv2.resize(frame, (640, 480))
            
            # Run detection
            _, detections = detect_frame(frame, conf_threshold=0.5)
            all_detections.extend(detections)
            
            await asyncio.sleep(0.033)  # ~30 FPS
        
        # Count occurrences per class
        class_counts = {}
        for d in all_detections:
            cls = d['class']
            class_counts[cls] = class_counts.get(cls, 0) + 1
        
        # Normalize: divide by 10 to get actual count (30 frames / 3 = ~10 samples)
        baseline = {cls: max(1, count // 10) for cls, count in class_counts.items()}
        
        # Set baseline in tracker
        tracker.set_baseline(baseline)
        
        # Save baseline image
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(f"baseline_{datetime.now().strftime('%H%M%S')}.jpg", frame)
        
        return {
            "status": "baseline_locked",
            "baseline": baseline,
            "frames_captured": 30,
            "total_detections": len(all_detections)
        }
        
    finally:
        cap.release()


@app.post("/scan-postop")
async def scan_postop():
    """
    Phase 2: Post-op scan - verify all instruments present.
    Returns PASS/FAIL and triggers rostering agent if needed.
    """
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return {"error": "Cannot open camera"}
    
    try:
        # Warm up camera
        for _ in range(5):
            cap.read()
        
        # Capture 30 frames
        all_detections = []
        for i in range(30):
            ret, frame = cap.read()
            if not ret:
                continue
            
            frame = cv2.resize(frame, (640, 480))
            _, detections = detect_frame(frame, conf_threshold=0.5)
            all_detections.extend(detections)
            
            await asyncio.sleep(0.033)
        
        # Count final instruments
        final_counts = {}
        for d in all_detections:
            cls = d['class']
            final_counts[cls] = final_counts.get(cls, 0) + 1
        
        # Normalize
        final_counts = {cls: max(1, count // 10) for cls, count in final_counts.items()}
        
        # Compare to baseline
        baseline_simple = {cls: info['count'] for cls, info in tracker.baseline.items()} if tracker.baseline else {}
        
        passed = final_counts == baseline_simple
        
        # Find missing items
        missing = {}
        for cls, expected in baseline_simple.items():
            actual = final_counts.get(cls, 0)
            if actual < expected:
                missing[cls] = expected - actual
        
        # Save post-op image
        ret, frame = cap.read()
        if ret:
            cv2.imwrite(f"postop_{datetime.now().strftime('%H%M%S')}.jpg", frame)
        
        result = {
            "passed": passed,
            "baseline": baseline_simple,
            "final": final_counts,
            "missing": missing,
            "timestamp": datetime.now().isoformat()
        }
        
        # If failed, trigger rostering agent
        if not passed:
            result["alert"] = "INSTRUMENTS MISSING - ROSTERING AGENT TRIGGERED"
            
            # Trigger AI Agent: Perceive → Reason → Act
            rostering_result = await trigger_rostering_alert(
                missing_items=missing,
                nurse_id="NURSE_001",  # TODO: Get from session
                nurse_name="Unknown"   # TODO: Get from session
            )
            result["rostering_action"] = rostering_result
        
        return result
        
    finally:
        cap.release()


@app.post("/reset")
async def reset_tracker():
    """Reset tracker for new procedure."""
    tracker.reset()
    return {"status": "reset complete"}


cap = None  # Global camera instance

def get_camera():
    """Get or initialize camera with optimized settings."""
    global cap
    if cap is None or not cap.isOpened():
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        print("[Camera] Initialized")
    return cap

@app.websocket("/ws")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket endpoint with proper error handling and auto-reconnect support.
    """
    await websocket.accept()
    active_connections.append(websocket)
    print("[WS] Client connected")
    
    frame_count = 0
    last_detections = []
    last_counts = {}
    
    try:
        while True:
            # Get camera with auto-reinit if needed
            camera = get_camera()
            ret, frame = camera.read()
            
            if not ret:
                print("[WS] Camera read failed, retrying...")
                await asyncio.sleep(0.1)
                continue
            
            frame_count += 1
            
            # Only run detection every 5th frame — BIG speed improvement
            if frame_count % 5 == 0:
                try:
                    annotated, last_detections = detect_frame(frame, conf_threshold=0.5)
                    last_counts = count_by_class(last_detections)
                except Exception as e:
                    print(f"[WS] Detection error: {e}")
                    annotated = frame  # use raw frame if detection fails
            else:
                annotated = frame  # send raw frame for smooth video
            
            # Update tracker if baseline is set
            alerts = []
            if tracker.procedure_started:
                try:
                    alerts = tracker.update(last_counts, current_frame=frame)
                except Exception as e:
                    print(f"[WS] Tracker error: {e}")
            else:
                tracker.current = last_counts
            
            # Resize + compress aggressively
            annotated = cv2.resize(annotated, (640, 480))
            _, buf = cv2.imencode('.jpg', annotated, 
                                  [cv2.IMWRITE_JPEG_QUALITY, 50])
            img_b64 = base64.b64encode(buf).decode()
            
            payload = json.dumps({
                'frame': img_b64,
                'counts': last_counts,
                'detections': last_detections,
                'alerts': alerts,
                'procedure_started': tracker.procedure_started,
                'procedure_ended': tracker.procedure_ended,
                'baseline': tracker.baseline if tracker.procedure_started else None
            })
            
            await websocket.send_text(payload)
            await asyncio.sleep(0.033)  # cap at ~30fps
            
    except WebSocketDisconnect:
        print("[WS] Client disconnected — waiting for reconnect")
    except Exception as e:
        print(f"[WS] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("[WS] Connection closed cleanly")
        if websocket in active_connections:
            active_connections.remove(websocket)


@app.websocket("/ws/video/{video_path:path}")
async def websocket_video_stream(websocket: WebSocket, video_path: str):
    """
    WebSocket endpoint for streaming from video file.
    Usage: ws://localhost:8000/ws/video/path/to/video.mp4
    """
    await websocket.accept()
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        await websocket.send_text(json.dumps({
            "error": f"Cannot open video: {video_path}"
        }))
        await websocket.close()
        return
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                # Loop video
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            
            annotated, detections = detect_frame(frame)
            counts = count_by_class(detections)
            
            if tracker.procedure_started:
                alerts = tracker.update(counts)
            else:
                alerts = []
                tracker.current = counts
            
            _, buffer = cv2.imencode('.jpg', annotated)
            img_b64 = base64.b64encode(buffer).decode('utf-8')
            
            await websocket.send_text(json.dumps({
                "frame": img_b64,
                "counts": counts,
                "detections": detections,
                "alerts": alerts
            }))
            
            await asyncio.sleep(0.05)
            
    except WebSocketDisconnect:
        print("[SurgEye] Video client disconnected")
    finally:
        cap.release()


if __name__ == "__main__":
    import uvicorn
    PORT = 8003  # Use different port to avoid conflict
    print("=" * 60)
    print("SURGEYE SURGICAL INSTRUMENT VISION SYSTEM")
    print("=" * 60)
    print(f"Starting server on http://localhost:{PORT}")
    print(f"WebSocket: ws://localhost:{PORT}/ws")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=PORT)
