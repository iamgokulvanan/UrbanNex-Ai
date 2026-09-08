import { DetectionType, SeverityLevel, BoundingBox } from '../types';

export interface FrameInput {
  timestamp: string;
  busId: string;
  latitude: number;
  longitude: number;
  speed: number;
  routeId: string;
}

export interface TrackedObject {
  trackId: number;
  label: DetectionType;
  box: BoundingBox;
  dwellFrames: number;
  confidence: number;
}

export interface InferenceResult {
  hasDetection: boolean;
  type?: DetectionType;
  confidence?: number;
  severity?: SeverityLevel;
  boundingBoxes?: BoundingBox[];
  roadSurfaceMetric?: string;
  evidenceKey?: string;
  notes?: string;
  latencyMs: number;
}

/**
 * AIInferenceService Interface
 * Defines the contract for Edge AI models mounted on buses.
 * Both DemoInferenceService and future YOLOInferenceService implement this.
 */
export interface AIInferenceService {
  detect(frame: FrameInput): Promise<InferenceResult>;
  track(objects: TrackedObject[]): TrackedObject[];
  calculate_confidence(features: { signalToNoise: number; clarity: number; sizeRatio: number }): number;
  calculate_severity(type: DetectionType, confidence: number, roadMetric?: string): SeverityLevel;
  getModelInfo(): {
    name: string;
    version: string;
    architecture: string;
    hardwareTarget: string;
    fpsTarget: number;
    isEdgeHosted: boolean;
    isSimulated: boolean;
  };
}

/**
 * DemoInferenceService
 * High-fidelity deterministic edge inference simulator designed for SIH 2026 demonstrations.
 */
export class DemoInferenceService implements AIInferenceService {
  private trackerIdCounter = 100;
  private currentTrackedObjects: TrackedObject[] = [];

  public getModelInfo() {
    return {
      name: 'DemoInferenceService (UrbanNex-Edge-v2)',
      version: '2.4.0-sih2026',
      architecture: 'Lightweight MobileNet-SSD / YOLO-Nano Edge Prototype',
      hardwareTarget: 'NVIDIA Jetson Orin Nano / RPi5 Onboard Unit',
      fpsTarget: 28.6,
      isEdgeHosted: true,
      isSimulated: true,
    };
  }

  public calculate_confidence(features: { signalToNoise: number; clarity: number; sizeRatio: number }): number {
    const base = 0.85;
    const boost = (features.signalToNoise * 0.05) + (features.clarity * 0.05) + (features.sizeRatio * 0.04);
    const score = Math.min(0.985, Math.max(0.72, base + boost));
    return parseFloat(score.toFixed(3));
  }

  public calculate_severity(type: DetectionType, confidence: number, roadMetric?: string): SeverityLevel {
    if (type === 'waterlogging') {
      return confidence > 0.9 ? 'critical' : 'high';
    }
    if (type === 'pothole') {
      if (roadMetric && roadMetric.includes('depth > 8cm')) return 'critical';
      return confidence > 0.92 ? 'high' : 'medium';
    }
    if (type === 'congestion') {
      return confidence > 0.9 ? 'high' : 'medium';
    }
    if (type === 'pedestrian_risk') {
      return confidence > 0.94 ? 'critical' : 'medium';
    }
    return 'medium';
  }

  public track(objects: TrackedObject[]): TrackedObject[] {
    this.currentTrackedObjects = objects.map(obj => ({
      ...obj,
      dwellFrames: obj.dwellFrames + 1,
    }));
    return this.currentTrackedObjects;
  }

