import asyncio
import json
import random
import os
import tempfile
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .ai_inference import DemoInferenceService
from .pothole_detector import PotholeDetector, PotholeModelError

app = FastAPI(
    title="UrbanNex AI Command Center Backend",
    description="Turning Every Bus into a Mobile Urban Sensor - SIH 2026",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

inference_service = DemoInferenceService()
pothole_detector = PotholeDetector()

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}
MAX_VIDEO_BYTES = int(os.getenv("MAX_VIDEO_SIZE_BYTES", str(200 * 1024 * 1024)))

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.get("/api/health")
def get_health():
    return {"status": "healthy", "service": "UrbanNex AI FastAPI Engine"}


@app.post("/api/detections/video")
async def detect_potholes_in_video(video: UploadFile = File(...)):
    extension = Path(video.filename or "").suffix.lower()
    if extension not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type. Upload an MP4, MOV, AVI, or MKV video.")

    temporary_path: str | None = None
    total_bytes = 0
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension, prefix="urbannex-video-") as temporary_file:
            temporary_path = temporary_file.name
            while chunk := await video.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > MAX_VIDEO_BYTES:
                    raise HTTPException(status_code=413, detail="Video file is too large for processing.")
                temporary_file.write(chunk)

        try:
            detections = pothole_detector.process_video(temporary_path)
        except PotholeModelError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Video processing failed: {exc}") from exc

        return {
            "success": True,
            "video_name": video.filename,
            "detections": detections,
            "total_detections": len(detections),
            "confidence_threshold": pothole_detector.confidence_threshold,
            "frame_interval": pothole_detector.frame_interval,
        }
    finally:
        await video.close()
        if temporary_path:
            Path(temporary_path).unlink(missing_ok=True)

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client commands
            cmd = json.loads(data)
            action = cmd.get("action")
            if action == "trigger_detection":
                event = inference_service.detect({})
                await manager.broadcast({"type": "detection:new", "data": event})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
