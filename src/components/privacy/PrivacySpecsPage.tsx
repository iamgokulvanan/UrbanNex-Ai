import React from 'react';
import { 
  ShieldCheck, 
  Award, 
  Cpu, 
  Bus, 
  Layers, 
  Zap, 
  CheckCircle2, 
  ExternalLink,
  Lock,
  EyeOff,
  Database,
  Radio,
  FileText
} from 'lucide-react';

interface PrivacySpecsPageProps {
  onNavigateTab: (tab: any) => void;
  onTriggerDetection: () => void;
}

export const PrivacySpecsPage: React.FC<PrivacySpecsPageProps> = ({
  onNavigateTab,
  onTriggerDetection,
}) => {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold mb-3">
            <Award className="w-4 h-4 text-yellow-300" />
            <span>Smart India Hackathon 2026 • Problem ID: 26124</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            UrbanNex <span className="text-blue-400">AI</span>
          </h1>
          <p className="text-lg md:text-xl font-medium text-blue-100 mt-1">
            "Turning Every Bus into a Mobile Urban Sensor."
          </p>

          <p className="text-xs md:text-sm text-blue-200/90 mt-3 leading-relaxed">
            A real-time, edge-first urban sensing platform transforming municipal transit fleets into continuous city health inspectors without expensive dedicated sensor vehicles.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('gis_map')}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <Bus className="w-4 h-4" />
              <span>Explore Live GIS Map</span>
            </button>
            <button
              onClick={onTriggerDetection}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
              <span>Trigger Test Detection</span>
            </button>
          </div>
        </div>
      </div>

      {/* SIH Meta Card Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Theme</span>
          <div className="text-base font-bold text-slate-900 mt-1">Smart Automation</div>
          <span className="text-xs text-blue-600 font-semibold">Autonomous Ingestion</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category</span>
          <div className="text-base font-bold text-slate-900 mt-1">Software / Edge AI</div>
          <span className="text-xs text-purple-600 font-semibold">Vision + GIS + Web</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Problem ID</span>
          <div className="text-base font-bold text-slate-900 mt-1">26124</div>
          <span className="text-xs text-slate-500 font-medium">Urban Mobility & Safety</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pilot Region</span>
          <div className="text-base font-bold text-slate-900 mt-1">Coimbatore Ward 12</div>
          <span className="text-xs text-emerald-600 font-semibold">12 Fleet Corridors</span>
        </div>
      </div>

      {/* Six Pillars of Innovation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Why UrbanNex AI Wins: Six Architectural Pillars</h2>
          <p className="text-xs text-slate-500 mt-0.5">Engineered specifically for Indian municipal transit dynamics and bandwidth constraints.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</div>
            <h3 className="font-bold text-xs text-slate-900">Zero Added Vehicle Capex</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Standard cities purchase costly survey cars that traverse roads once a year. UrbanNex AI mounts low-cost Jetson/Pi units onto buses already traversing routes dozens of times daily.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-bold">2</div>
            <h3 className="font-bold text-xs text-slate-900">Edge-First Processing</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Inference runs locally at 28+ FPS using quantized models. Cellular networks never choke because continuous high-bandwidth video is completely avoided.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">3</div>
            <h3 className="font-bold text-xs text-slate-900">DPDP Act Privacy Strictness</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Only structured event metadata and a single watermarked evidence frame are preserved. No facial biometrics, civilian tracking, or constant public surveillance.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold">4</div>
            <h3 className="font-bold text-xs text-slate-900">Sub-Meter Precision GIS</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Combines NavIC and RTK multi-constellation GPS locks to record defect coordinates with sub-meter accuracy, allowing repair crews to locate potholes instantly.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">5</div>
            <h3 className="font-bold text-xs text-slate-900">Inter-Departmental Dispatch</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Intelligently routes road cavitations to Infrastructure, waterlogging to Drainage, and blockages to Traffic Police in a unified municipal Kanban board.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">6</div>
            <h3 className="font-bold text-xs text-slate-900">Modular AI Service Contract</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Architected with an `AIInferenceService` interface, allowing hot-swapping between `DemoInferenceService` and production TensorRT YOLO inference engines without codebase refactors.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive SIH Demo Walkthrough Guide */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">Smart India Hackathon 2026 Evaluation Walkthrough</h2>
        </div>
        <p className="text-xs text-slate-500">
          Judges can verify the end-to-end functionality using this recommended demo flow:
        </p>

        <div className="space-y-3 pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <span className="font-bold text-xs text-slate-900">Observe Live Bus Movements & Heading</span>
                <p className="text-[11px] text-slate-500">Go to Live GIS Map; watch BUS-001 to BUS-012 traverse Gandhipuram corridors in real-time.</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('gis_map')}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200"
            >
              Open Map
            </button>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
              <div>
                <span className="font-bold text-xs text-slate-900">Simulate Real-Time Anomaly Generation</span>
                <p className="text-[11px] text-slate-500">Click "Generate Detection" in the top bar to trigger an immediate Edge AI detection event.</p>
              </div>
            </div>
            <button
              onClick={onTriggerDetection}
              className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200"
            >
              Trigger Now
            </button>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
              <div>
                <span className="font-bold text-xs text-slate-900">Inspect Single Evidence Frame</span>
                <p className="text-[11px] text-slate-500">Click any marker on the map or item in the feed to open the simulated camera evidence drawer.</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('detections')}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200"
            >
              Open Feed
            </button>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">4</span>
              <div>
                <span className="font-bold text-xs text-slate-900">Verify & Dispatch Department</span>
                <p className="text-[11px] text-slate-500">Open Authority Workflow; transition incident from Pending → Verified → Assigned → Resolved.</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('workflow')}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200"
            >
              Open Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