  public async detect(frame: FrameInput): Promise<InferenceResult> {
    const startTime = performance.now();

    // Select detection type based on context/random seed
    const types: DetectionType[] = ['pothole', 'road_damage', 'waterlogging', 'congestion', 'pedestrian_risk'];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    const clarity = 0.75 + Math.random() * 0.24;
    const signalToNoise = 0.8 + Math.random() * 0.18;
    const sizeRatio = 0.6 + Math.random() * 0.35;
    const confidence = this.calculate_confidence({ signalToNoise, clarity, sizeRatio });

    let metric = 'Standard asphalt pavement inspection';
    let boxes: BoundingBox[] = [];
    let evidenceKey = 'simulated_pothole_01';
    let notes = '';

    if (chosenType === 'pothole') {
      const depth = (5 + Math.random() * 7).toFixed(1);
      metric = `Asphalt cavity (depth approx. ${depth}cm, width 42cm)`;
      evidenceKey = 'simulated_pothole_01';
      notes = `Localized pavement breach with exposed aggregate base. Depth: ${depth}cm.`;
      boxes = [
        {
          x: 35 + Math.floor(Math.random() * 15),
          y: 52 + Math.floor(Math.random() * 10),
          width: 26,
          height: 18,
          label: `Pothole (${(confidence * 100).toFixed(1)}%)`,
          confidence,
        }
      ];
    } else if (chosenType === 'waterlogging') {
      const depthEst = (8 + Math.random() * 10).toFixed(1);
      metric = `Standing water pool covering vehicle lane (est. ${depthEst}cm)`;
      evidenceKey = 'simulated_waterlogging_01';
      notes = `High specular water reflectance detected. Depth: ${depthEst}cm, potential hydroplaning risk.`;
      boxes = [
        {
          x: 20 + Math.floor(Math.random() * 10),
          y: 45 + Math.floor(Math.random() * 10),
          width: 55,
          height: 32,
          label: `Waterlogging (${(confidence * 100).toFixed(1)}%)`,
          confidence,
        }
      ];
    } else if (chosenType === 'road_damage') {
      metric = 'Longitudinal and alligator surface cracking across 4.2m';
      evidenceKey = 'simulated_damage_01';
      notes = 'Surface fatigue failure with potential for rapid hole development under monsoonal rain.';
      boxes = [
        {
          x: 30 + Math.floor(Math.random() * 15),
          y: 55 + Math.floor(Math.random() * 8),
          width: 38,
          height: 20,
          label: `Surface Damage (${(confidence * 100).toFixed(1)}%)`,
          confidence,
        }
      ];
    } else if (chosenType === 'congestion') {
      metric = `Traffic bottleneck speed < ${frame.speed} km/h`;
      evidenceKey = 'simulated_congestion_01';
      notes = 'Dense cluster of stationary vehicles causing transit slowdown.';
      boxes = [
        {
          x: 18,
          y: 38,
          width: 65,
          height: 38,
          label: `Gridlock (${(confidence * 100).toFixed(1)}%)`,
          confidence,
        }
      ];
    } else {
      metric = 'Pedestrian crossing zone safety alert';
      evidenceKey = 'simulated_pedestrian_01';
      notes = 'Pedestrians navigating obstructed sidewalk edge in live bus lane.';
      boxes = [
        {
          x: 40,
          y: 48,
          width: 24,
          height: 32,
          label: `Pedestrian Risk (${(confidence * 100).toFixed(1)}%)`,
          confidence,
        }
      ];
    }

    const severity = this.calculate_severity(chosenType, confidence, metric);

    // Track simulated object
    this.track([
      {
        trackId: ++this.trackerIdCounter,
        label: chosenType,
        box: boxes[0],
        dwellFrames: 1,
        confidence,
      }
    ]);

    const latencyMs = parseFloat((performance.now() - startTime + (15 + Math.random() * 12)).toFixed(1));

    return {
      hasDetection: true,
      type: chosenType,
      confidence,
      severity,
      boundingBoxes: boxes,
      roadSurfaceMetric: metric,
      evidenceKey,
      notes,
      latencyMs,
    };
  }
}

/**
 * YOLOInferenceService Stub
 * Demonstrates plug-and-play drop-in replacement for production deployment with PyTorch/ONNX/TensorRT.
 */
export class YOLOInferenceService implements AIInferenceService {
  public getModelInfo() {
    return {
      name: 'YOLOv11-UrbanSurface-TRT (Target Architecture)',
      version: '1.0.0-onnx-fp16',
      architecture: 'YOLOv11s with Custom Head for Pavement Surface Anomaly Detection',
      hardwareTarget: 'NVIDIA Jetson Orin Nano 8GB (TensorRT accelerated)',
      fpsTarget: 34.0,
      isEdgeHosted: true,
      isSimulated: false,
    };
  }

  public calculate_confidence(features: { signalToNoise: number; clarity: number; sizeRatio: number }): number {
    return 0.95;
  }

  public calculate_severity(type: DetectionType, confidence: number, roadMetric?: string): SeverityLevel {
    return 'high';
  }

  public track(objects: TrackedObject[]): TrackedObject[] {
    return objects;
  }

  public async detect(frame: FrameInput): Promise<InferenceResult> {
    throw new Error('YOLOInferenceService requires hardware edge camera and ONNX/TensorRT runtime. Use DemoInferenceService for current prototype demonstration.');
  }
}
