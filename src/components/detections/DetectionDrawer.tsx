import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Users, 
  PlayCircle, 
  CheckCheck, 
  MapPin, 
  Clock, 
  Bus, 
  ShieldAlert, 
  Cpu, 
  Layers, 
  History, 
  ExternalLink,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { Detection, Department, IncidentStatus } from '../../types';
import { DEPARTMENTS } from '../../data/seedData';
import { getSimulatedEvidenceImageUrl } from '../../utils/evidenceGenerator';

interface DetectionDrawerProps {
  detection: Detection | null;
  onClose: () => void;
  onVerify: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onAssign: (id: string, department: Department, note?: string) => void;
  onInProgress: (id: string, note?: string) => void;
  onResolve: (id: string, notes?: string) => void;
}

export const DetectionDrawer: React.FC<DetectionDrawerProps> = ({
  detection,
  onClose,
  onVerify,
  onReject,
  onAssign,
  onInProgress,
  onResolve,
}) => {
  const [selectedDept, setSelectedDept] = useState<Department>('Roads & Infrastructure');
  const [assignNote, setAssignNote] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  if (!detection) return null;

  const evidenceImg = getSimulatedEvidenceImageUrl(
    detection.type,
    detection.id,
    detection.busId,
    detection.timestamp,
    detection.confidence
  );

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getStatusBadge = (st: IncidentStatus) => {
    switch (st) {
      case 'resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'verified':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'assigned':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'in_progress':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-2xs transition-opacity" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {detection.id}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusBadge(detection.status)}`}>
                  {detection.status.replace('_', ' ')}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1 capitalize">
                {detection.type.replace('_', ' ')} Anomaly
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(detection.timestamp).toLocaleString()}
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-5 flex-1">
            {/* Simulated Camera Evidence Frame */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">Camera Evidence Frame</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  1 FRAME METADATA EXPORT
                </span>
              </div>

              {/* Stylized simulated evidence card */}
              <div className="relative rounded-xl overflow-hidden border border-slate-300 shadow-sm bg-slate-900 aspect-16/10">
                <img
                  src={evidenceImg}
                  alt={`Simulated Evidence for ${detection.id}`}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-amber-700">Notice:</span>
                <span>SIMULATED DEMO EVIDENCE • Single frame transmitted from bus edge</span>
              </div>
            </div>

            {/* Telemetry & AI Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">Confidence Score</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-bold text-slate-900">
                    {(detection.confidence * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Edge Confirmed</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">Hazard Severity</span>
                <div className="mt-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border uppercase ${getSeverityBadge(detection.severity)}`}>
                    {detection.severity}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">Reporting Bus</span>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-xs text-slate-900">
                  <Bus className="w-3.5 h-3.5 text-blue-600" />
                  <span>{detection.busId} ({detection.routeId})</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">Assigned Department</span>
                <div className="mt-1 text-xs font-semibold text-purple-700 truncate">
                  {detection.department || 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Location & GPS Info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">{detection.locationName}</p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    GPS: {detection.latitude.toFixed(6)}° N, {detection.longitude.toFixed(6)}° E
                  </p>
                </div>
              </div>
              {detection.roadSurfaceMetric && (
                <div className="text-xs text-slate-600 pt-1.5 border-t border-slate-200/80">
                  <span className="font-semibold text-slate-700">Surface Metric: </span>
                  {detection.roadSurfaceMetric}
                </div>
              )}
            </div>

            {/* Action Buttons Workflow */}
            <div>
              <p className="text-xs font-bold text-slate-800 mb-2">Authority Decision Workflow</p>
              <div className="space-y-2">
                {detection.status === 'pending_verification' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onVerify(detection.id)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify Detection</span>
                    </button>
                    <button
                      onClick={() => onReject(detection.id, 'Discarded by Authority')}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject / False Alarm</span>
                    </button>
                  </div>
                )}

                {(detection.status === 'pending_verification' || detection.status === 'verified') && (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    <span>Assign Municipal Department</span>
                  </button>
                )}

                {detection.status === 'assigned' && (
                  <button
                    onClick={() => onInProgress(detection.id, 'Repair crew dispatched')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>Mark In Progress (Dispatch Unit)</span>
                  </button>
                )}

                {detection.status === 'in_progress' && (
                  <button
                    onClick={() => setShowResolveModal(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Mark Resolved</span>
                  </button>
                )}

                {detection.status === 'resolved' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <CheckCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-emerald-800">Civil Hazard Resolved</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">
                      Repairs inspected and verified clear for traffic.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Department Assignment Modal in drawer */}
            {showAssignModal && (
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-2.5 animate-in fade-in">
                <p className="text-xs font-bold text-purple-900">Dispatch Department</p>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value as Department)}
                  className="w-full bg-white border border-purple-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Dispatch priority notes (optional)..."
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  className="w-full bg-white border border-purple-300 rounded-lg p-2 text-xs text-slate-800"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onAssign(detection.id, selectedDept, assignNote);
                      setShowAssignModal(false);
                    }}
                    className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    Confirm Dispatch
                  </button>
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="px-3 py-1.5 bg-white text-slate-600 text-xs font-semibold rounded-lg border border-purple-200 hover:bg-purple-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Resolution Modal in drawer */}
            {showResolveModal && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5 animate-in fade-in">
                <p className="text-xs font-bold text-emerald-900">Sign Off Hazard Resolution</p>
                <textarea
                  rows={2}
                  placeholder="Field repair sign-off notes (e.g., Bituminous asphalt compaction completed)..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-xs text-slate-800"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onResolve(detection.id, resolutionNotes);
                      setShowResolveModal(false);
                    }}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    Confirm Resolution
                  </button>
                  <button
                    onClick={() => setShowResolveModal(false)}
                    className="px-3 py-1.5 bg-white text-slate-600 text-xs font-semibold rounded-lg border border-emerald-200 hover:bg-emerald-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Incident History Audit Trail */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-slate-800">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Workflow Audit History</span>
              </div>
              <div className="space-y-2 border-l-2 border-slate-200 pl-3 ml-1.5">
                {detection.history.map((h) => (
                  <div key={h.id} className="text-xs relative">
                    <span className="w-2 h-2 rounded-full bg-blue-500 absolute -left-[17px] top-1" />
                    <p className="font-semibold text-slate-800">
                      {h.changedBy} 
                      <span className="font-normal text-slate-500 ml-1">
                        → {h.newStatus.replace('_', ' ')}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      {h.note && ` • ${h.note}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>UrbanNex AI • Incident Record</span>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
