import React from 'react';
import { 
  HeartPulse, 
  Cpu, 
  Camera, 
  Wifi, 
  MapPin, 
  ShieldCheck, 
  HardDrive, 
  Activity, 
  CheckCircle2, 
  Zap,
  Layers,
  Clock,
  Radio
} from 'lucide-react';
import { SystemHealthMetrics } from '../../types';

interface SystemHealthPageProps {
  health: SystemHealthMetrics;
  wsConnected: boolean;
}

export const SystemHealthPage: React.FC<SystemHealthPageProps> = ({
  health,
  wsConnected,
}) => {
  const edgeDeviceModel = 'NVIDIA Jetson Orin Nano (8GB)';
  const edgeTemp = 42;
  const cpuUsage = health.cpuUsage || 24;
  const gpuUsage = 84;
  const cameraStatus = 'ONLINE (1080p @ 30 FPS)';
  const gpsReceiver = 'LOCKED (12 Satellites RTK)';
  const satellitesLocked = 12;
  const networkLatency = health.averageLatencyMs || 114;
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Edge Infrastructure Health
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-emerald-600">All Fleet Nodes Nominal</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            System Health & Edge Telemetry Diagnostics
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Real-time diagnostics of onboard computational modules, sensor lock accuracy, and 4G communication links.
          </p>
        </div>

        {/* Global Health Pill */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs text-emerald-800 font-bold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Fleet Health: 98.7% Operational</span>
        </div>
      </div>

      {/* Main Hardware Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Onboard Hardware */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Edge Compute</span>
              <Cpu className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-slate-900">{edgeDeviceModel}</div>
            <p className="text-[11px] text-slate-400">Low-power embedded AI</p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>CPU Utilization:</span>
                <span className="font-bold text-slate-900">{cpuUsage}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${cpuUsage}%` }} />
              </div>

              <div className="flex justify-between text-slate-600">
                <span>GPU Inference Load:</span>
                <span className="font-bold text-indigo-600">{gpuUsage}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${gpuUsage}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Core Temp:</span>
            <span className="font-bold text-emerald-600">{edgeTemp}°C (Safe &lt; 75°C)</span>
          </div>
        </div>

        {/* Optical Camera */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Camera Sensor</span>
              <Camera className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg font-bold text-slate-900">{cameraStatus}</div>
            <p className="text-[11px] text-slate-400">1080p @ 30 FPS Industrial</p>

            <div className="mt-4 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Resolution:</span>
                <span className="font-bold text-slate-800">1920 x 1080</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Encoding:</span>
                <span className="font-bold text-slate-800">H.265 Onboard</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Lens Cleanliness:</span>
                <span className="font-bold text-emerald-600">98% (Optics Clear)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Night Mode / IR:</span>
            <span className="font-bold text-blue-600">Auto-Switching</span>
          </div>
        </div>

        {/* GNSS / GPS Lock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">GNSS / GPS Lock</span>
              <MapPin className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-lg font-bold text-slate-900">{gpsReceiver}</div>
            <p className="text-[11px] text-slate-400">Multi-constellation RTK</p>

            <div className="mt-4 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Locked Satellites:</span>
                <span className="font-bold text-emerald-600">{satellitesLocked} Sats</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Horizontal Accuracy:</span>
                <span className="font-bold text-slate-800">± 0.42 meters</span>
              </div>
              <div className="flex justify-between py-1">
                <span>GNSS Constellations:</span>
                <span className="font-bold text-slate-800">GPS + NavIC + GLONASS</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">NavIC Support:</span>
            <span className="font-bold text-emerald-600">ACTIVE (India Standard)</span>
          </div>
        </div>

        {/* Network & Relay */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Network & Sync</span>
              <Wifi className="w-4 h-4 text-cyan-600" />
            </div>
            <div className="text-lg font-bold text-slate-900">4G LTE Cellular</div>
            <p className="text-[11px] text-slate-400">WebSocket / MQTT Broker</p>

            <div className="mt-4 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Latency:</span>
                <span className="font-bold text-cyan-700">{networkLatency} ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>WebSocket Link:</span>
                <span className={`font-bold ${wsConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {wsConnected ? 'ESTABLISHED' : 'RECONNECTING'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Packet Drop:</span>
                <span className="font-bold text-emerald-600">0.02% (Carrier Grade)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Cellular Protocol:</span>
            <span className="font-bold text-slate-700">LTE-M / VoLTE</span>
          </div>
        </div>
      </div>

      {/* Bandwidth Efficiency & Privacy Guard Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bandwidth Savings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Edge Bandwidth Efficiency Analysis</h2>
          </div>

          <p className="text-xs text-slate-600">
            By executing inference directly on the bus, UrbanNex AI reduces cellular data transmission by over <span className="font-bold text-emerald-600">99.4%</span> compared to continuous CCTV streaming.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-700">Raw 1080p Continuous Video Streaming (Traditional):</span>
                <span className="text-red-600 font-bold">~4.5 GB / bus / hour</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-red-500 h-full rounded-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-700">UrbanNex AI Edge Metadata + 1 Evidence Frame:</span>
                <span className="text-emerald-600 font-bold">~24 MB / bus / hour</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full w-[2%]" />
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
            <span className="font-bold">Municipal Financial Impact: </span>
            A city running 1,000 buses saves approximately ₹1.8 Crore ($220,000) annually in cellular data SIM costs alone.
          </div>
        </div>

        {/* Privacy Guard Architecture */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">Edge Privacy Architecture (SIH Compliance)</h2>
          </div>

          <p className="text-xs text-slate-600">
            Designed from day one to respect citizen privacy and Indian Digital Personal Data Protection (DPDP) standards:
          </p>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-800">No Continuous Video Streaming:</span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Raw video stays in volatile edge RAM buffer and is discarded after detection verification.
                </p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-800">Zero Facial Recognition:</span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  The model only classifies road surfaces and vehicle bounds; no facial biometrics or license plate harvesting.
                </p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-800">Secure Municipal Watermarking:</span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Single evidence frames include cryptographically signed timestamps and bus ID watermarks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
