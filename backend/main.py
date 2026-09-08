import asyncio
import json
import random
from typing import List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .ai_inference import DemoInferenceService

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
