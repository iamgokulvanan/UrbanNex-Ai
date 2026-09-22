import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from pothole_detector import PotholeDetector


class TestPotholeDetector(unittest.TestCase):
    def test_process_video_without_model_uses_fallback(self):
        detector = PotholeDetector()
        detector.model_path = Path('missing-model.pt')

        temp_video = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
        temp_video.close()

        frame_size = (160, 120)
        writer = cv2.VideoWriter(temp_video.name, cv2.VideoWriter_fourcc(*'mp4v'), 10.0, frame_size)
        for _ in range(6):
            frame = np.zeros((frame_size[1], frame_size[0], 3), dtype=np.uint8)
            cv2.rectangle(frame, (20, 15), (80, 60), (80, 80, 80), -1)
            writer.write(frame)
        writer.release()

        try:
            detections = detector.process_video(temp_video.name)
            self.assertIsInstance(detections, list)
            self.assertGreaterEqual(len(detections), 1)
            self.assertIn('class', detections[0])
            self.assertEqual(detections[0]['class'], 'pothole')
        finally:
            Path(temp_video.name).unlink(missing_ok=True)


if __name__ == '__main__':
    unittest.main()
