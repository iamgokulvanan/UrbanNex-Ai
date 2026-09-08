import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Activity, 
  Layers, 
  Sliders, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Eye, 
  Zap, 
  Radio, 
  Camera,
  Code
} from 'lucide-react';
import { Bus, Detection } from '../../types';

interface AIMonitorProps {
  buses: Bus[];
  detections: Detection[];
  onTriggerDetection: () => void;
}

export const AIMonitor: React.FC<AIMonitorProps> = ({
  buses,
  detections,
  onTriggerDetection,
}) => {
  const [selectedBusId, setSelectedBusId] = useState<string>('BUS-004');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.70);
  const [simulatedTick, setSimulatedTick] = useState<number>(0);

  // Active bus telemetry
  const activeBus = buses.find(b => b.id === selectedBusId) || buses[0];

  useEffect(() => {
    const timer = setInterval(() => {
      setSimulatedTick(prev => prev + 1);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              Edge AI Telemetry & Vision Monitor
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-emerald-600">Active Inference Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Edge AI Inference & Pavement Computer Vision
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Real-time inspection of bus-mounted optical camera streams and localized hazard classification.
          </p>
        </div>

        {/* Bus Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Inspect Bus Camera:</span>
          <select
            value={selectedBusId}
            onChange={(e) => setSelectedBusId(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs focus:outline-none cursor-pointer"
          >
            {buses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} ({b.routeName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Inference Status</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-base font-bold text-slate-900">ONLINE</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Edge Device Ready</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Inference Throughput</span>
          <div className="text-base font-bold text-blue-600 mt-1">
            {activeBus ? activeBus.fps : 28.6} FPS
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block">Target: 30 FPS</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Active Model</span>
          <div className="text-xs font-bold text-slate-900 mt-1 truncate">
            DemoInferenceService
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">YOLOv11 Pluggable</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Conf. Threshold</span>
          <div className="text-base font-bold text-slate-900 mt-1">
            {(confidenceThreshold * 100).toFixed(0)}%
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Filter Low SNR</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Tracked Objects</span>
          <div className="text-base font-bold text-purple-600 mt-1">
            {3 + (simulatedTick % 4)} Active
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">ByteTrack Filter</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Processing Node</span>
          <div className="text-base font-bold text-slate-900 mt-1">
            EDGE ONLY
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block">Zero Video Upload</span>
        </div>
      </div>

      {/* Main Vision Simulation Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulated Bus Road Camera Monitor with HUD */}
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden flex flex-col">
          {/* Top HUD Bar */}
          <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-emerald-400 font-bold">REC • {selectedBusId} CAM-FORWARD</span>
              <span className="text-slate-500 hidden sm:inline">| 1080p@30fps H.265</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-yellow-400 font-bold">GPS LOCKED</span>
              <span className="text-slate-400">{activeBus?.speed || 32} KM/H</span>
              <span className="text-blue-400 font-bold bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                SIMULATED DEMO
              </span>
            </div>
          </div>

          {/* Optical Canvas Simulator */}
          <div className="relative aspect-16/9 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 overflow-hidden flex items-center justify-center select-none">
            {/* Perspective Road Canvas Graphics */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 640 360">
              {/* Sky / Horizon */}
              <rect x="0" y="0" width="640" height="150" fill="#334155" opacity="0.6" />
              {/* Buildings silhouette */}
              <polygon points="0,150 100,120 180,140 260,110 340,145 420,125 500,140 640,130 640,150 0,150" fill="#1e293b" opacity="0.8" />
              {/* Road surface */}
              <polygon points="0,360 250,150 390,150 640,360" fill="#0f172a" />
              {/* Shoulders */}
              <polygon points="0,360 0,150 250,150" fill="#1e293b" opacity="0.7" />
              <polygon points="640,360 640,150 390,150" fill="#1e293b" opacity="0.7" />

              {/* Lane dashes */}
              <line x1="320" y1="150" x2="320" y2="180" stroke="#f8fafc" stroke-width="2" stroke-dasharray="10,15" opacity="0.7" />
              <line x1="320" y1="190" x2="320" y2="240" stroke="#f8fafc" stroke-width="3" stroke-dasharray="15,20" opacity="0.8" />
              <line x1="320" y1="260" x2="320" y2="340" stroke="#f8fafc" stroke-width="5" stroke-dasharray="25,25" opacity="0.9" />

              {/* Optical center crosshair */}
              <circle cx="320" cy="180" r="12" fill="none" stroke="#38bdf8" stroke-width="1" opacity="0.3" />
              <line x1="305" y1="180" x2="335" y2="180" stroke="#38bdf8" stroke-width="1" opacity="0.3" />
              <line x1="320" y1="165" x2="320" y2="195" stroke="#38bdf8" stroke-width="1" opacity="0.3" />
            </svg>

            {/* Dynamic Bounding Box 1: Pothole or Surface Anomaly */}
            <div 
              className="absolute border-2 border-red-500 rounded-xs bg-red-500/10 pointer-events-none transition-all duration-700"
              style={{
                left: `${38 + (simulatedTick % 3) * 2}%`,
                top: `${55 + (simulatedTick % 2) * 2}%`,
                width: '18%',
                height: '14%',
              }}
            >
              <div className="absolute -top-5 left-0 bg-red-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs whitespace-nowrap shadow-xs">
                POTHOLE [0.942] • 7.5cm
              </div>
            </div>

            {/* Dynamic Bounding Box 2: Preceding vehicle or road feature */}
            <div 
              className="absolute border-2 border-amber-400 rounded-xs bg-amber-500/10 pointer-events-none transition-all duration-1000"
              style={{
                left: '22%',
                top: '46%',
                width: '14%',
                height: '16%',
              }}
            >
              <div className="absolute -top-5 left-0 bg-amber-500 text-slate-950 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs whitespace-nowrap shadow-xs">
                VEHICLE [0.978] • SPEED: 28 KM/H
              </div>
            </div>

            {/* Center HUD Overlay info */}
            <div className="absolute bottom-3 inset-x-4 flex items-center justify-between text-[11px] font-mono text-slate-400 pointer-events-none bg-slate-950/70 p-2 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">EDGE INFERENCE ACTIVE</span>
                <span>•</span>
                <span>LAT: {activeBus?.latitude.toFixed(4)}° N, LNG: {activeBus?.longitude.toFixed(4)}° E</span>
              </div>
              <div className="text-yellow-400 font-bold">
                SINGLE-FRAME EVIDENCE MODE
              </div>
            </div>
          </div>

          {/* Bottom Controls inside monitor */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">Confidence Filter:</span>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-32 accent-blue-500 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-blue-400">
                {(confidenceThreshold * 100).toFixed(0)}%
              </span>
            </div>

            <button
              onClick={onTriggerDetection}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
              <span>Force Anomaly Ingest</span>
            </button>
          </div>
        </div>

        {/* Right 4 cols: Architectural Pipeline Flow */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Cpu className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Edge-to-Command Pipeline</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              How UrbanNex AI converts mobile transit buses into continuous smart city infrastructure sensors:
            </p>

            {/* Architecture Steps List */}
            <div className="mt-3 space-y-2.5">
              {[
                { step: '1', title: 'Onboard Camera', desc: '1080p optical sensor captures pavement stream.' },
                { step: '2', title: 'Edge AI Inference', desc: 'MobileNet / YOLO nano detects road hazards locally at ~29 FPS.' },
                { step: '3', title: 'Object Tracking', desc: 'Multi-frame tracker calculates persistence & hazard size.' },
                { step: '4', title: 'Severity & Confidence', desc: 'Scoring engine filters false positives (threshold > 70%).' },
                { step: '5', title: 'GPS + Time Watermark', desc: 'Sub-meter GNSS coordinates stamped onto metadata.' },
                { step: '6', title: 'Secure WebSocket Relay', desc: 'Only structured JSON + 1 evidence frame transmitted.' },
                { step: '7', title: 'GIS Command Center', desc: 'Dispatches municipal teams for rapid remediation.' },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-2.5 text-xs">
                  <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0 border border-blue-200 text-[10px]">
                    {s.step}
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">{s.title}</span>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* YOLO Pluggable Replacement Callout */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Code className="w-3.5 h-3.5 text-blue-600" />
              <span>Modular Service Contract</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              `AIInferenceService` abstraction permits seamless swap from `DemoInferenceService` to production `YOLOInferenceService` (TensorRT) without code modifications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
