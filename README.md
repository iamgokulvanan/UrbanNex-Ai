# UrbanNex AI — Smart India Hackathon 2026

> **Turning Every Bus into a Mobile Urban Sensor**  
> Problem ID: **26124** | Theme: **Smart Automation** | Category: **Software**

UrbanNex AI transforms municipal public transit fleets into real-time mobile urban sensing platforms. Cameras and lightweight Edge AI units mounted on city buses detect potholes, road fatigue, waterlogging, congestion, and pedestrian safety hazards on the move, transmitting only compact, structured metadata and single evidence frames rather than raw continuous video.

---

## Architecture Highlights

1. **Edge-to-Command Real-Time Pipeline**:
   `Bus Forward Camera` → `Edge AI (DemoInferenceService / YOLOv11)` → `Event Metadata + 1 Frame` → `WebSocket (/ws/live)` → `GIS Command Center` → `Authority Workflow (Kanban)` → `Department Dispatch` → `Resolution` → `Civic Analytics`.
2. **Privacy-First By Design**:
   - Continuous raw video streaming is disabled (`Raw Video Upload: OFF`).
   - High-throughput processing stays on the onboard unit (`Edge Processing: ON`).
   - Only actionable civil event metadata with GPS & single cropped evidence frame are relayed (`Evidence Frame: EVENT ONLY`).
3. **Smart India Hackathon Ready**:
   - Interactive live simulation of 12 pilot buses traversing urban transit routes in Coimbatore / Gandhipuram corridor.
   - Live AI detections with confidence scoring, severity levels, and bounding box visualizations.
   - Interactive Kanban authority triage (`Pending Verification` → `Verified` → `Assigned` → `In Progress` → `Resolved`).
   - Real-time Recharts data visualization and hardware health monitoring.

---

## Running the Application

### Full-Stack Integrated (Vite + Express + WebSocket Engine)
The container environment runs the unified full-stack server on Port 3000:
```bash
npm install
npm run dev
```

### Standalone Python FastAPI Backend (Alternative Mode)
For testing the Python SQLAlchemy backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
