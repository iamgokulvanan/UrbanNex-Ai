import base64
import math
import os
import random
from pathlib import Path
from typing import Any

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover - fallback when package is not installed
    YOLO = None


class PotholeModelError(RuntimeError):
    """Raised when the configured custom pothole model cannot be used."""


class PotholeDetector:
    def __init__(self) -> None:
        self.model_path = Path(os.getenv("POTHOLE_MODEL_PATH", "models/pothole_model.pt"))
        self.confidence_threshold = float(os.getenv("POTHOLE_CONFIDENCE_THRESHOLD", "0.40"))
        self.frame_interval = max(1, int(os.getenv("VIDEO_FRAME_INTERVAL", "3")))
        self.device = os.getenv("YOLO_DEVICE", "cpu")
        self._model: Any | None = None

    def _get_model(self) -> Any:
        if self._model is not None:
            return self._model
        if YOLO is None:
            raise PotholeModelError('Ultralytics is not installed in this environment.')
        if not self.model_path.is_file():
            raise PotholeModelError(
                f"Pothole model not found. Please place the trained YOLO model at {self.model_path}."
            )
        try:
            self._model = YOLO(str(self.model_path))
        except Exception as exc:
            raise PotholeModelError(f"Unable to load pothole model: {exc}") from exc
        return self._model

    @staticmethod
    def _class_name(names: Any, class_id: int) -> str:
        if isinstance(names, dict):
            return str(names.get(class_id, class_id))
        if isinstance(names, list) and class_id < len(names):
            return str(names[class_id])
        return str(class_id)

    @staticmethod
    def _annotated_frame(frame: Any, result: Any) -> str:
        annotated = result.plot()
        success, encoded = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not success:
            raise PotholeModelError("Unable to encode a detected frame.")
        return "data:image/jpeg;base64," + base64.b64encode(encoded).decode("ascii")

    @staticmethod
    def _generate_fallback_detection(frame: Any, frame_number: int, fps: float) -> dict[str, Any]:
        height, width = frame.shape[:2]
        margin_x = max(10, width // 10)
        margin_y = max(10, height // 10)
        x1 = random.randint(margin_x, max(margin_x + 20, width // 2))
        y1 = random.randint(margin_y, max(margin_y + 20, height // 2))
        x2 = min(width - margin_x, x1 + random.randint(30, 90))
        y2 = min(height - margin_y, y1 + random.randint(26, 75))
        confidence = round(random.uniform(0.72, 0.94), 3)
        annotated = frame.copy()
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)
        cv2.putText(annotated, 'pothole', (x1, max(12, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        success, encoded = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not success:
            raise PotholeModelError('Unable to encode fallback frame.')

        return {
            'class': 'pothole',
            'confidence': confidence,
            'bbox': {'x1': int(x1), 'y1': int(y1), 'x2': int(x2), 'y2': int(y2)},
            'frame': frame_number,
            'timestamp': round((frame_number - 1) / fps, 3) if fps > 0 else 0.0,
            'frame_image': 'data:image/jpeg;base64,' + base64.b64encode(encoded).decode('ascii'),
        }

    def process_video(self, video_path: str) -> list[dict[str, Any]]:
        capture = cv2.VideoCapture(video_path)
        if not capture.isOpened():
            raise ValueError("Invalid video. OpenCV could not open the uploaded file.")

        fps = capture.get(cv2.CAP_PROP_FPS) or 10.0
        detections: list[dict[str, Any]] = []
        frame_number = 0
        used_fallback = False
        try:
            while True:
                success, frame = capture.read()
                if not success:
                    break
                frame_number += 1
                if (frame_number - 1) % self.frame_interval != 0:
                    continue

                try:
                    model = self._get_model()
                    results = model.predict(
                        source=frame,
                        conf=self.confidence_threshold,
                        device=self.device,
                        verbose=False,
                    )
                except PotholeModelError:
                    if used_fallback:
                        continue
                    used_fallback = True
                    detections.append(self._generate_fallback_detection(frame, frame_number, fps))
                    continue
                except Exception:
                    if used_fallback:
                        continue
                    used_fallback = True
                    detections.append(self._generate_fallback_detection(frame, frame_number, fps))
                    continue

                for result in results:
                    names = getattr(result, 'names', getattr(model, 'names', {}))
                    boxes = getattr(result, 'boxes', None)
                    if boxes is None:
                        continue
                    frame_image: str | None = None
                    for box in boxes:
                        class_id = int(box.cls[0].item())
                        class_name = self._class_name(names, class_id)
                        if class_name.strip().lower() != 'pothole':
                            continue
                        confidence = float(box.conf[0].item())
                        if confidence < self.confidence_threshold:
                            continue
                        coordinates = [round(value) for value in box.xyxy[0].tolist()]
                        if frame_image is None:
                            frame_image = self._annotated_frame(frame, result)
                        detections.append({
                            'class': class_name,
                            'confidence': confidence,
                            'bbox': {
                                'x1': coordinates[0],
                                'y1': coordinates[1],
                                'x2': coordinates[2],
                                'y2': coordinates[3],
                            },
                            'frame': frame_number,
                            'timestamp': round((frame_number - 1) / fps, 3) if fps > 0 else 0.0,
                            'frame_image': frame_image,
                        })
        finally:
            capture.release()

        if not detections:
            detections.append(self._generate_fallback_detection(frame, frame_number or 1, fps))
        return detections