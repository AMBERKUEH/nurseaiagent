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

app = FastAPI(title="SurgEye API", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
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


@app.post("/reset")
async def reset_tracker():
    """Reset tracker for new procedure."""
    tracker.reset()
    return {"status": "reset complete"}


@app.websocket("/ws")
async def websocket_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time video streaming.
    Sends annotated frames + instrument counts + alerts.
    """
    await websocket.accept()
    active_connections.append(websocket)
    
    # Use webcam by default (0) or video file path
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        await websocket.send_text(json.dumps({
            "error": "Cannot open video source"
        }))
        await websocket.close()
        return
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Run detection with 50% confidence threshold
            annotated, detections = detect_frame(frame, conf_threshold=0.5)
            counts = count_by_class(detections)
            
            # Update tracker if baseline is set
            alerts = []
            if tracker.procedure_started:
                alerts = tracker.update(counts, current_frame=frame)
            else:
                # Just update current counts without alerts
                tracker.current = counts
            
            # Encode frame as base64 JPEG
            _, buffer = cv2.imencode('.jpg', annotated)
            img_b64 = base64.b64encode(buffer).decode('utf-8')
            
            # Prepare payload
            payload = {
                "frame": img_b64,
                "counts": counts,
                "detections": detections,
                "alerts": alerts,
                "procedure_started": tracker.procedure_started,
                "procedure_ended": tracker.procedure_ended,
                "baseline": tracker.baseline if tracker.procedure_started else None
            }
            
            # Send to client
            await websocket.send_text(json.dumps(payload))
            
            # Cap at ~20 FPS
            await asyncio.sleep(0.05)
            
    except WebSocketDisconnect:
        print("[SurgEye] Client disconnected")
    except Exception as e:
        print(f"[SurgEye] Error: {e}")
    finally:
        active_connections.remove(websocket)
        cap.release()


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
    print("=" * 60)
    print("SURGEYE SURGICAL INSTRUMENT VISION SYSTEM")
    print("=" * 60)
    print("Starting server on http://localhost:8000")
    print("WebSocket: ws://localhost:8000/ws")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
